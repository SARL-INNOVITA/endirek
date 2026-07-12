/**
 * Panneau détail d'un deal (CP2.5 — D66) —
 * GET /api/v1/admin/dealplace/deals/:id, avec l'ARBITRAGE des litiges
 * (POST /admin/dealplace/deals/:id/resolve-dispute) et la modération des
 * messages de la conversation liée (PATCH /admin/dealplace/messages/:id/status).
 *
 * Règles reflétées ici (imposées par l'API) :
 * - l'arbitrage n'est possible que sur un deal « disputed » (409 sinon) et
 *   exige une note de décision (10-1000 caractères) montrée aux DEUX parties ;
 * - trois issues : annuler / déclarer conclu (les avis s'ouvrent) / reprendre
 *   (litige non fondé — le deal redevient actif) ;
 * - un modérateur partie prenante du deal ne peut pas l'arbitrer (403).
 */

import { useEffect, useState } from 'react'
import {
  adminGetDeal,
  adminListConversationMessages,
  adminResolveDispute,
  adminSetMessageStatus,
  toErrorMessage,
} from './api'
import type {
  AdminDeal,
  AdminDealItem,
  AdminMessage,
  DisputeResolution,
  MessageStatus,
} from './api'
import {
  Avatar,
  DISPUTE_RESOLUTION_LABELS,
  DealStatusBadge,
  ListingStatusBadge,
  formatDateTime,
} from './ui'

type DetailState =
  | { kind: 'loading' }
  | { kind: 'success'; deal: AdminDeal }
  | { kind: 'error'; message: string }

type MessagesState =
  | { kind: 'loading' }
  | { kind: 'success'; messages: AdminMessage[]; total: number }
  | { kind: 'error'; message: string }

interface DealDetailAdminProps {
  dealId: string
  /** Ferme le panneau. */
  onClose: () => void
  /** Prévient la vue appelante qu'un deal a changé (liste + badge litiges). */
  onDealUpdated: () => void
}

/** Badges d'état d'un élément (dérivés des sous-éléments — mockup 07). */
const ITEM_BADGE_LABELS: Record<AdminDealItem['badge'], string> = {
  to_provide: 'À fournir',
  partial: 'Validation partielle',
  awaiting_validation: 'En attente de validation',
  honored: 'Honoré',
}

/** Descriptions des trois issues d'arbitrage (formulaire). */
const OUTCOME_OPTIONS: Array<{
  value: DisputeResolution
  label: string
  description: string
}> = [
  {
    value: 'cancelled',
    label: 'Annuler le deal',
    description: 'Le deal est clos sans suite — aucune partie ne doit plus rien.',
  },
  {
    value: 'completed',
    label: 'Déclarer le deal conclu',
    description:
      'L’échange est considéré comme réalisé — les avis s’ouvrent aux deux parties.',
  },
  {
    value: 'resumed',
    label: 'Reprendre le deal',
    description:
      'Litige non fondé — le deal redevient actif et suit son cours normal.',
  },
]

export default function DealDetailAdmin({
  dealId,
  onClose,
  onDealUpdated,
}: DealDetailAdminProps) {
  const [state, setState] = useState<DetailState>({ kind: 'loading' })
  // Fil de la conversation liée (ordre chronologique après inversion).
  const [messages, setMessages] = useState<MessagesState | null>(null)
  // Formulaire d'arbitrage.
  const [outcome, setOutcome] = useState<DisputeResolution>('cancelled')
  const [note, setNote] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  // Modération des messages : id du message en cours d'action.
  const [messageActing, setMessageActing] = useState<string | null>(null)
  const [messageError, setMessageError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    setMessages(null)
    setResolveError(null)
    setMessageError(null)
    setNote('')
    setOutcome('cancelled')

    adminGetDeal(dealId, controller.signal)
      .then((deal) => {
        setState({ kind: 'success', deal })
        if (deal.conversationId) {
          loadMessages(deal.conversationId, controller.signal)
        }
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: toErrorMessage(caught) })
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId])

  /** Charge les 50 derniers messages du fil lié (corps réels). */
  function loadMessages(conversationId: string, signal?: AbortSignal) {
    setMessages({ kind: 'loading' })
    adminListConversationMessages(conversationId, { limit: 50, offset: 0 }, signal)
      .then((page) =>
        setMessages({
          kind: 'success',
          // L'API sert du plus récent au plus ancien : on inverse pour lire
          // le fil chronologiquement.
          messages: [...page.items].reverse(),
          total: page.total,
        }),
      )
      .catch((caught: unknown) => {
        if (signal?.aborted) return
        setMessages({ kind: 'error', message: toErrorMessage(caught) })
      })
  }

  /** Tranche le litige après confirmation explicite. */
  async function applyResolution(deal: AdminDeal) {
    const option = OUTCOME_OPTIONS.find((o) => o.value === outcome)
    const question =
      `Trancher le litige du Deal ${deal.dealNumber} — « ${option?.label} » ? ` +
      'La décision et la note seront notifiées aux deux parties.'
    if (!window.confirm(question)) return

    setResolving(true)
    setResolveError(null)
    try {
      const updated = await adminResolveDispute(deal.id, outcome, note.trim())
      setState({ kind: 'success', deal: updated })
      onDealUpdated()
    } catch (caught) {
      // 400 (note invalide), 403 (arbitre partie prenante) et 409 (deal non
      // disputé) portent déjà un message français propre renvoyé par l'API.
      setResolveError(toErrorMessage(caught))
    } finally {
      setResolving(false)
    }
  }

  /** Masque ou réactive un message du fil lié après confirmation. */
  async function applyMessageStatus(message: AdminMessage, status: MessageStatus) {
    const question =
      status === 'hidden'
        ? 'Masquer ce message ? Les participants verront « Message masqué par la modération. » (réversible).'
        : 'Réactiver ce message ? Son contenu redeviendra visible des participants.'
    if (!window.confirm(question)) return

    setMessageActing(message.id)
    setMessageError(null)
    try {
      const updated = await adminSetMessageStatus(message.id, status)
      setMessages((current) =>
        current && current.kind === 'success'
          ? {
              ...current,
              messages: current.messages.map((m) =>
                m.id === updated.id ? updated : m,
              ),
            }
          : current,
      )
    } catch (caught) {
      setMessageError(toErrorMessage(caught))
    } finally {
      setMessageActing(null)
    }
  }

  /** Nom d'une partie à partir de son id (proposeur / destinataire). */
  function partyName(deal: AdminDeal, userId: string | null): string {
    if (userId === null) return '—'
    if (userId === deal.proposer.id) return deal.proposer.displayName
    if (userId === deal.recipient.id) return deal.recipient.displayName
    return 'Compte inconnu'
  }

  const noteValid = note.trim().length >= 10 && note.trim().length <= 1000

  return (
    <aside className="card detail-panel" aria-label="Détail du deal">
      <div className="detail-header">
        <h3 className="card-title">
          {state.kind === 'success'
            ? `Deal ${state.deal.dealNumber}`
            : 'Détail du deal'}
        </h3>
        <button type="button" className="button-ghost" onClick={onClose}>
          Fermer
        </button>
      </div>

      {state.kind === 'loading' && <p className="muted">Chargement…</p>}

      {state.kind === 'error' && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      {state.kind === 'success' && (
        <div className="detail-body">
          <div className="detail-badges">
            <DealStatusBadge status={state.deal.status} />
          </div>

          {/* Les deux parties — forme non viewer-centrique. */}
          <div className="deal-parties-detail">
            <div className="detail-identity">
              <Avatar
                displayName={state.deal.proposer.displayName}
                avatarUrl={state.deal.proposer.avatarUrl}
              />
              <div>
                <p className="detail-name">{state.deal.proposer.displayName}</p>
                <p className="detail-email">Proposeur</p>
              </div>
            </div>
            <div className="detail-identity">
              <Avatar
                displayName={state.deal.recipient.displayName}
                avatarUrl={state.deal.recipient.avatarUrl}
              />
              <div>
                <p className="detail-name">{state.deal.recipient.displayName}</p>
                <p className="detail-email">Destinataire</p>
              </div>
            </div>
          </div>

          <dl className="detail-rows">
            <div className="detail-row">
              <dt>Annonce</dt>
              <dd>
                {state.deal.listing.title}{' '}
                <ListingStatusBadge
                  status={
                    state.deal.listing.status as 'active' | 'hidden' | 'deleted'
                  }
                />
              </dd>
            </div>
            <div className="detail-row">
              <dt>Créé le</dt>
              <dd>{formatDateTime(state.deal.createdAt)}</dd>
            </div>
            {state.deal.acceptedAt && (
              <div className="detail-row">
                <dt>Accepté le</dt>
                <dd>{formatDateTime(state.deal.acceptedAt)}</dd>
              </div>
            )}
            {state.deal.completedAt && (
              <div className="detail-row">
                <dt>Conclu le</dt>
                <dd>{formatDateTime(state.deal.completedAt)}</dd>
              </div>
            )}
            {state.deal.closedAt && (
              <div className="detail-row">
                <dt>Clos le</dt>
                <dd>{formatDateTime(state.deal.closedAt)}</dd>
              </div>
            )}
          </dl>

          {/* Éléments et sous-éléments (lecture seule). */}
          <section aria-label="Éléments du deal">
            <h4 className="detail-section-title">Éléments</h4>
            {state.deal.items.length === 0 && (
              <p className="muted">Aucun élément.</p>
            )}
            <ul className="deal-items">
              {state.deal.items.map((item) => (
                <li key={item.id} className="deal-item">
                  <div className="deal-item-head">
                    <span className="deal-item-title">
                      {item.title} — {item.value.toLocaleString('fr-FR')} €
                    </span>
                    <span className="badge badge--neutral">
                      {ITEM_BADGE_LABELS[item.badge]}
                    </span>
                  </div>
                  <p className="deal-item-provider muted">
                    Fourni par {partyName(state.deal, item.providerId)}
                  </p>
                  <ul className="deal-steps">
                    {item.steps.map((step) => (
                      <li key={step.id} className="deal-step">
                        <span
                          className={
                            step.validatedAt
                              ? 'deal-step-mark deal-step-mark--validated'
                              : step.honoredAt
                                ? 'deal-step-mark deal-step-mark--honored'
                                : 'deal-step-mark'
                          }
                          aria-hidden="true"
                        >
                          {step.validatedAt ? '✓✓' : step.honoredAt ? '✓' : '·'}
                        </span>
                        {step.label}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          {/* Litige en cours ou passé. */}
          {state.deal.disputedBy && (
            <section className="deal-dispute" aria-label="Litige">
              <h4 className="detail-section-title">Litige</h4>
              <p className="deal-dispute-meta">
                Déclaré par {partyName(state.deal, state.deal.disputedBy)}
              </p>
              {state.deal.disputeReason && (
                <p className="deal-dispute-reason">{state.deal.disputeReason}</p>
              )}
            </section>
          )}

          {/* Issue d'un arbitrage déjà rendu. */}
          {state.deal.disputeResolvedAt && state.deal.disputeResolution && (
            <section className="deal-resolution" aria-label="Issue de l'arbitrage">
              <h4 className="detail-section-title">Arbitrage rendu</h4>
              <p>
                <strong>
                  {DISPUTE_RESOLUTION_LABELS[state.deal.disputeResolution]}
                </strong>{' '}
                — {formatDateTime(state.deal.disputeResolvedAt)}
              </p>
              {state.deal.disputeResolutionNote && (
                <p className="deal-resolution-note">
                  {state.deal.disputeResolutionNote}
                </p>
              )}
            </section>
          )}

          {/* Formulaire d'arbitrage — uniquement sur un litige ouvert. */}
          {state.deal.status === 'disputed' && (
            <section className="deal-arbitration" aria-label="Arbitrer le litige">
              <h4 className="detail-section-title">Trancher le litige</h4>
              <div className="deal-arbitration-options">
                {OUTCOME_OPTIONS.map((option) => (
                  <label key={option.value} className="deal-arbitration-option">
                    <input
                      type="radio"
                      name="dispute-outcome"
                      value={option.value}
                      checked={outcome === option.value}
                      onChange={() => setOutcome(option.value)}
                    />
                    <span>
                      <span className="deal-arbitration-label">
                        {option.label}
                      </span>
                      <span className="deal-arbitration-description muted">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <textarea
                className="resolution-note"
                placeholder="Note de décision (obligatoire, montrée aux deux parties — 10 à 1000 caractères)…"
                aria-label="Note de décision"
                maxLength={1000}
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              {resolveError && (
                <p className="form-error" role="alert">
                  {resolveError}
                </p>
              )}
              <button
                type="button"
                className="button-primary"
                disabled={resolving || !noteValid}
                onClick={() => void applyResolution(state.deal)}
              >
                {resolving ? 'En cours…' : 'Trancher le litige'}
              </button>
            </section>
          )}

          {/* Avis éventuels (deal conclu). */}
          {state.deal.reviews.length > 0 && (
            <section aria-label="Avis">
              <h4 className="detail-section-title">Avis</h4>
              <ul className="deal-reviews">
                {state.deal.reviews.map((review) => (
                  <li key={review.id} className="deal-review">
                    <span className="deal-review-head">
                      {review.reviewer.displayName} —{' '}
                      {review.overall.toLocaleString('fr-FR')}/5
                    </span>
                    {review.comment && (
                      <span className="muted"> « {review.comment} »</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Conversation liée — modération des messages (D67). */}
          {state.deal.conversationId && (
            <section aria-label="Conversation liée">
              <h4 className="detail-section-title">Conversation liée</h4>
              {messages?.kind === 'loading' && (
                <p className="muted">Chargement des messages…</p>
              )}
              {messages?.kind === 'error' && (
                <p className="form-error" role="alert">
                  {messages.message}
                </p>
              )}
              {messages?.kind === 'success' && (
                <>
                  {messages.total > messages.messages.length && (
                    <p className="muted">
                      Fil tronqué aux {messages.messages.length} derniers
                      messages (sur {messages.total}) — le fil complet se
                      consulte dans la sous-vue Conversations.
                    </p>
                  )}
                  {messageError && (
                    <p className="form-error" role="alert">
                      {messageError}
                    </p>
                  )}
                  <ul className="deal-messages">
                    {messages.messages.map((message) => (
                      <li
                        key={message.id}
                        className={
                          message.status === 'hidden'
                            ? 'deal-message deal-message--hidden'
                            : 'deal-message'
                        }
                      >
                        <div className="deal-message-head">
                          <span className="deal-message-sender">
                            {partyName(state.deal, message.senderId)}
                          </span>
                          <span className="muted">
                            {formatDateTime(message.createdAt)}
                          </span>
                          {message.status === 'hidden' && (
                            <span className="badge badge--dark">Masqué</span>
                          )}
                        </div>
                        <p className="deal-message-body">{message.body}</p>
                        <div className="report-actions">
                          {message.status === 'active' ? (
                            <button
                              type="button"
                              className="button-danger button-compact"
                              disabled={messageActing === message.id}
                              onClick={() =>
                                void applyMessageStatus(message, 'hidden')
                              }
                            >
                              {messageActing === message.id
                                ? 'En cours…'
                                : 'Masquer'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="button-primary button-compact"
                              disabled={messageActing === message.id}
                              onClick={() =>
                                void applyMessageStatus(message, 'active')
                              }
                            >
                              {messageActing === message.id
                                ? 'En cours…'
                                : 'Réactiver'}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>
      )}
    </aside>
  )
}

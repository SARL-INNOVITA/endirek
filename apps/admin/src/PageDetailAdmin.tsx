/**
 * Panneau détail d'une page restaurant/entreprise (Lot 3) —
 * GET /api/v1/admin/pages/:id, avec les actions de modération
 * « Masquer » / « Republier » (PATCH /admin/pages/:id/status) et
 * « Accorder / Retirer le badge vérifié » (PATCH /admin/pages/:id/verified).
 *
 * Règles reflétées ici (imposées par l'API, miroir des annonces) :
 * - seuls 'active' et 'hidden' sont posables par le backoffice : la
 *   suppression appartient au propriétaire (DELETE) ou au flux RGPD (400) ;
 * - une page 'deleted' n'est jamais restaurée (409) — les boutons sont
 *   remplacés par une explication ;
 * - masquer une page retire AUSSI ses publications du feed et de la carte
 *   (le window.confirm le précise) ;
 * - le badge vérifié est la « validation légère » a posteriori — il
 *   s'accorde et se retire librement, sauf sur une page supprimée (409).
 */

import { useEffect, useState } from 'react'
import {
  adminGetPage,
  adminSetPageStatus,
  adminSetPageVerified,
  toErrorMessage,
} from './api'
import type {
  AdminPageDetail,
  AdminSettablePageStatus,
  PageEventView,
  PageHourView,
  PageOfferView,
} from './api'
import {
  Avatar,
  PAGE_EVENT_TIMING_LABELS,
  PageOpenStateBadge,
  PageStatusBadge,
  PageTypeBadge,
  REPORT_REASON_LABELS,
  ReportStatusBadge,
  VerifiedBadge,
  formatDate,
  formatDateTime,
} from './ui'

type DetailState =
  | { kind: 'loading' }
  | { kind: 'success'; page: AdminPageDetail }
  | { kind: 'error'; message: string }

/** Action en cours : changement de statut ou de badge vérifié. */
type ActingKind = 'status' | 'verified' | null

interface PageDetailAdminProps {
  pageId: string
  /** Ferme le panneau. */
  onClose: () => void
  /** Prévient la vue appelante qu'une page a changé (rafraîchit sa liste). */
  onPageUpdated: (page: AdminPageDetail) => void
}

/** Jours de la semaine du contrat (weekday 0 = lundi … 6 = dimanche). */
const WEEKDAY_LABELS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
]

/** Taille de fichier lisible (Ko / Mo) pour les documents « Nos cartes ». */
function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
  }
  return `${Math.max(1, Math.round(bytes / 1000)).toLocaleString('fr-FR')} Ko`
}

/** Plages horaires lisibles d'un jour (ex. « 12:00–14:00, 19:00–21:30 »). */
function hoursOfDay(hours: PageHourView[], weekday: number): string {
  const ranges = hours
    .filter((hour) => hour.weekday === weekday)
    .map((hour) => `${hour.opensAt}–${hour.closesAt}`)
  return ranges.length > 0 ? ranges.join(', ') : 'Fermé'
}

/** Période lisible d'une offre (période absente = offre permanente). */
function offerPeriod(offer: PageOfferView): string {
  if (offer.startsAt && offer.endsAt) {
    return `Du ${formatDate(offer.startsAt)} au ${formatDate(offer.endsAt)}`
  }
  if (offer.startsAt) return `À partir du ${formatDate(offer.startsAt)}`
  if (offer.endsAt) return `Jusqu'au ${formatDate(offer.endsAt)}`
  return 'Offre permanente'
}

/** Créneau lisible d'un événement (début obligatoire, fin optionnelle). */
function eventPeriod(event: PageEventView): string {
  const start = formatDateTime(event.startsAt)
  return event.endsAt ? `${start} → ${formatDateTime(event.endsAt)}` : start
}

export default function PageDetailAdmin({
  pageId,
  onClose,
  onPageUpdated,
}: PageDetailAdminProps) {
  const [state, setState] = useState<DetailState>({ kind: 'loading' })
  const [acting, setActing] = useState<ActingKind>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    setActionError(null)

    adminGetPage(pageId, controller.signal)
      .then((page) => setState({ kind: 'success', page }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: toErrorMessage(caught) })
      })

    return () => controller.abort()
  }, [pageId])

  /** Masque ou republie la page après confirmation explicite. */
  async function applyStatus(
    page: AdminPageDetail,
    status: AdminSettablePageStatus,
  ) {
    const question =
      status === 'hidden'
        ? `Masquer la page « ${page.name} » ? Elle disparaîtra du public et ` +
          'ses publications seront retirées du feed et de la carte ' +
          '(masquage réversible).'
        : `Republier la page « ${page.name} » ? Elle redeviendra visible, ` +
          'ainsi que ses publications.'
    if (!window.confirm(question)) return

    setActing('status')
    setActionError(null)
    try {
      // Le PATCH renvoie le détail complet : le panneau est remis à jour tel quel.
      const updated = await adminSetPageStatus(page.id, status)
      setState({ kind: 'success', page: updated })
      onPageUpdated(updated)
    } catch (caught) {
      // 400 (statut interdit) et 409 (page supprimée) portent déjà un
      // message français propre renvoyé par l'API.
      setActionError(toErrorMessage(caught))
    } finally {
      setActing(null)
    }
  }

  /** Accorde ou retire le badge vérifié après confirmation explicite. */
  async function applyVerified(page: AdminPageDetail, verified: boolean) {
    const question = verified
      ? `Accorder le badge vérifié à « ${page.name} » ? La coche bleue ` +
        'apparaîtra partout où la page est affichée.'
      : `Retirer le badge vérifié de « ${page.name} » ?`
    if (!window.confirm(question)) return

    setActing('verified')
    setActionError(null)
    try {
      const updated = await adminSetPageVerified(page.id, verified)
      setState({ kind: 'success', page: updated })
      onPageUpdated(updated)
    } catch (caught) {
      // 409 (page supprimée : badge figé) porte déjà un message français
      // propre renvoyé par l'API.
      setActionError(toErrorMessage(caught))
    } finally {
      setActing(null)
    }
  }

  return (
    <aside className="card detail-panel" aria-label="Détail de la page">
      <div className="detail-header">
        <h3 className="card-title">Détail de la page</h3>
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
            <PageTypeBadge pageType={state.page.pageType} />
            <PageStatusBadge status={state.page.status} />
            <PageOpenStateBadge state={state.page.openStatus.state} />
            {state.page.openReportsCount > 0 && (
              <span className="badge badge--error">
                {state.page.openReportsCount} signalement
                {state.page.openReportsCount > 1 ? 's' : ''} ouvert
                {state.page.openReportsCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="detail-identity">
            <Avatar
              displayName={state.page.name}
              avatarUrl={state.page.avatarUrl}
            />
            <div>
              <p className="detail-name">
                {state.page.name}
                {state.page.verified && (
                  <>
                    {' '}
                    <VerifiedBadge />
                  </>
                )}
              </p>
              <p className="detail-email">{state.page.city}</p>
            </div>
          </div>

          {state.page.bio !== '' && (
            <p className="post-body">{state.page.bio}</p>
          )}

          {/* Congés en cours : la fin et le message éventuel du propriétaire. */}
          {state.page.openStatus.state === 'vacation' && (
            <div className="page-vacation">
              <p className="page-vacation-title">
                En congés
                {state.page.openStatus.vacationUntil &&
                  ` jusqu'au ${formatDate(state.page.openStatus.vacationUntil)}`}
              </p>
              {state.page.openStatus.vacationMessage && (
                <p className="page-vacation-message">
                  {state.page.openStatus.vacationMessage}
                </p>
              )}
            </div>
          )}

          {state.page.attributes.length > 0 && (
            <div className="listing-tags">
              {state.page.attributes.map((attribute) => (
                <span key={attribute} className="badge badge--neutral">
                  {attribute}
                </span>
              ))}
            </div>
          )}

          <dl className="detail-rows">
            <div className="detail-row">
              <dt>Identifiant</dt>
              <dd>
                <code>{state.page.id}</code>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Slug public</dt>
              <dd>
                <code>{state.page.urlSlug}</code>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Téléphone</dt>
              <dd>{state.page.phone ?? '—'}</dd>
            </div>
            <div className="detail-row">
              <dt>Commune</dt>
              <dd>{state.page.city}</dd>
            </div>
            <div className="detail-row">
              <dt>Localisation</dt>
              <dd>
                {state.page.location
                  ? `${state.page.location.lat.toFixed(4)}, ${state.page.location.lng.toFixed(4)}`
                  : '—'}
              </dd>
            </div>
            <div className="detail-row">
              <dt>Créée le</dt>
              <dd>{formatDateTime(state.page.createdAt)}</dd>
            </div>
            <div className="detail-row">
              <dt>Modifiée le</dt>
              <dd>{formatDateTime(state.page.updatedAt)}</dd>
            </div>
          </dl>

          <section aria-label="Propriétaire de la page">
            <h4 className="detail-section-title">Propriétaire</h4>
            <div className="detail-identity">
              <Avatar
                displayName={state.page.owner.displayName}
                avatarUrl={state.page.owner.avatarUrl}
              />
              <div>
                <p className="detail-name">{state.page.owner.displayName}</p>
                <p className="detail-email">
                  {state.page.owner.city ?? 'Commune non renseignée'}
                </p>
              </div>
            </div>
          </section>

          <section aria-label="Contenus de la page">
            <h4 className="detail-section-title">Contenus</h4>
            <dl className="detail-rows">
              <div className="detail-row">
                <dt>Abonnés</dt>
                <dd>{state.page.followersCount}</dd>
              </div>
              <div className="detail-row">
                <dt>Publications</dt>
                <dd>{state.page.postsCount}</dd>
              </div>
              <div className="detail-row">
                <dt>Plats</dt>
                <dd>{state.page.counts.dishes}</dd>
              </div>
              <div className="detail-row">
                <dt>Menus programmés</dt>
                <dd>{state.page.counts.menus}</dd>
              </div>
              <div className="detail-row">
                <dt>Documents</dt>
                <dd>{state.page.counts.documents}</dd>
              </div>
              <div className="detail-row">
                <dt>Offres</dt>
                <dd>{state.page.counts.offers}</dd>
              </div>
              <div className="detail-row">
                <dt>Événements</dt>
                <dd>{state.page.counts.events}</dd>
              </div>
            </dl>
          </section>

          <section aria-label="Horaires d'ouverture">
            <h4 className="detail-section-title">Horaires</h4>
            {state.page.hours.length === 0 ? (
              <p className="muted">Aucune plage horaire renseignée.</p>
            ) : (
              <dl className="detail-rows">
                {WEEKDAY_LABELS.map((label, weekday) => (
                  <div key={label} className="detail-row">
                    <dt>{label}</dt>
                    <dd>{hoursOfDay(state.page.hours, weekday)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          {state.page.documents.length > 0 && (
            <section aria-label="Documents de la page">
              <h4 className="detail-section-title">Documents</h4>
              <ul className="listing-links">
                {state.page.documents.map((document) => (
                  <li key={document.id}>
                    <a
                      className="camera-link"
                      href={document.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {document.label} ({formatFileSize(document.fileSizeBytes)}) ↗
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state.page.offers.length > 0 && (
            <section aria-label="Offres de la page">
              <h4 className="detail-section-title">Offres</h4>
              <ul className="page-items">
                {state.page.offers.map((offer) => (
                  <li key={offer.id} className="page-item">
                    <div className="page-item-head">
                      <span className="page-item-title">{offer.title}</span>
                      {offer.isCurrent && (
                        <span className="badge badge--success">En cours</span>
                      )}
                    </div>
                    <p className="page-item-meta muted">{offerPeriod(offer)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state.page.events.length > 0 && (
            <section aria-label="Événements de la page">
              <h4 className="detail-section-title">Événements</h4>
              <ul className="page-items">
                {state.page.events.map((event) => (
                  <li key={event.id} className="page-item">
                    <div className="page-item-head">
                      <span className="page-item-title">{event.title}</span>
                      <span
                        className={
                          event.timing === 'past'
                            ? 'badge badge--neutral'
                            : event.timing === 'ongoing'
                              ? 'badge badge--success'
                              : 'badge badge--info'
                        }
                      >
                        {PAGE_EVENT_TIMING_LABELS[event.timing]}
                      </span>
                    </div>
                    <p className="page-item-meta muted">{eventPeriod(event)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state.page.reports.length > 0 && (
            <section aria-label="Signalements liés">
              <h4 className="detail-section-title">Signalements liés</h4>
              <ul className="report-list">
                {state.page.reports.map((report) => (
                  <li key={report.id} className="report-item">
                    <div className="report-item-head">
                      <span className="badge badge--info">
                        {REPORT_REASON_LABELS[report.reasonCode]}
                      </span>
                      <ReportStatusBadge status={report.status} />
                      <span className="muted">
                        {formatDateTime(report.createdAt)}
                      </span>
                    </div>
                    {report.message !== '' && (
                      <p className="report-item-message">{report.message}</p>
                    )}
                    <p className="muted">
                      Signalé par {report.reporter.displayName}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}

          {state.page.status === 'deleted' ? (
            <p className="muted detail-locked">
              Page supprimée (propriétaire ou RGPD) : statut et badge définitifs.
            </p>
          ) : (
            <div className="report-actions">
              {state.page.status === 'active' && (
                <button
                  type="button"
                  className="button-danger"
                  disabled={acting !== null}
                  onClick={() => void applyStatus(state.page, 'hidden')}
                >
                  {acting === 'status' ? 'En cours…' : 'Masquer'}
                </button>
              )}
              {state.page.status === 'hidden' && (
                <button
                  type="button"
                  className="button-primary"
                  disabled={acting !== null}
                  onClick={() => void applyStatus(state.page, 'active')}
                >
                  {acting === 'status' ? 'En cours…' : 'Republier'}
                </button>
              )}
              <button
                type="button"
                className="button-ghost"
                disabled={acting !== null}
                onClick={() => void applyVerified(state.page, !state.page.verified)}
              >
                {acting === 'verified'
                  ? 'En cours…'
                  : state.page.verified
                    ? 'Retirer le badge'
                    : 'Accorder le badge vérifié'}
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

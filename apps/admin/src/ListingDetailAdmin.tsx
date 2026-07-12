/**
 * Panneau détail d'une annonce Dealplace (CP2.1) —
 * GET /api/v1/admin/dealplace/listings/:id, avec les actions de modération
 * « Masquer » / « Réactiver » (PATCH /admin/dealplace/listings/:id/status).
 *
 * Règles reflétées ici (imposées par l'API, miroir des publications) :
 * - seuls 'active' et 'hidden' sont posables par le backoffice : la
 *   suppression appartient au propriétaire (DELETE) ou au flux RGPD (400) ;
 * - une annonce 'deleted' n'est jamais restaurée (409) — les boutons sont
 *   remplacés par une explication.
 *
 * Depuis le CP2.5 (D65), le détail liste aussi les SIGNALEMENTS liés à
 * l'annonce (motif, message, statut, auteur) — miroir de PostDetailAdmin.
 */

import { useEffect, useState } from 'react'
import { adminGetListing, adminSetListingStatus, toErrorMessage } from './api'
import type {
  AdminListingCard,
  AdminListingDetail,
  AdminSettableListingStatus,
  ExchangePref,
} from './api'
import {
  Avatar,
  ListingFamilyBadge,
  ListingStatusBadge,
  ModerationLevelBadge,
  REPORT_REASON_LABELS,
  ReportStatusBadge,
  formatDateTime,
  formatListingValue,
} from './ui'

type DetailState =
  | { kind: 'loading' }
  | { kind: 'success'; listing: AdminListingDetail }
  | { kind: 'error'; message: string }

interface ListingDetailAdminProps {
  listingId: string
  /** Ferme le panneau. */
  onClose: () => void
  /** Prévient la vue appelante qu'une annonce a changé (rafraîchit sa liste). */
  onListingUpdated: (listing: AdminListingCard) => void
}

/** Libellés français des préférences d'échange. */
const EXCHANGE_PREF_LABELS: Record<ExchangePref, string> = {
  goods: 'Biens',
  services: 'Services',
  money: 'Argent',
  open: 'Ouvert',
}

export default function ListingDetailAdmin({
  listingId,
  onClose,
  onListingUpdated,
}: ListingDetailAdminProps) {
  const [state, setState] = useState<DetailState>({ kind: 'loading' })
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    setActionError(null)

    adminGetListing(listingId, controller.signal)
      .then((listing) => setState({ kind: 'success', listing }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: toErrorMessage(caught) })
      })

    return () => controller.abort()
  }, [listingId])

  /** Masque ou republie l'annonce après confirmation explicite. */
  async function applyStatus(
    listing: AdminListingDetail,
    status: AdminSettableListingStatus,
  ) {
    const question =
      status === 'hidden'
        ? `Masquer l'annonce « ${listing.title} » ? Elle disparaîtra de ` +
          "l'annuaire et du détail public (masquage réversible)."
        : `Réactiver l'annonce « ${listing.title} » ?`
    if (!window.confirm(question)) return

    setActing(true)
    setActionError(null)
    try {
      const updated = await adminSetListingStatus(listing.id, status)
      // Le PATCH renvoie un LISTING_CARD : on met à jour le statut affiché sans
      // recharger tout le détail (les autres champs sont inchangés).
      setState({ kind: 'success', listing: { ...listing, status: updated.status } })
      onListingUpdated(updated)
    } catch (caught) {
      // 400 (statut interdit) et 409 (annonce supprimée) portent déjà un
      // message français propre renvoyé par l'API.
      setActionError(toErrorMessage(caught))
    } finally {
      setActing(false)
    }
  }

  return (
    <aside className="card detail-panel" aria-label="Détail de l'annonce">
      <div className="detail-header">
        <h3 className="card-title">Détail de l'annonce</h3>
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
            <ListingFamilyBadge family={state.listing.listingType} />
            <ListingStatusBadge status={state.listing.status} />
            <ModerationLevelBadge level={state.listing.category.moderationLevel} />
            {state.listing.openReportsCount > 0 && (
              <span className="badge badge--error">
                {state.listing.openReportsCount} signalement
                {state.listing.openReportsCount > 1 ? 's' : ''} ouvert
                {state.listing.openReportsCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="detail-identity">
            <Avatar
              displayName={state.listing.owner.displayName}
              avatarUrl={state.listing.owner.avatarUrl}
            />
            <div>
              <p className="detail-name">{state.listing.owner.displayName}</p>
              <p className="detail-email">
                {state.listing.owner.city ?? 'Commune non renseignée'}
              </p>
            </div>
          </div>

          <p className="post-title">{state.listing.title}</p>
          {state.listing.description !== '' && (
            <p className="post-body">{state.listing.description}</p>
          )}

          {state.listing.media.length > 0 && (
            <div className="detail-media">
              {state.listing.media.map((media, index) => (
                <a
                  key={`${media.url}-${index}`}
                  className="media-thumb-link"
                  href={media.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Ouvrir le média dans un nouvel onglet"
                >
                  <img
                    className="media-thumb"
                    src={media.thumbnailUrl ?? media.url}
                    alt={`Média ${index + 1} de l'annonce`}
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          )}

          {state.listing.tags.length > 0 && (
            <div className="listing-tags">
              {state.listing.tags.map((tag) => (
                <span key={tag.slug} className="badge badge--neutral">
                  {tag.labelFr}
                </span>
              ))}
            </div>
          )}

          <dl className="detail-rows">
            <div className="detail-row">
              <dt>Identifiant</dt>
              <dd>
                <code>{state.listing.id}</code>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Slug public</dt>
              <dd>
                <code>{state.listing.urlSlug}</code>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Catégorie</dt>
              <dd>{state.listing.category.labelFr}</dd>
            </div>
            <div className="detail-row">
              <dt>Sous-catégorie</dt>
              <dd>{state.listing.subcategory.labelFr}</dd>
            </div>
            <div className="detail-row">
              <dt>Valeur</dt>
              <dd>
                {formatListingValue(
                  state.listing.valueKind,
                  state.listing.valueMin,
                  state.listing.valueMax,
                  state.listing.currency,
                )}
              </dd>
            </div>
            <div className="detail-row">
              <dt>Échanges acceptés</dt>
              <dd>
                {state.listing.exchangePrefs
                  .map((pref) => EXCHANGE_PREF_LABELS[pref])
                  .join(', ') || '—'}
              </dd>
            </div>
            <div className="detail-row">
              <dt>Commune</dt>
              <dd>{state.listing.city}</dd>
            </div>
            <div className="detail-row">
              <dt>Localisation</dt>
              <dd>
                {state.listing.location
                  ? `${state.listing.location.lat.toFixed(4)}, ${state.listing.location.lng.toFixed(4)}`
                  : '—'}
              </dd>
            </div>
            <div className="detail-row">
              <dt>Créée le</dt>
              <dd>{formatDateTime(state.listing.createdAt)}</dd>
            </div>
            <div className="detail-row">
              <dt>Modifiée le</dt>
              <dd>{formatDateTime(state.listing.updatedAt)}</dd>
            </div>
          </dl>

          {state.listing.externalLinks.length > 0 && (
            <section aria-label="Liens externes">
              <h4 className="detail-section-title">Liens externes</h4>
              <ul className="listing-links">
                {state.listing.externalLinks.map((link, index) => (
                  <li key={`${link.url}-${index}`}>
                    <a
                      className="camera-link"
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.label || link.url} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state.listing.reports.length > 0 && (
            <section aria-label="Signalements liés">
              <h4 className="detail-section-title">Signalements liés</h4>
              <ul className="report-list">
                {state.listing.reports.map((report) => (
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

          {state.listing.status === 'active' && (
            <button
              type="button"
              className="button-danger"
              disabled={acting}
              onClick={() => void applyStatus(state.listing, 'hidden')}
            >
              {acting ? 'En cours…' : 'Masquer'}
            </button>
          )}
          {state.listing.status === 'hidden' && (
            <button
              type="button"
              className="button-primary"
              disabled={acting}
              onClick={() => void applyStatus(state.listing, 'active')}
            >
              {acting ? 'En cours…' : 'Réactiver'}
            </button>
          )}
          {state.listing.status === 'deleted' && (
            <p className="muted detail-locked">
              Annonce supprimée (propriétaire ou RGPD) : statut définitif.
            </p>
          )}
        </div>
      )}
    </aside>
  )
}

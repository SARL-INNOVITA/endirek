/**
 * Panneau détail d'une publication (GET /api/v1/admin/posts/:id) avec les
 * actions de modération « Masquer » / « Réactiver »
 * (PATCH /api/v1/admin/posts/:id/status).
 *
 * Règles reflétées ici (imposées par l'API) :
 * - seuls 'active' et 'hidden' sont posables par le backoffice : la
 *   suppression appartient à l'auteur ou au flux RGPD (400 API) ;
 * - une publication 'deleted' n'est jamais restaurée (409 API) — les
 *   boutons sont masqués d'emblée avec une explication.
 *
 * Le panneau est aussi ouvert depuis la vue Signalements (bouton « Voir la
 * publication ») : il affiche les signalements liés à la publication.
 */

import { useEffect, useState } from 'react'
import { adminGetPost, adminSetPostStatus, toErrorMessage } from './api'
import type {
  AdminFeedPost,
  AdminPostDetail as AdminPostDetailData,
  AdminSettablePostStatus,
} from './api'
import {
  Avatar,
  PostStatusBadge,
  REPORT_REASON_LABELS,
  ReportStatusBadge,
  TypeBadge,
  formatDateTime,
  usePostTypes,
} from './ui'

type DetailState =
  | { kind: 'loading' }
  | { kind: 'success'; post: AdminPostDetailData }
  | { kind: 'error'; message: string }

interface PostDetailAdminProps {
  postId: string
  /** Ferme le panneau. */
  onClose: () => void
  /** Prévient la vue appelante qu'une publication a changé (rafraîchit sa liste). */
  onPostUpdated: (post: AdminFeedPost) => void
}

export default function PostDetailAdmin({
  postId,
  onClose,
  onPostUpdated,
}: PostDetailAdminProps) {
  const [state, setState] = useState<DetailState>({ kind: 'loading' })
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const { typesBySlug } = usePostTypes()

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    setActionError(null)

    adminGetPost(postId, controller.signal)
      .then((post) => setState({ kind: 'success', post }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: toErrorMessage(caught) })
      })

    return () => controller.abort()
  }, [postId])

  /** Masque ou republie la publication après confirmation explicite. */
  async function applyStatus(
    post: AdminPostDetailData,
    status: AdminSettablePostStatus,
  ) {
    const label = post.title ?? excerpt(post.body, 60)
    const question =
      status === 'hidden'
        ? `Masquer la publication « ${label} » ? Elle disparaîtra du fil et de la carte.`
        : `Réactiver la publication « ${label} » ?`
    if (!window.confirm(question)) return

    setActing(true)
    setActionError(null)
    try {
      const updated = await adminSetPostStatus(post.id, status)
      // Le PATCH renvoie le FEED_POST sans les signalements liés : on les
      // conserve tels que chargés (le statut d'un post ne les modifie pas).
      setState({ kind: 'success', post: { ...updated, reports: post.reports } })
      onPostUpdated(updated)
    } catch (caught) {
      // 400 (statut interdit) et 409 (publication supprimée) portent déjà
      // un message français propre renvoyé par l'API.
      setActionError(toErrorMessage(caught))
    } finally {
      setActing(false)
    }
  }

  return (
    <aside className="card detail-panel" aria-label="Détail de la publication">
      <div className="detail-header">
        <h3 className="card-title">Détail de la publication</h3>
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
            <TypeBadge
              slug={state.post.typeSlug}
              type={typesBySlug.get(state.post.typeSlug)}
            />
            <PostStatusBadge status={state.post.status} />
          </div>

          <div className="detail-identity">
            <Avatar
              displayName={state.post.author.displayName}
              avatarUrl={state.post.author.avatarUrl}
            />
            <div>
              <p className="detail-name">{state.post.author.displayName}</p>
              <p className="detail-email">
                {state.post.author.city ?? 'Commune non renseignée'}
              </p>
            </div>
          </div>

          {state.post.title && <p className="post-title">{state.post.title}</p>}
          <p className="post-body">{state.post.body}</p>

          {state.post.media.length > 0 && (
            <div className="detail-media">
              {state.post.media.map((media, index) => (
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
                    alt={`Média ${index + 1} de la publication`}
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          )}

          <dl className="detail-rows">
            <div className="detail-row">
              <dt>Identifiant</dt>
              <dd>
                <code>{state.post.id}</code>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Slug public</dt>
              <dd>
                <code>{state.post.urlSlug}</code>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Commune</dt>
              <dd>{state.post.city ?? '—'}</dd>
            </div>
            <div className="detail-row">
              <dt>Localisation</dt>
              <dd>
                {state.post.location
                  ? `${state.post.location.lat.toFixed(4)}, ${state.post.location.lng.toFixed(4)}`
                  : '—'}
              </dd>
            </div>
            <div className="detail-row">
              <dt>Visible carte jusqu'au</dt>
              <dd>
                {state.post.mapExpiresAt
                  ? formatDateTime(state.post.mapExpiresAt)
                  : '—'}
              </dd>
            </div>
            <div className="detail-row">
              <dt>Réactions</dt>
              <dd>{state.post.reactionCount}</dd>
            </div>
            <div className="detail-row">
              <dt>Commentaires</dt>
              <dd>{state.post.commentCount}</dd>
            </div>
            <div className="detail-row">
              <dt>Enregistrements</dt>
              <dd>{state.post.saveCount}</dd>
            </div>
            <div className="detail-row">
              <dt>Signalements ouverts</dt>
              <dd>
                {state.post.openReportsCount > 0 ? (
                  <span className="badge badge--error">
                    {state.post.openReportsCount}
                  </span>
                ) : (
                  '0'
                )}
              </dd>
            </div>
            <div className="detail-row">
              <dt>Créée le</dt>
              <dd>{formatDateTime(state.post.createdAt)}</dd>
            </div>
            <div className="detail-row">
              <dt>Modifiée le</dt>
              <dd>{formatDateTime(state.post.updatedAt)}</dd>
            </div>
          </dl>

          <section aria-label="Signalements liés">
            <h4 className="detail-section-title">
              Signalements liés ({state.post.reports.length})
            </h4>
            {state.post.reports.length === 0 ? (
              <p className="muted">Aucun signalement sur cette publication.</p>
            ) : (
              <ul className="report-list">
                {state.post.reports.map((report) => (
                  <li key={report.id} className="report-item">
                    <div className="report-item-head">
                      <span className="report-reason">
                        {REPORT_REASON_LABELS[report.reasonCode]}
                      </span>
                      <ReportStatusBadge status={report.status} />
                    </div>
                    <p className="report-item-meta">
                      par {report.reporter.displayName} ·{' '}
                      {formatDateTime(report.createdAt)}
                    </p>
                    {report.message !== '' && (
                      <p className="report-item-message">{report.message}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}

          {state.post.status === 'active' && (
            <button
              type="button"
              className="button-danger"
              disabled={acting}
              onClick={() => void applyStatus(state.post, 'hidden')}
            >
              {acting ? 'En cours…' : 'Masquer'}
            </button>
          )}
          {state.post.status === 'hidden' && (
            <button
              type="button"
              className="button-primary"
              disabled={acting}
              onClick={() => void applyStatus(state.post, 'active')}
            >
              {acting ? 'En cours…' : 'Réactiver'}
            </button>
          )}
          {state.post.status === 'deleted' && (
            <p className="muted detail-locked">
              Publication supprimée (auteur ou RGPD) : statut définitif.
            </p>
          )}
        </div>
      )}
    </aside>
  )
}

/** Tronque un texte pour les messages de confirmation. */
function excerpt(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

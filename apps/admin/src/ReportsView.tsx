/**
 * Vue « Signalements » du backoffice — file de modération alimentée par
 * GET /api/v1/admin/reports (tri antéchronologique côté API).
 *
 * - filtre par statut, « Ouverts » par défaut (la file de travail) ;
 * - panneau détail au clic : motif, message, extrait de la cible, décisions
 *   « Marquer examiné » / « Action prise » / « Rejeter »
 *   (PATCH /api/v1/admin/reports/:id) avec note de résolution facultative ;
 * - si la cible est une publication : bouton « Voir la publication » qui
 *   ouvre le panneau PostDetailAdmin (depuis lequel on peut la masquer).
 *
 * Rappel d'équivalence documentée côté API : le statut « open » correspond
 * au « pending » de la spécification produit.
 */

import { useEffect, useState } from 'react'
import {
  adminHandleReport,
  adminListReports,
  adminSetCommentStatus,
  toErrorMessage,
} from './api'
import type {
  AdminFeedPost,
  AdminCommentView,
  AdminReport,
  CommentStatus,
  PagedAdminReports,
  ReportCommentTarget,
  ReportDecision,
  ReportPostTarget,
  ReportStatus,
  ReportTargetType,
} from './api'
import PostDetailAdmin from './PostDetailAdmin'
import {
  Avatar,
  PostStatusBadge,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  ReportStatusBadge,
  formatDateTime,
} from './ui'

/** Taille de page du backoffice (identique aux autres vues). */
const PAGE_SIZE = 20

/** '' = tous les statuts. Par défaut : 'open' (la file à traiter). */
type StatusFilter = '' | ReportStatus
type TargetFilter = '' | ReportTargetType

type ListState =
  | { kind: 'loading' }
  | { kind: 'success'; page: PagedAdminReports }
  | { kind: 'error'; message: string }

/** Libellés de confirmation par décision de modération. */
const DECISION_CONFIRMATIONS: Record<ReportDecision, string> = {
  reviewed: 'Marquer ce signalement comme examiné ?',
  action_taken: 'Marquer « action prise » sur ce signalement ?',
  dismissed: 'Rejeter ce signalement ?',
}

interface ReportsViewProps {
  /** Recharge le compteur de signalements ouverts affiché dans l'en-tête. */
  onOpenCountChanged: () => void
}

export default function ReportsView({ onOpenCountChanged }: ReportsViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('')
  const [offset, setOffset] = useState(0)
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const [selected, setSelected] = useState<AdminReport | null>(null)
  /** Publication ouverte depuis « Voir la publication » (remplace le panneau). */
  const [viewedPostId, setViewedPostId] = useState<string | null>(null)
  // Incrémenté après un traitement ou une modération pour recharger la page.
  const [refreshCount, setRefreshCount] = useState(0)

  // Chargement de la page courante (annulé si le filtre change entre-temps).
  useEffect(() => {
    const controller = new AbortController()
    setList({ kind: 'loading' })

    adminListReports(
      {
        status: statusFilter || undefined,
        targetType: targetFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      },
      controller.signal,
    )
      .then((page) => {
        setList({ kind: 'success', page })
        // Garde le panneau synchronisé avec la ligne rechargée (statut,
        // note…) sans le fermer s'il a quitté la page courante.
        setSelected((current) => {
          if (!current) return null
          return page.items.find((item) => item.id === current.id) ?? current
        })
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        // Le 401 est traité de façon centralisée par api.ts (retour au login).
        setList({ kind: 'error', message: toErrorMessage(caught) })
      })

    return () => controller.abort()
  }, [statusFilter, targetFilter, offset, refreshCount])

  /** Un signalement vient d'être traité : liste + badge d'en-tête à jour. */
  function handleReportHandled(updated: AdminReport) {
    setSelected(updated)
    setRefreshCount((count) => count + 1)
    onOpenCountChanged()
  }

  /** La publication vue a été modérée : l'extrait de cible doit refléter
   * son nouveau statut. */
  function handlePostUpdated(_updated: AdminFeedPost) {
    setRefreshCount((count) => count + 1)
  }

  function handleCommentUpdated(updated: AdminCommentView) {
    setSelected((current) => {
      if (
        !current ||
        current.targetType !== 'comment' ||
        current.target?.id !== updated.id
      ) {
        return current
      }
      return {
        ...current,
        target: {
          ...current.target,
          body: updated.body,
          status: updated.status,
        },
      }
    })
    setRefreshCount((count) => count + 1)
  }

  function selectReport(report: AdminReport) {
    setSelected(report)
    setViewedPostId(null)
  }

  const loading = list.kind === 'loading'
  const total = list.kind === 'success' ? list.page.total : 0
  const hasPrevious = offset > 0
  const hasNext = list.kind === 'success' && offset + PAGE_SIZE < total
  const panelOpen = selected !== null || viewedPostId !== null

  return (
    <div className={panelOpen ? 'view-layout view-layout--with-detail' : 'view-layout'}>
      <section className="card" aria-labelledby="reports-title">
        <div className="card-header">
          <h2 id="reports-title" className="card-title">
            Signalements
          </h2>
          {list.kind === 'success' && (
            <span className="badge badge--neutral">
              {total} signalement{total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="users-toolbar">
          <select
            className="users-status-filter"
            aria-label="Filtrer par statut de signalement"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter)
              setOffset(0)
            }}
          >
            <option value="open">Ouverts</option>
            <option value="reviewed">Examinés</option>
            <option value="action_taken">Action prise</option>
            <option value="dismissed">Rejetés</option>
            <option value="">Tous les statuts</option>
          </select>
          <select
            className="users-status-filter"
            aria-label="Filtrer par cible"
            value={targetFilter}
            onChange={(event) => {
              setTargetFilter(event.target.value as TargetFilter)
              setOffset(0)
            }}
          >
            <option value="">Toutes les cibles</option>
            <option value="post">Publications</option>
            <option value="comment">Commentaires</option>
            <option value="user">Profils</option>
          </select>
        </div>

        {list.kind === 'loading' && <p className="muted">Chargement…</p>}

        {list.kind === 'error' && (
          <p className="form-error" role="alert">
            {list.message}
          </p>
        )}

        {list.kind === 'success' && list.page.items.length === 0 && (
          <p className="muted">
            {statusFilter === 'open'
              ? 'Aucun signalement ouvert : la file est vide.'
              : 'Aucun signalement ne correspond à ce filtre.'}
          </p>
        )}

        {list.kind === 'success' && list.page.items.length > 0 && (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col">Cible</th>
                  <th scope="col">Motif</th>
                  <th scope="col">Signalé par</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Date</th>
                </tr>
              </thead>
              <tbody>
                {list.page.items.map((report) => (
                  <tr
                    key={report.id}
                    className={
                      report.id === selected?.id ? 'user-row user-row--selected' : 'user-row'
                    }
                    onClick={() => selectReport(report)}
                  >
                    <td className="cell-excerpt" title={targetText(report)}>
                      <span className="badge badge--neutral target-kind">
                        {targetKindLabel(report)}
                      </span>{' '}
                      <span className="cell-muted">{targetText(report)}</span>
                    </td>
                    <td>{REPORT_REASON_LABELS[report.reasonCode]}</td>
                    <td>
                      <span className="user-cell">
                        <Avatar
                          displayName={report.reporter.displayName}
                          avatarUrl={report.reporter.avatarUrl}
                        />
                        <span className="user-name">{report.reporter.displayName}</span>
                      </span>
                    </td>
                    <td>
                      <ReportStatusBadge status={report.status} />
                    </td>
                    <td className="cell-muted">{formatDateTime(report.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="users-pagination">
          <button
            type="button"
            className="button-ghost"
            disabled={!hasPrevious || loading}
            onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
          >
            ← Précédent
          </button>
          <span className="muted">
            {list.kind === 'success' && total > 0
              ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} sur ${total}`
              : '—'}
          </span>
          <button
            type="button"
            className="button-ghost"
            disabled={!hasNext || loading}
            onClick={() => setOffset((current) => current + PAGE_SIZE)}
          >
            Suivant →
          </button>
        </div>
      </section>

      {viewedPostId ? (
        <PostDetailAdmin
          postId={viewedPostId}
          onClose={() => setViewedPostId(null)}
          onPostUpdated={handlePostUpdated}
        />
      ) : (
        selected && (
          <ReportPanel
            report={selected}
            onClose={() => setSelected(null)}
            onHandled={handleReportHandled}
            onViewPost={(postId) => setViewedPostId(postId)}
            onCommentModerated={handleCommentUpdated}
          />
        )
      )}
    </div>
  )
}

// ─── Panneau détail / actions d'un signalement ───────────────────────────────

interface ReportPanelProps {
  report: AdminReport
  onClose: () => void
  /** Décision enregistrée : la vue recharge la liste et le badge d'en-tête. */
  onHandled: (updated: AdminReport) => void
  /** Ouvre le panneau publication (cible de type post uniquement). */
  onViewPost: (postId: string) => void
  onCommentModerated: (updated: AdminCommentView) => void
}

function ReportPanel({
  report,
  onClose,
  onHandled,
  onViewPost,
  onCommentModerated,
}: ReportPanelProps) {
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [commentActing, setCommentActing] = useState<CommentStatus | null>(null)
  const [commentError, setCommentError] = useState<string | null>(null)

  // Repart d'une note vierge quand on passe à un autre signalement.
  useEffect(() => {
    setNote('')
    setActionError(null)
  }, [report.id])

  /** Extrait de publication si la cible en est une (sinon null). */
  const postTarget =
    report.targetType === 'post' && report.target
      ? (report.target as ReportPostTarget)
      : null
  const commentTarget =
    report.targetType === 'comment' && report.target
      ? (report.target as ReportCommentTarget)
      : null

  /** Enregistre une décision de modération après confirmation. */
  async function applyDecision(decision: ReportDecision) {
    if (!window.confirm(DECISION_CONFIRMATIONS[decision])) return

    setActing(true)
    setActionError(null)
    try {
      const trimmedNote = note.trim()
      const updated = await adminHandleReport(
        report.id,
        decision,
        trimmedNote === '' ? undefined : trimmedNote,
      )
      onHandled(updated)
    } catch (caught) {
      setActionError(toErrorMessage(caught))
    } finally {
      setActing(false)
    }
  }

  async function applyCommentStatus(status: CommentStatus) {
    if (!commentTarget) return
    const labels: Record<CommentStatus, string> = {
      active: 'Réactiver ce commentaire ?',
      hidden: 'Masquer ce commentaire ?',
      deleted: 'Supprimer ce commentaire en soft-delete ?',
    }
    if (!window.confirm(labels[status])) return

    setCommentActing(status)
    setCommentError(null)
    try {
      const updated = await adminSetCommentStatus(commentTarget.id, status)
      onCommentModerated(updated)
    } catch (caught) {
      setCommentError(toErrorMessage(caught))
    } finally {
      setCommentActing(null)
    }
  }

  return (
    <aside className="card detail-panel" aria-label="Détail du signalement">
      <div className="detail-header">
        <h3 className="card-title">Détail du signalement</h3>
        <button type="button" className="button-ghost" onClick={onClose}>
          Fermer
        </button>
      </div>

      <div className="detail-body">
        <div className="detail-badges">
          <span className="badge badge--info">
            {REPORT_REASON_LABELS[report.reasonCode]}
          </span>
          <ReportStatusBadge status={report.status} />
        </div>

        <div className="detail-identity">
          <Avatar
            displayName={report.reporter.displayName}
            avatarUrl={report.reporter.avatarUrl}
          />
          <div>
            <p className="detail-name">{report.reporter.displayName}</p>
            <p className="detail-email">
              Signalé le {formatDateTime(report.createdAt)}
            </p>
          </div>
        </div>

        {report.message !== '' && (
          <p className="detail-bio">{report.message}</p>
        )}

        <section aria-label="Cible du signalement">
          <h4 className="detail-section-title">Cible ({targetKindLabel(report)})</h4>
          {report.target === null ? (
            <p className="muted">Cible introuvable.</p>
          ) : (
            <div className="target-extract">
              {postTarget?.title && (
                <p className="excerpt-title">{postTarget.title}</p>
              )}
              <p className="target-extract-body">{report.target.body}</p>
              <div className="detail-badges">
                <PostStatusBadge status={report.target.status} />
              </div>
              {postTarget && (
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => onViewPost(postTarget.id)}
                >
                  Voir la publication
                </button>
              )}
              {commentTarget && (
                <div className="report-actions">
                  {commentTarget.status === 'active' && (
                    <button
                      type="button"
                      className="button-ghost"
                      disabled={commentActing !== null}
                      onClick={() => void applyCommentStatus('hidden')}
                    >
                      {commentActing === 'hidden' ? 'En cours…' : 'Masquer'}
                    </button>
                  )}
                  {commentTarget.status === 'hidden' && (
                    <button
                      type="button"
                      className="button-primary"
                      disabled={commentActing !== null}
                      onClick={() => void applyCommentStatus('active')}
                    >
                      {commentActing === 'active' ? 'En cours…' : 'Réactiver'}
                    </button>
                  )}
                  {commentTarget.status !== 'deleted' && (
                    <button
                      type="button"
                      className="button-danger"
                      disabled={commentActing !== null}
                      onClick={() => void applyCommentStatus('deleted')}
                    >
                      {commentActing === 'deleted' ? 'En cours…' : 'Soft-delete'}
                    </button>
                  )}
                  {commentTarget.status === 'deleted' && (
                    <p className="muted">Commentaire déjà supprimé.</p>
                  )}
                </div>
              )}
              {commentError && (
                <p className="form-error" role="alert">
                  {commentError}
                </p>
              )}
            </div>
          )}
        </section>

        {report.handledAt && (
          <dl className="detail-rows">
            <div className="detail-row">
              <dt>Traité le</dt>
              <dd>{formatDateTime(report.handledAt)}</dd>
            </div>
            <div className="detail-row">
              <dt>Décision</dt>
              <dd>{REPORT_STATUS_LABELS[report.status]}</dd>
            </div>
            {report.resolutionNote && (
              <div className="detail-row">
                <dt>Note</dt>
                <dd>{report.resolutionNote}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="form-field">
          <label htmlFor="resolution-note">Note de résolution (facultative)</label>
          <textarea
            id="resolution-note"
            className="resolution-note"
            rows={3}
            maxLength={500}
            placeholder="Contexte de la décision, mesure prise…"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={acting}
          />
        </div>

        {actionError && (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        )}

        <div className="report-actions">
          <button
            type="button"
            className="button-primary"
            disabled={acting}
            onClick={() => void applyDecision('reviewed')}
          >
            Marquer examiné
          </button>
          <button
            type="button"
            className="button-primary"
            disabled={acting}
            onClick={() => void applyDecision('action_taken')}
          >
            Action prise
          </button>
          <button
            type="button"
            className="button-danger"
            disabled={acting}
            onClick={() => void applyDecision('dismissed')}
          >
            Rejeter
          </button>
        </div>
      </div>
    </aside>
  )
}

// ─── Aides d'affichage ───────────────────────────────────────────────────────

/** Libellé français du type de cible d'un signalement. */
function targetKindLabel(report: AdminReport): string {
  switch (report.targetType) {
    case 'post':
      return 'Publication'
    case 'comment':
      return 'Commentaire'
    case 'user':
      return 'Profil'
  }
}

/** Texte d'extrait de la cible pour la colonne « Cible » du tableau. */
function targetText(report: AdminReport): string {
  if (report.target === null) return 'Cible introuvable'
  if (report.targetType === 'post') {
    const target = report.target as ReportPostTarget
    return target.title ? `${target.title} — ${target.body}` : target.body
  }
  return report.target.body
}

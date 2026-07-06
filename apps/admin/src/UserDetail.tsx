/**
 * Panneau détail d'un compte (GET /api/v1/admin/users/:id) avec action
 * « Suspendre » / « Réactiver » (PATCH /api/v1/admin/users/:id/status).
 *
 * Règles reflétées ici (imposées par l'API) :
 * - un super administrateur est intouchable (403 → message clair) ;
 * - un compte supprimé (flux RGPD) n'est jamais réactivable (409).
 */

import { useEffect, useState } from 'react'
import { getUser, toErrorMessage, updateUserStatus } from './api'
import type { AdminSettableStatus, FullProfile } from './api'
import { Avatar, RoleBadge, StatusBadge, formatDate } from './ui'

type DetailState =
  | { kind: 'loading' }
  | { kind: 'success'; profile: FullProfile }
  | { kind: 'error'; message: string }

interface UserDetailProps {
  userId: string
  /** Ferme le panneau. */
  onClose: () => void
  /** Prévient la vue liste qu'un profil a changé (rafraîchit le tableau). */
  onUserUpdated: (profile: FullProfile) => void
}

export default function UserDetail({ userId, onClose, onUserUpdated }: UserDetailProps) {
  const [state, setState] = useState<DetailState>({ kind: 'loading' })
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    setActionError(null)

    getUser(userId, controller.signal)
      .then((profile) => setState({ kind: 'success', profile }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: toErrorMessage(caught) })
      })

    return () => controller.abort()
  }, [userId])

  /** Suspend ou réactive le compte après confirmation explicite. */
  async function applyStatus(profile: FullProfile, status: AdminSettableStatus) {
    const question =
      status === 'suspended'
        ? `Suspendre le compte « ${profile.displayName} » ? Il ne pourra plus se connecter.`
        : `Réactiver le compte « ${profile.displayName} » ?`
    if (!window.confirm(question)) return

    setActing(true)
    setActionError(null)
    try {
      const updated = await updateUserStatus(profile.id, status)
      setState({ kind: 'success', profile: updated })
      onUserUpdated(updated)
    } catch (caught) {
      // 403 (cible super admin) et 409 (compte supprimé) portent déjà un
      // message français propre renvoyé par l'API.
      setActionError(toErrorMessage(caught))
    } finally {
      setActing(false)
    }
  }

  return (
    <aside className="card detail-panel" aria-label="Détail du compte">
      <div className="detail-header">
        <h3 className="card-title">Détail du compte</h3>
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
        <DetailContent
          profile={state.profile}
          acting={acting}
          actionError={actionError}
          onApplyStatus={(status) => void applyStatus(state.profile, status)}
        />
      )}
    </aside>
  )
}

interface DetailContentProps {
  profile: FullProfile
  acting: boolean
  actionError: string | null
  onApplyStatus: (status: AdminSettableStatus) => void
}

function DetailContent({ profile, acting, actionError, onApplyStatus }: DetailContentProps) {
  // Le backoffice ne suspend ni un super admin (403 API) ni un compte
  // supprimé (409 API — statut RGPD définitif) : boutons masqués d'emblée.
  const canModerate = profile.role !== 'super_admin' && profile.status !== 'deleted'

  return (
    <div className="detail-body">
      <div className="detail-identity">
        <Avatar displayName={profile.displayName} avatarUrl={profile.avatarUrl} size="large" />
        <div>
          <p className="detail-name">{profile.displayName}</p>
          <p className="detail-email">{profile.email}</p>
          <div className="detail-badges">
            <RoleBadge role={profile.role} />
            <StatusBadge status={profile.status} />
          </div>
        </div>
      </div>

      {profile.bio !== '' && <p className="detail-bio">{profile.bio}</p>}

      <dl className="detail-rows">
        <div className="detail-row">
          <dt>Identifiant</dt>
          <dd>
            <code>{profile.id}</code>
          </dd>
        </div>
        <div className="detail-row">
          <dt>Ville</dt>
          <dd>{profile.city ?? '—'}</dd>
        </div>
        <div className="detail-row">
          <dt>Abonnés</dt>
          <dd>{profile.followersCount}</dd>
        </div>
        <div className="detail-row">
          <dt>Abonnements</dt>
          <dd>{profile.followingCount}</dd>
        </div>
        <div className="detail-row">
          <dt>Publications</dt>
          <dd>{profile.postsCount}</dd>
        </div>
        <div className="detail-row">
          <dt>Inscrit le</dt>
          <dd>{formatDate(profile.createdAt)}</dd>
        </div>
      </dl>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      {canModerate ? (
        profile.status === 'active' ? (
          <button
            type="button"
            className="button-danger"
            disabled={acting}
            onClick={() => onApplyStatus('suspended')}
          >
            {acting ? 'En cours…' : 'Suspendre'}
          </button>
        ) : (
          <button
            type="button"
            className="button-primary"
            disabled={acting}
            onClick={() => onApplyStatus('active')}
          >
            {acting ? 'En cours…' : 'Réactiver'}
          </button>
        )
      ) : (
        <p className="muted detail-locked">
          {profile.role === 'super_admin'
            ? 'Le statut d’un super administrateur ne peut pas être modifié.'
            : 'Compte supprimé (RGPD) : statut définitif.'}
        </p>
      )}
    </div>
  )
}

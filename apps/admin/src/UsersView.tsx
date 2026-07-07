/**
 * Vue « Utilisateurs » du backoffice — tableau paginé alimenté par
 * GET /api/v1/admin/users (recherche nom/email avec debounce, filtre statut,
 * pagination limit 20) + panneau détail au clic (UserDetail).
 */

import { useEffect, useState } from 'react'
import { ApiError, listUsers, toErrorMessage } from './api'
import type { FullProfile, PagedUsers, UserRole, UserStatus } from './api'
import UserDetail from './UserDetail'
import { Avatar, RoleBadge, StatusBadge, formatDate } from './ui'

/** Taille de page imposée par le cahier des charges de l'étape 3. */
const PAGE_SIZE = 20

/** Délai du debounce de recherche (simple setTimeout, suffisant ici). */
const SEARCH_DEBOUNCE_MS = 300

/** '' = tous les statuts (pas de filtre envoyé à l'API). */
type StatusFilter = '' | UserStatus
type RoleFilter = '' | UserRole

type ListState =
  | { kind: 'loading' }
  | { kind: 'success'; page: PagedUsers }
  | { kind: 'error'; message: string }

interface UsersViewProps {
  /** Jeton refusé par l'API (401) : App purge la session et réaffiche le login. */
  onSessionExpired: () => void
}

export default function UsersView({ onSessionExpired }: UsersViewProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('')
  const [offset, setOffset] = useState(0)
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Incrémenté après une modération réussie pour recharger la page courante.
  const [refreshCount, setRefreshCount] = useState(0)

  // Debounce de la recherche : on ne déclenche l'appel API qu'après une
  // courte pause de saisie, et on revient en première page.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setOffset(0)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search])

  // Chargement de la page courante (annulé si les filtres changent entre-temps).
  useEffect(() => {
    const controller = new AbortController()
    setList({ kind: 'loading' })

    listUsers(
      {
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      },
      controller.signal,
    )
      .then((page) => setList({ kind: 'success', page }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        if (caught instanceof ApiError && caught.status === 401) {
          onSessionExpired()
          return
        }
        setList({ kind: 'error', message: toErrorMessage(caught) })
      })

    return () => controller.abort()
    // onSessionExpired est stable (useCallback côté App).
  }, [debouncedSearch, statusFilter, roleFilter, offset, refreshCount, onSessionExpired])

  /** Un profil vient d'être modéré : recharge la liste (compteurs, statut…). */
  function handleUserUpdated(_updated: FullProfile) {
    setRefreshCount((count) => count + 1)
  }

  const loading = list.kind === 'loading'
  const total = list.kind === 'success' ? list.page.total : 0
  const hasPrevious = offset > 0
  const hasNext = list.kind === 'success' && offset + PAGE_SIZE < total

  return (
    <div className={selectedId ? 'users-layout users-layout--with-detail' : 'users-layout'}>
      <section className="card users-card" aria-labelledby="users-title">
        <div className="card-header">
          <h2 id="users-title" className="card-title">
            Utilisateurs
          </h2>
          {list.kind === 'success' && (
            <span className="badge badge--neutral">
              {total} compte{total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="users-toolbar">
          <input
            type="search"
            className="users-search"
            placeholder="Rechercher par nom ou email…"
            aria-label="Rechercher par nom ou email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="users-status-filter"
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter)
              setOffset(0)
            }}
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="suspended">Suspendus</option>
            <option value="deleted">Supprimés</option>
          </select>
          <select
            className="users-status-filter"
            aria-label="Filtrer par rôle"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as RoleFilter)
              setOffset(0)
            }}
          >
            <option value="">Tous les rôles</option>
            <option value="user">Utilisateurs</option>
            <option value="moderator">Modérateurs</option>
            <option value="super_admin">Super admins</option>
          </select>
        </div>

        {list.kind === 'loading' && <p className="muted">Chargement…</p>}

        {list.kind === 'error' && (
          <p className="form-error" role="alert">
            {list.message}
          </p>
        )}

        {list.kind === 'success' && list.page.items.length === 0 && (
          <p className="muted">Aucun compte ne correspond à ces critères.</p>
        )}

        {list.kind === 'success' && list.page.items.length > 0 && (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col">Utilisateur</th>
                  <th scope="col">Email</th>
                  <th scope="col">Ville</th>
                  <th scope="col">Rôle</th>
                  <th scope="col">Statut</th>
                  <th scope="col" className="cell-number">
                    Abonnés
                  </th>
                  <th scope="col" className="cell-number">
                    Posts
                  </th>
                  <th scope="col">Inscrit le</th>
                </tr>
              </thead>
              <tbody>
                {list.page.items.map((user) => (
                  <tr
                    key={user.id}
                    className={user.id === selectedId ? 'user-row user-row--selected' : 'user-row'}
                    onClick={() => setSelectedId(user.id)}
                  >
                    <td>
                      <span className="user-cell">
                        <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} />
                        <span className="user-name">{user.displayName}</span>
                      </span>
                    </td>
                    <td className="cell-muted">{user.email}</td>
                    <td className="cell-muted">{user.city ?? '—'}</td>
                    <td>
                      <RoleBadge role={user.role} />
                    </td>
                    <td>
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="cell-number">{user.followersCount}</td>
                    <td className="cell-number">{user.postsCount}</td>
                    <td className="cell-muted">{formatDate(user.createdAt)}</td>
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

      {selectedId && (
        <UserDetail
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onUserUpdated={handleUserUpdated}
        />
      )}
    </div>
  )
}

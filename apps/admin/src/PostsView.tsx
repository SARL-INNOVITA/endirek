/**
 * Vue « Publications » du backoffice — tableau paginé alimenté par
 * GET /api/v1/admin/posts (tous statuts : active, hidden, deleted — audit).
 *
 * - filtres type (référentiel GET /posts/types, chargé une fois) + statut +
 *   recherche titre/corps/nom d'auteur avec debounce ;
 * - pagination limit 20 ;
 * - panneau détail au clic (PostDetailAdmin) avec actions Masquer/Réactiver,
 *   qui rafraîchissent la liste.
 */

import { useEffect, useState } from 'react'
import { adminListPosts, toErrorMessage } from './api'
import type { AdminFeedPost, PagedAdminPosts, PostStatus } from './api'
import PostDetailAdmin from './PostDetailAdmin'
import {
  Avatar,
  PostStatusBadge,
  TypeBadge,
  formatDate,
  usePostTypes,
} from './ui'

/** Taille de page du backoffice (identique à la vue Utilisateurs). */
const PAGE_SIZE = 20

/** Délai du debounce de recherche (simple setTimeout, suffisant ici). */
const SEARCH_DEBOUNCE_MS = 300

/** '' = tous les statuts (pas de filtre envoyé à l'API). */
type StatusFilter = '' | PostStatus
type MapFilter = '' | 'visible' | 'hidden'

type ListState =
  | { kind: 'loading' }
  | { kind: 'success'; page: PagedAdminPosts }
  | { kind: 'error'; message: string }

export default function PostsView() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [mapFilter, setMapFilter] = useState<MapFilter>('')
  const [offset, setOffset] = useState(0)
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Incrémenté après une modération réussie pour recharger la page courante.
  const [refreshCount, setRefreshCount] = useState(0)

  // Référentiel des types : filtre + badges colorés (labelFr, couleur).
  const { types, typesBySlug } = usePostTypes()

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

    adminListPosts(
      {
        typeSlug: typeFilter || undefined,
        status: statusFilter || undefined,
        mapVisible:
          mapFilter === ''
            ? undefined
            : mapFilter === 'visible',
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset,
      },
      controller.signal,
    )
      .then((page) => setList({ kind: 'success', page }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        // Le 401 est traité de façon centralisée par api.ts (retour au login).
        setList({ kind: 'error', message: toErrorMessage(caught) })
      })

    return () => controller.abort()
  }, [debouncedSearch, typeFilter, statusFilter, mapFilter, offset, refreshCount])

  /** Une publication vient d'être modérée : recharge la page courante. */
  function handlePostUpdated(_updated: AdminFeedPost) {
    setRefreshCount((count) => count + 1)
  }

  const loading = list.kind === 'loading'
  const total = list.kind === 'success' ? list.page.total : 0
  const hasPrevious = offset > 0
  const hasNext = list.kind === 'success' && offset + PAGE_SIZE < total

  return (
    <div className={selectedId ? 'view-layout view-layout--with-detail' : 'view-layout'}>
      <section className="card" aria-labelledby="posts-title">
        <div className="card-header">
          <h2 id="posts-title" className="card-title">
            Publications
          </h2>
          {list.kind === 'success' && (
            <span className="badge badge--neutral">
              {total} publication{total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="users-toolbar">
          <input
            type="search"
            className="users-search"
            placeholder="Rechercher dans le titre, le texte ou l'auteur…"
            aria-label="Rechercher dans le titre, le texte ou l'auteur"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="users-status-filter"
            aria-label="Filtrer par type de publication"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value)
              setOffset(0)
            }}
          >
            <option value="">Tous les types</option>
            {(types ?? []).map((type) => (
              <option key={type.slug} value={type.slug}>
                {type.labelFr}
              </option>
            ))}
          </select>
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
            <option value="active">Actives</option>
            <option value="hidden">Masquées</option>
            <option value="deleted">Supprimées</option>
          </select>
          <select
            className="users-status-filter"
            aria-label="Filtrer par visibilité carte"
            value={mapFilter}
            onChange={(event) => {
              setMapFilter(event.target.value as MapFilter)
              setOffset(0)
            }}
          >
            <option value="">Carte : toutes</option>
            <option value="visible">Actuellement sur carte</option>
            <option value="hidden">Hors carte</option>
          </select>
        </div>

        {list.kind === 'loading' && <p className="muted">Chargement…</p>}

        {list.kind === 'error' && (
          <p className="form-error" role="alert">
            {list.message}
          </p>
        )}

        {list.kind === 'success' && list.page.items.length === 0 && (
          <p className="muted">Aucune publication ne correspond à ces critères.</p>
        )}

        {list.kind === 'success' && list.page.items.length > 0 && (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Publication</th>
                  <th scope="col">Auteur</th>
                  <th scope="col">Statut</th>
                  <th scope="col" className="cell-number">
                    Réactions
                  </th>
                  <th scope="col" className="cell-number">
                    Commentaires
                  </th>
                  <th scope="col" className="cell-number">
                    Signalements
                  </th>
                  <th scope="col">Créée le</th>
                </tr>
              </thead>
              <tbody>
                {list.page.items.map((post) => (
                  <tr
                    key={post.id}
                    className={post.id === selectedId ? 'user-row user-row--selected' : 'user-row'}
                    onClick={() => setSelectedId(post.id)}
                  >
                    <td>
                      <TypeBadge slug={post.typeSlug} type={typesBySlug.get(post.typeSlug)} />
                    </td>
                    <td className="cell-excerpt" title={post.title ?? post.body}>
                      {post.title && (
                        <span className="excerpt-title">{post.title} — </span>
                      )}
                      <span className="cell-muted">{post.body}</span>
                    </td>
                    <td>
                      <span className="user-cell">
                        <Avatar
                          displayName={post.author.displayName}
                          avatarUrl={post.author.avatarUrl}
                        />
                        <span className="user-name">{post.author.displayName}</span>
                      </span>
                    </td>
                    <td>
                      <PostStatusBadge status={post.status} />
                    </td>
                    <td className="cell-number">{post.reactionCount}</td>
                    <td className="cell-number">{post.commentCount}</td>
                    <td className="cell-number">
                      {post.openReportsCount > 0 ? (
                        <span className="badge badge--error">
                          {post.openReportsCount}
                        </span>
                      ) : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>
                    <td className="cell-muted">{formatDate(post.createdAt)}</td>
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
        <PostDetailAdmin
          postId={selectedId}
          onClose={() => setSelectedId(null)}
          onPostUpdated={handlePostUpdated}
        />
      )}
    </div>
  )
}

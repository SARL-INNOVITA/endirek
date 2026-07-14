/**
 * Vue « Pages » du backoffice (Lot 3) — tableau paginé des pages
 * restaurants & entreprises alimenté par GET /api/v1/admin/pages
 * (TOUS statuts : active, hidden, deleted — audit).
 *
 * - filtres type restaurant/entreprise + statut + badge vérifié +
 *   « Signalées seulement » (flaggedOnly) + recherche (nom / commune /
 *   propriétaire) avec debounce ;
 * - pagination limit 20 ;
 * - panneau détail au clic (PageDetailAdmin) avec actions
 *   Masquer / Republier et Accorder / Retirer le badge vérifié,
 *   qui rafraîchissent la liste.
 */

import { useEffect, useState } from 'react'
import { adminListPages, toErrorMessage } from './api'
import type {
  AdminPageDetail,
  PagedAdminPages,
  PageStatus,
  PageType,
} from './api'
import PageDetailAdmin from './PageDetailAdmin'
import {
  Avatar,
  PageStatusBadge,
  PageTypeBadge,
  VerifiedBadge,
  formatDate,
} from './ui'

/** Taille de page du backoffice (identique aux autres vues). */
const PAGE_SIZE = 20

/** Délai du debounce de recherche (simple setTimeout, suffisant ici). */
const SEARCH_DEBOUNCE_MS = 300

/** '' = pas de filtre (aucun paramètre envoyé à l'API). */
type TypeFilter = '' | PageType
type StatusFilter = '' | PageStatus
/** Filtre badge vérifié : '' = toutes, 'verified' = vérifiées seulement,
 * 'unverified' = non vérifiées seulement. */
type VerifiedFilter = '' | 'verified' | 'unverified'

type ListState =
  | { kind: 'loading' }
  | { kind: 'success'; page: PagedAdminPages }
  | { kind: 'error'; message: string }

export default function PagesView() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>('')
  /** « Signalées seulement » : pages avec au moins un signalement OUVERT. */
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [offset, setOffset] = useState(0)
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Incrémenté après une modération réussie pour recharger la page courante.
  const [refreshCount, setRefreshCount] = useState(0)

  // Debounce de la recherche : appel API après une courte pause de saisie,
  // et retour en première page.
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

    adminListPages(
      {
        pageType: typeFilter || undefined,
        status: statusFilter || undefined,
        verified:
          verifiedFilter === '' ? undefined : verifiedFilter === 'verified',
        flaggedOnly: flaggedOnly ? true : undefined,
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
  }, [
    debouncedSearch,
    typeFilter,
    statusFilter,
    verifiedFilter,
    flaggedOnly,
    offset,
    refreshCount,
  ])

  /** Une page vient d'être modérée : recharge la page courante. */
  function handlePageUpdated(_updated: AdminPageDetail) {
    setRefreshCount((count) => count + 1)
  }

  const loading = list.kind === 'loading'
  const total = list.kind === 'success' ? list.page.total : 0
  const hasPrevious = offset > 0
  const hasNext = list.kind === 'success' && offset + PAGE_SIZE < total

  return (
    <div
      className={
        selectedId ? 'view-layout view-layout--with-detail' : 'view-layout'
      }
    >
      <section className="card" aria-labelledby="pages-title">
        <div className="card-header">
          <h2 id="pages-title" className="card-title">
            Pages
          </h2>
          {list.kind === 'success' && (
            <span className="badge badge--neutral">
              {total} page{total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="users-toolbar">
          <input
            type="search"
            className="users-search"
            placeholder="Rechercher une page, une commune ou un propriétaire…"
            aria-label="Rechercher une page, une commune ou un propriétaire"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="users-status-filter"
            aria-label="Filtrer par type de page"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as TypeFilter)
              setOffset(0)
            }}
          >
            <option value="">Tous les types</option>
            <option value="restaurant">Restaurants</option>
            <option value="business">Entreprises</option>
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
            aria-label="Filtrer par badge vérifié"
            value={verifiedFilter}
            onChange={(event) => {
              setVerifiedFilter(event.target.value as VerifiedFilter)
              setOffset(0)
            }}
          >
            <option value="">Vérifiées ou non</option>
            <option value="verified">Vérifiées</option>
            <option value="unverified">Non vérifiées</option>
          </select>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(event) => {
                setFlaggedOnly(event.target.checked)
                setOffset(0)
              }}
            />
            Signalées seulement
          </label>
        </div>

        {list.kind === 'loading' && <p className="muted">Chargement…</p>}

        {list.kind === 'error' && (
          <p className="form-error" role="alert">
            {list.message}
          </p>
        )}

        {list.kind === 'success' && list.page.items.length === 0 && (
          <p className="muted">Aucune page ne correspond à ces critères.</p>
        )}

        {list.kind === 'success' && list.page.items.length > 0 && (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col">Page</th>
                  <th scope="col">Type</th>
                  <th scope="col">Propriétaire</th>
                  <th scope="col">Commune</th>
                  <th scope="col">Abonnés</th>
                  <th scope="col">Signalements</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Créée le</th>
                </tr>
              </thead>
              <tbody>
                {list.page.items.map((page) => (
                  <tr
                    key={page.id}
                    className={
                      page.id === selectedId
                        ? 'user-row user-row--selected'
                        : 'user-row'
                    }
                    onClick={() => setSelectedId(page.id)}
                  >
                    <td>
                      <span className="user-cell">
                        <Avatar
                          displayName={page.name}
                          avatarUrl={page.avatarUrl}
                        />
                        <span className="user-name">
                          {page.name}
                          {page.verified && (
                            <>
                              {' '}
                              <VerifiedBadge />
                            </>
                          )}
                        </span>
                      </span>
                    </td>
                    <td>
                      <PageTypeBadge pageType={page.pageType} />
                    </td>
                    <td>
                      <span className="user-cell">
                        <Avatar
                          displayName={page.owner.displayName}
                          avatarUrl={page.owner.avatarUrl}
                        />
                        <span className="user-name">
                          {page.owner.displayName}
                        </span>
                      </span>
                    </td>
                    <td className="cell-muted">{page.city}</td>
                    <td className="cell-number">{page.followersCount}</td>
                    <td>
                      {page.openReportsCount > 0 ? (
                        <span className="badge badge--error">
                          {page.openReportsCount}
                        </span>
                      ) : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>
                    <td>
                      <PageStatusBadge status={page.status} />
                    </td>
                    <td className="cell-muted">{formatDate(page.createdAt)}</td>
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
        <PageDetailAdmin
          pageId={selectedId}
          onClose={() => setSelectedId(null)}
          onPageUpdated={handlePageUpdated}
        />
      )}
    </div>
  )
}

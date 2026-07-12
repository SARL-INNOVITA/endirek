/**
 * Sous-vue « Annonces » de l'onglet Dealplace (CP2.1) — tableau paginé
 * alimenté par GET /api/v1/admin/dealplace/listings (TOUS statuts : active,
 * hidden, deleted — audit).
 *
 * - filtres type bien/service + catégorie + statut + recherche
 *   (titre / description / propriétaire) avec debounce ;
 * - pagination limit 20 ;
 * - panneau détail au clic (ListingDetailAdmin) avec actions
 *   Masquer / Réactiver, qui rafraîchissent la liste.
 *
 * Le filtre catégorie est peuplé par la taxonomie backoffice (catégories
 * actives ET inactives), chargée une fois au montage.
 */

import { useEffect, useMemo, useState } from 'react'
import { adminListListingCategories, adminListListings, toErrorMessage } from './api'
import type {
  AdminListingCard,
  AdminListingCategory,
  ListingFamily,
  ListingStatus,
  PagedAdminListings,
} from './api'
import ListingDetailAdmin from './ListingDetailAdmin'
import {
  Avatar,
  ListingFamilyBadge,
  ListingStatusBadge,
  formatDate,
  formatListingValue,
} from './ui'

/** Taille de page du backoffice (identique aux autres vues). */
const PAGE_SIZE = 20

/** Délai du debounce de recherche (simple setTimeout, suffisant ici). */
const SEARCH_DEBOUNCE_MS = 300

/** '' = pas de filtre (aucun paramètre envoyé à l'API). */
type FamilyFilter = '' | ListingFamily
type StatusFilter = '' | ListingStatus
/** Filtre modération (CP2.5) : '' = toutes, 'flagged' = catégories
 * sensibles/interdites, 'standard' = catégories standard. */
type FlaggedFilter = '' | 'flagged' | 'standard'

type ListState =
  | { kind: 'loading' }
  | { kind: 'success'; page: PagedAdminListings }
  | { kind: 'error'; message: string }

export default function ListingsView() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [flaggedFilter, setFlaggedFilter] = useState<FlaggedFilter>('')
  const [offset, setOffset] = useState(0)
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Incrémenté après une modération réussie pour recharger la page courante.
  const [refreshCount, setRefreshCount] = useState(0)

  // Catégories du filtre (actives ET inactives). En cas d'échec, le menu
  // reste vide : la vue reste utilisable (filtre catégorie simplement absent).
  const [categories, setCategories] = useState<AdminListingCategory[]>([])

  useEffect(() => {
    const controller = new AbortController()
    adminListListingCategories(controller.signal)
      .then(setCategories)
      .catch(() => {
        // Référentiel indisponible : filtre catégorie vide, sans erreur bloquante.
      })
    return () => controller.abort()
  }, [])

  // Quand la famille change, on ne propose que les catégories de cette famille.
  const visibleCategories = useMemo(() => {
    if (familyFilter === '') return categories
    return categories.filter((category) => category.family === familyFilter)
  }, [categories, familyFilter])

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

    adminListListings(
      {
        family: familyFilter || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        flaggedOnly:
          flaggedFilter === '' ? undefined : flaggedFilter === 'flagged',
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
    familyFilter,
    categoryFilter,
    statusFilter,
    flaggedFilter,
    offset,
    refreshCount,
  ])

  /** Une annonce vient d'être modérée : recharge la page courante. */
  function handleListingUpdated(_updated: AdminListingCard) {
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
      <section className="card" aria-labelledby="listings-title">
        <div className="card-header">
          <h2 id="listings-title" className="card-title">
            Annonces
          </h2>
          {list.kind === 'success' && (
            <span className="badge badge--neutral">
              {total} annonce{total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="users-toolbar">
          <input
            type="search"
            className="users-search"
            placeholder="Rechercher dans le titre, la description ou l'auteur…"
            aria-label="Rechercher dans le titre, la description ou l'auteur"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="users-status-filter"
            aria-label="Filtrer par type"
            value={familyFilter}
            onChange={(event) => {
              const next = event.target.value as FamilyFilter
              setFamilyFilter(next)
              // La catégorie sélectionnée peut ne plus appartenir à la famille :
              // on la réinitialise pour éviter un filtre incohérent.
              setCategoryFilter('')
              setOffset(0)
            }}
          >
            <option value="">Tous les types</option>
            <option value="good">Biens</option>
            <option value="service">Services</option>
          </select>
          <select
            className="users-status-filter"
            aria-label="Filtrer par catégorie"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value)
              setOffset(0)
            }}
          >
            <option value="">Toutes les catégories</option>
            {visibleCategories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.labelFr}
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
            aria-label="Filtrer par niveau de modération de la catégorie"
            value={flaggedFilter}
            onChange={(event) => {
              setFlaggedFilter(event.target.value as FlaggedFilter)
              setOffset(0)
            }}
          >
            <option value="">Toute modération</option>
            <option value="flagged">Catégories sensibles</option>
            <option value="standard">Catégories standard</option>
          </select>
        </div>

        {list.kind === 'loading' && <p className="muted">Chargement…</p>}

        {list.kind === 'error' && (
          <p className="form-error" role="alert">
            {list.message}
          </p>
        )}

        {list.kind === 'success' && list.page.items.length === 0 && (
          <p className="muted">Aucune annonce ne correspond à ces critères.</p>
        )}

        {list.kind === 'success' && list.page.items.length > 0 && (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col">Image</th>
                  <th scope="col">Annonce</th>
                  <th scope="col">Type</th>
                  <th scope="col">Catégorie</th>
                  <th scope="col">Auteur</th>
                  <th scope="col">Commune</th>
                  <th scope="col">Valeur</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Signalements</th>
                  <th scope="col">Créée le</th>
                </tr>
              </thead>
              <tbody>
                {list.page.items.map((listing) => (
                  <tr
                    key={listing.id}
                    className={
                      listing.id === selectedId
                        ? 'user-row user-row--selected'
                        : 'user-row'
                    }
                    onClick={() => setSelectedId(listing.id)}
                  >
                    <td>
                      {listing.coverMedia ? (
                        <img
                          className="listing-thumb"
                          src={
                            listing.coverMedia.thumbnailUrl ??
                            listing.coverMedia.url
                          }
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="listing-thumb listing-thumb--empty" aria-hidden="true">
                          —
                        </span>
                      )}
                    </td>
                    <td className="cell-excerpt" title={listing.title}>
                      <span className="excerpt-title">{listing.title}</span>
                    </td>
                    <td>
                      <ListingFamilyBadge family={listing.listingType} />
                    </td>
                    <td className="cell-muted">{listing.category.labelFr}</td>
                    <td>
                      <span className="user-cell">
                        <Avatar
                          displayName={listing.owner.displayName}
                          avatarUrl={listing.owner.avatarUrl}
                        />
                        <span className="user-name">
                          {listing.owner.displayName}
                        </span>
                      </span>
                    </td>
                    <td className="cell-muted">{listing.city}</td>
                    <td className="listing-value">
                      {formatListingValue(
                        listing.valueKind,
                        listing.valueMin,
                        listing.valueMax,
                        listing.currency,
                      )}
                    </td>
                    <td>
                      <ListingStatusBadge status={listing.status} />
                    </td>
                    <td>
                      {listing.openReportsCount > 0 ? (
                        <span className="badge badge--error">
                          {listing.openReportsCount}
                        </span>
                      ) : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>
                    <td className="cell-muted">{formatDate(listing.createdAt)}</td>
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
        <ListingDetailAdmin
          listingId={selectedId}
          onClose={() => setSelectedId(null)}
          onListingUpdated={handleListingUpdated}
        />
      )}
    </div>
  )
}

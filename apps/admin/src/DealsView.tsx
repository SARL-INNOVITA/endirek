/**
 * Sous-vue « Deals » de l'onglet Dealplace (CP2.5 — D66) — tableau paginé
 * alimenté par GET /api/v1/admin/dealplace/deals (TOUS statuts).
 *
 * - le filtre statut s'ouvre sur « disputed » : la file « litiges à
 *   arbitrer » d'abord (même logique que la vue Signalements qui s'ouvre
 *   sur « open ») ;
 * - recherche avec debounce : nom d'une partie, titre d'annonce, ou numéro
 *   exact de deal (saisie numérique) ;
 * - panneau détail au clic (DealDetailAdmin) avec l'arbitrage des litiges,
 *   qui rafraîchit la liste ET le badge du sous-onglet.
 */

import { useEffect, useState } from 'react'
import { adminListDeals, toErrorMessage } from './api'
import type { DealStatus, PagedAdminDeals } from './api'
import DealDetailAdmin from './DealDetailAdmin'
import { Avatar, DealStatusBadge, formatDate } from './ui'

/** Taille de page du backoffice (identique aux autres vues). */
const PAGE_SIZE = 20

/** Délai du debounce de recherche (simple setTimeout, suffisant ici). */
const SEARCH_DEBOUNCE_MS = 300

/** '' = pas de filtre (aucun paramètre envoyé à l'API). */
type StatusFilter = '' | DealStatus

type ListState =
  | { kind: 'loading' }
  | { kind: 'success'; page: PagedAdminDeals }
  | { kind: 'error'; message: string }

interface DealsViewProps {
  /** Remonte au conteneur qu'un arbitrage a pu changer le nombre de litiges
   * (badge du sous-onglet Deals). */
  onDisputedCountChanged: () => void
}

export default function DealsView({ onDisputedCountChanged }: DealsViewProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // La file de travail d'abord : la vue s'ouvre sur les litiges à arbitrer.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('disputed')
  const [offset, setOffset] = useState(0)
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Incrémenté après un arbitrage réussi pour recharger la page courante.
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

    adminListDeals(
      {
        status: statusFilter || undefined,
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
  }, [debouncedSearch, statusFilter, offset, refreshCount])

  /** Un deal vient d'être arbitré : recharge la liste et le badge litiges. */
  function handleDealUpdated() {
    setRefreshCount((count) => count + 1)
    onDisputedCountChanged()
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
      <section className="card" aria-labelledby="deals-title">
        <div className="card-header">
          <h2 id="deals-title" className="card-title">
            Deals
          </h2>
          {list.kind === 'success' && (
            <span className="badge badge--neutral">
              {total} deal{total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="users-toolbar">
          <input
            type="search"
            className="users-search"
            placeholder="Rechercher une partie, une annonce ou un n° de deal…"
            aria-label="Rechercher une partie, une annonce ou un numéro de deal"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="users-status-filter"
            aria-label="Filtrer par statut de deal"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter)
              setOffset(0)
            }}
          >
            <option value="disputed">Litiges à arbitrer</option>
            <option value="">Tous les statuts</option>
            <option value="proposed">Proposés</option>
            <option value="active">Actifs</option>
            <option value="completed">Conclus</option>
            <option value="declined">Refusés</option>
            <option value="cancelled">Annulés</option>
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
            {statusFilter === 'disputed'
              ? 'Aucun litige à arbitrer.'
              : 'Aucun deal ne correspond à ces critères.'}
          </p>
        )}

        {list.kind === 'success' && list.page.items.length > 0 && (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col">N°</th>
                  <th scope="col">Parties</th>
                  <th scope="col">Annonce</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Créé le</th>
                </tr>
              </thead>
              <tbody>
                {list.page.items.map((deal) => (
                  <tr
                    key={deal.id}
                    className={
                      deal.id === selectedId
                        ? 'user-row user-row--selected'
                        : 'user-row'
                    }
                    onClick={() => setSelectedId(deal.id)}
                  >
                    <td className="deal-number">Deal {deal.dealNumber}</td>
                    <td>
                      <span className="deal-parties">
                        <span className="user-cell">
                          <Avatar
                            displayName={deal.proposer.displayName}
                            avatarUrl={deal.proposer.avatarUrl}
                          />
                          <span className="user-name">
                            {deal.proposer.displayName}
                          </span>
                        </span>
                        <span className="deal-parties-arrow" aria-hidden="true">
                          ⇄
                        </span>
                        <span className="user-cell">
                          <Avatar
                            displayName={deal.recipient.displayName}
                            avatarUrl={deal.recipient.avatarUrl}
                          />
                          <span className="user-name">
                            {deal.recipient.displayName}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="cell-excerpt" title={deal.listing.title}>
                      <span className="excerpt-title">{deal.listing.title}</span>
                    </td>
                    <td>
                      <DealStatusBadge status={deal.status} />
                    </td>
                    <td className="cell-muted">{formatDate(deal.createdAt)}</td>
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
        <DealDetailAdmin
          dealId={selectedId}
          onClose={() => setSelectedId(null)}
          onDealUpdated={handleDealUpdated}
        />
      )}
    </div>
  )
}

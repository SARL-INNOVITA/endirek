/**
 * Onglet « Dealplace » du backoffice — conteneur à quatre sous-vues :
 * - « Annonces »      : modération des annonces (ListingsView — CP2.1) ;
 * - « Deals »         : tous les deals + arbitrage des litiges (DealsView —
 *                       CP2.5, D66), avec badge du nombre de litiges ouverts ;
 * - « Conversations » : modération des messages (ConversationsView — CP2.5,
 *                       D67) ;
 * - « Taxonomie »     : catégories, sous-catégories et tags (TaxonomyView —
 *                       CP2.1).
 */

import { useCallback, useEffect, useState } from 'react'
import { adminListDeals } from './api'
import ConversationsView from './ConversationsView'
import DealsView from './DealsView'
import ListingsView from './ListingsView'
import TaxonomyView from './TaxonomyView'

type SubView = 'listings' | 'deals' | 'conversations' | 'taxonomy'

const SUBVIEW_LABELS: Record<SubView, string> = {
  listings: 'Annonces',
  deals: 'Deals',
  conversations: 'Conversations',
  taxonomy: 'Taxonomie',
}

const SUBVIEWS: SubView[] = ['listings', 'deals', 'conversations', 'taxonomy']

export default function DealplaceView() {
  const [subView, setSubView] = useState<SubView>('listings')
  // Badge « litiges à arbitrer » du sous-onglet Deals — même mécanique que le
  // badge signalements d'App.tsx : un fetch limit=1 dont seul `total` sert.
  const [disputedCount, setDisputedCount] = useState<number | null>(null)

  const refreshDisputedCount = useCallback(() => {
    adminListDeals({ status: 'disputed', limit: 1, offset: 0 })
      .then((page) => setDisputedCount(page.total))
      .catch(() => {
        // Échec silencieux : le badge est un confort, la sous-vue reste
        // utilisable (même politique que les référentiels de filtres).
        setDisputedCount(null)
      })
  }, [])

  useEffect(() => {
    refreshDisputedCount()
  }, [refreshDisputedCount])

  return (
    <div className="dealplace-view">
      <nav className="subtabs" aria-label="Sections Dealplace">
        {SUBVIEWS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={
              candidate === subView ? 'subtab subtab--active' : 'subtab'
            }
            aria-current={candidate === subView ? 'page' : undefined}
            onClick={() => setSubView(candidate)}
          >
            {SUBVIEW_LABELS[candidate]}
            {candidate === 'deals' &&
              disputedCount !== null &&
              disputedCount > 0 && (
                <span className="subtab-badge">{disputedCount}</span>
              )}
          </button>
        ))}
      </nav>

      {subView === 'listings' && <ListingsView />}
      {subView === 'deals' && (
        <DealsView onDisputedCountChanged={refreshDisputedCount} />
      )}
      {subView === 'conversations' && <ConversationsView />}
      {subView === 'taxonomy' && <TaxonomyView />}
    </div>
  )
}

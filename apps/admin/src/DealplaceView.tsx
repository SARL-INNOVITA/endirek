/**
 * Onglet « Dealplace » du backoffice (CP2.1) — conteneur à deux sous-vues :
 * - « Annonces »  : modération des annonces (ListingsView) ;
 * - « Taxonomie » : catégories, sous-catégories et tags (TaxonomyView).
 *
 * Périmètre CP2.1 STRICT : ni conversations, ni deals contractuels, ni avis /
 * profil Dealplace, ni paiement — hors de ce checkpoint.
 */

import { useState } from 'react'
import ListingsView from './ListingsView'
import TaxonomyView from './TaxonomyView'

type SubView = 'listings' | 'taxonomy'

const SUBVIEW_LABELS: Record<SubView, string> = {
  listings: 'Annonces',
  taxonomy: 'Taxonomie',
}

const SUBVIEWS: SubView[] = ['listings', 'taxonomy']

export default function DealplaceView() {
  const [subView, setSubView] = useState<SubView>('listings')

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
          </button>
        ))}
      </nav>

      {subView === 'listings' && <ListingsView />}
      {subView === 'taxonomy' && <TaxonomyView />}
    </div>
  )
}

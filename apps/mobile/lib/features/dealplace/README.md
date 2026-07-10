# feature: dealplace — Annuaire biens & services (CP2.1)

Première fonctionnalité du Lot 2 : la taxonomie (biens/services) et les
annonces (listings). Les conversations, deals contractuels, avis/profil
Dealplace, paiements et pages restos arrivent aux checkpoints suivants
(CP2.2+). Le bouton « Proposer un deal » du détail est un PLACEHOLDER
(deals = CP2.4) : il affiche un snackbar « Disponible au prochain lot ».

## Arborescence

- `domain/` — modèles du contrat CP2.1 :
  - `dealplace_taxonomy.dart` — `DealplaceTaxonomy` (catégories +
    sous-catégories + tags) de GET /dealplace/taxonomy ;
  - `listing.dart` — forme LISTING (détail complet) + `ListingExternalLink` ;
  - `listing_card.dart` — forme LISTING_CARD (sous-ensemble des listes) ;
  - `listing_filters.dart` — filtres immuables de l'annuaire (→ query params) ;
  - `create_listing_input.dart` — corps de POST /dealplace/listings ;
  - `dealplace_value.dart` — formatage de la VALEUR « € » (fixe/fourchette),
    testé isolément (`test/dealplace_value_test.dart`).
- `data/dealplace_repository.dart` — accès aux endpoints (taxonomie, liste
  filtrée, détail id/slug, création, édition, suppression, mes annonces,
  annonces d'un profil). Réutilise `apiClientProvider` (Dio + Bearer + refresh).
- `application/` — providers Riverpod :
  - `taxonomy_provider.dart` — taxonomie chargée une fois pour la session ;
  - `listings_list_controller.dart` — annuaire paginé + filtres + recherche ;
  - `listing_detail_provider.dart` — détail d'une annonce (autoDispose).
- `presentation/` — écrans et widgets :
  - `dealplace_screen.dart` — onglet LISTE (grille de cartes, recherche +
    filtres, états loading/vide/erreur, pull-to-refresh, pagination, FAB) ;
  - `listing_detail_screen.dart` — DÉTAIL fidèle au mockup 06 ;
  - `create_listing_screen.dart` — formulaire de CRÉATION (photo obligatoire
    pour un bien, upload immédiat via `/media/upload`) ;
  - `widgets/` — `carte_annonce.dart`, `badge_type_annonce.dart`,
    `filtres_bottom_sheet.dart`.

## Routes (core/router/app_router.dart)

- `/dealplace` — onglet du shell (LISTE) ;
- `/dealplace/create` — création, plein écran au-dessus du shell ;
- `/dealplace/:id` — détail, plein écran (déclaré APRÈS `create`).

Les images (couverture, médias, avatars) passent par
`ApiConfig.resolveMediaUrl` pour rester joignables depuis l'émulateur.

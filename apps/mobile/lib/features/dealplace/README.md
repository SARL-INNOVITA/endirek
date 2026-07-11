# feature: dealplace — Annuaire biens & services (CP2.1) + profil (CP2.2)

Première fonctionnalité du Lot 2 : la taxonomie (biens/services), les
annonces (listings — CP2.1) et le **volet Profil Dealplace** (CP2.2, mockup
05, périmètre D59 : SANS avis — ils arrivent avec les deals au CP2.4). Les
conversations, deals contractuels et pages restos arrivent aux checkpoints
suivants. Placeholders assumés : bouton « Proposer un deal » du détail
(snackbar), blocs avis / « Deals conclus » du profil (pastille « Bientôt »).

## Arborescence

- `domain/` — modèles du contrat CP2.1/CP2.2 :
  - `dealplace_taxonomy.dart` — `DealplaceTaxonomy` (catégories +
    sous-catégories + tags) de GET /dealplace/taxonomy ;
  - `listing.dart` — forme LISTING (détail complet) + `ListingExternalLink` ;
  - `listing_card.dart` — forme LISTING_CARD (sous-ensemble des listes) ;
  - `listing_filters.dart` — filtres immuables de l'annuaire (→ query params) ;
  - `create_listing_input.dart` — corps de POST /dealplace/listings ;
  - `dealplace_value.dart` — formatage de la VALEUR « € » (fixe/fourchette),
    testé isolément (`test/dealplace_value_test.dart`) ;
  - `profil_public.dart` — PROFIL PUBLIC de GET /users/:id (CP2.2, en-tête de
    l'écran profil d'un tiers ; jamais d'email), testé
    (`test/profil_dealplace_models_test.dart`).
- `data/dealplace_repository.dart` — accès aux endpoints (taxonomie, liste
  filtrée, détail id/slug, création, édition, suppression, mes annonces et
  annonces d'un profil — avec filtre `family` CP2.2 —, profil public).
  Réutilise `apiClientProvider` (Dio + Bearer + refresh).
- `application/` — providers Riverpod :
  - `taxonomy_provider.dart` — taxonomie chargée une fois pour la session ;
  - `listings_list_controller.dart` — annuaire paginé + filtres + recherche ;
  - `listing_detail_provider.dart` — détail d'une annonce (autoDispose) ;
  - `profil_dealplace_providers.dart` — profil public + sections d'annonces
    par famille (CP2.2, autoDispose).
- `presentation/` — écrans et widgets :
  - `dealplace_screen.dart` — onglet LISTE (grille de cartes, recherche +
    filtres, états loading/vide/erreur, pull-to-refresh, pagination, FAB) ;
  - `listing_detail_screen.dart` — DÉTAIL fidèle au mockup 06 (le bloc
    vendeur ouvre son profil Dealplace public — CP2.2) ;
  - `create_listing_screen.dart` — formulaire de CRÉATION (photo obligatoire
    pour un bien, upload immédiat via `/media/upload`) ;
  - `profil_dealplace_view.dart` — VUE PARTAGÉE du volet Profil Dealplace
    (CP2.2) : placeholder avis/deals (D59), « Ce que je recherche »
    (éditable sur MON profil via PATCH /users/me/profile), sections
    Services / Biens (jusqu'à 50 par famille — pagination à prévoir avec la
    croissance des profils), placeholder « Deals conclus », bottom sheet
    « Comment ça marche ? » ;
  - `dealplace_profil_screen.dart` — écran PUBLIC du profil Dealplace d'un
    tiers (en-tête avatar/nom/commune/bio + vue partagée) ;
  - `widgets/` — `carte_annonce.dart`, `badge_type_annonce.dart`,
    `filtres_bottom_sheet.dart`, `tuile_annonce_profil.dart` (tuile compacte
    des sections du profil, badge « Masquée » sur mes annonces cachées).

L'onglet « Profil Dealplace » de MON profil vit dans
`features/profile/presentation/profile_screen.dart` (mockups 04/05 : onglets
« Mes infos » / « Profil Dealplace ») et réutilise `profil_dealplace_view`.

## Routes (core/router/app_router.dart)

- `/dealplace` — onglet du shell (LISTE) ;
- `/dealplace/create` — création, plein écran au-dessus du shell ;
- `/dealplace/profil/:userId` — profil Dealplace PUBLIC d'un tiers (CP2.2,
  déclaré AVANT `/dealplace/:id`) ;
- `/dealplace/:id` — détail, plein écran (déclaré APRÈS les routes statiques).

Les images (couverture, médias, avatars) passent par
`ApiConfig.resolveMediaUrl` pour rester joignables depuis l'émulateur.

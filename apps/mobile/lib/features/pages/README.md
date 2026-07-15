# feature: pages — Pages restaurants & entreprises (Lot 3, D69-D77)

Pages professionnelles possédées par des utilisateurs (plusieurs par
compte), de type `restaurant` ou `business` : écran public du mockup 08,
gestion complète par le propriétaire et publication AU NOM de la page
(types réservés `menu`/`offer`/`event` + publication libre).

## Arborescence

- `domain/` :
  - `page_models.dart` — formes exactes du contrat : `PageDetail` (PAGE),
    `PageCard`/`OwnerPageCard` (PAGE_CARD ± status), `PageOpenStatus`
    (statut ouvert/fermé/congés DÉRIVÉ serveur, heure Réunion),
    `PageHourView`, `PageDocumentView`, `Dish` (prix en CENTIMES),
    `MenuDay` (menu par DATE), `PageOffer`, `PageEvent` +
    `initialesDeNom` ;
  - `formatage_pages.dart` — formatage français testé isolément
    (`test/pages_formatage_test.dart`) : prix, saisies en euros, tailles
    de fichier, jours/dates, période d'offre ;
  - `types_posts_page.dart` — table LOCALE des 3 types de publication
    réservés aux pages (absents de `GET /posts/types`) : libellés,
    couleurs (#0EA5A4/#D97706/#DB2777) et icônes, partagée entre le fil,
    le détail de post et la carte.
- `data/pages_repository.dart` — tous les endpoints `/pages*` du contrat
  (fiche, horaires, plats, menus, documents, offres, événements,
  abonnement, publications, signalement) + `GET /users/me/pages`.
- `application/pages_providers.dart` — `FutureProvider.autoDispose`
  (détail, mes pages, menus, plats, offres/événements publics ET gestion
  `all=true`, aperçu des publications).
- `presentation/` :
  - `page_screen.dart` — écran PUBLIC `/pages/:id` (mockup 08) : couverture
    + avatar, ✓, statut dérivé + horaires en bottom sheet, bio/attributs,
    Suivre (optimiste)/Message/Itinéraire/Signaler, menus de la semaine,
    « Nos cartes » (PDF ouverts via url_launcher), offres, événements,
    publications. Propriétaire : « Gérer la page » + FAB « Publier »
    (bottom sheet libre/menu/offre/événement, erreurs 400 en snackbar) ;
  - `page_posts_screen.dart` — `/pages/:id/posts` (liste paginée) ;
  - `create_page_screen.dart` — `/pages/create` ;
  - `publier_libre_screen.dart` — `/pages/:id/publier` (kind=free,
    ≤4 images) ;
  - `gestion/` — hub `/pages/:id/gerer` (`gerer_page_screen.dart`) et ses
    sous-écrans : `gerer_infos_screen.dart` (identité + congés),
    `gerer_horaires_screen.dart` (PUT en bloc),
    `gerer_plats_screen.dart` (bibliothèque de plats),
    `gerer_menus_screen.dart` (menu du jour par jour glissant — sélection
    ORDONNÉE ≤12 plats, réordonnancement par glisser, [] = suppression),
    `gerer_cartes_screen.dart` (PDF : file_picker →
    `POST /media/upload-document` → attache, quota 5),
    `gerer_offres_screen.dart` (CRUD, période optionnelle) et
    `gerer_evenements_screen.dart` (CRUD, début REQUIS date + heure) —
    menus/cartes/plats réservés aux restaurants (le hub masque les tuiles) ;
  - `widgets/` — `BadgeVerifie`, `CartePlat`, `ChipStatutOuverture`,
    `montrerHorairesPage` (bottom sheet), `TuilePageProfil` (section
    « Mes pages » du profil).

## Intégrations hors feature

- **Fil / détail de post / carte** : quand `FeedPost.page` ou
  `MapPostItem.page` est non nul, l'IDENTITÉ DE PAGE (avatar, nom, ✓)
  remplace l'auteur humain et navigue vers `/pages/:id` ; les slugs
  menu/offer/event sont résolus par `types_posts_page.dart`.
- **Messages (D75)** : bouton « Message » → `/pages/:id/contact`
  (`ChatScreen.pourPage`, get-or-create) — voir
  `lib/features/messages/README.md`.
- **Profil** : section « Mes pages » de l'onglet « Mes infos »
  (`mesPagesProvider` + `TuilePageProfil`, badge « Masquée »).
- **Carte** : filtres et chips de mode menus/offres/événements
  (`MapFiltres`), visuels partagés (`VisuelMarqueur.pourTypePost`).

## Hors périmètre Lot 3

Réservation restaurant, offres exceptionnelles/monétisation, changement de
propriétaire de page, rendu web public du `urlSlug`, marqueurs de PAGES
permanents sur la carte (voir `docs/KNOWN_LIMITS.md` §2 septies).

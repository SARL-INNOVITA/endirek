# TODO Lot 3 — Reprise du volet MOBILE (pages restaurants & entreprises)

> **Contexte.** Le Lot 3 a été implémenté en un passage le 2026-07-14/15 :
> **API et backoffice sont COMPLETS et VÉRIFIÉS** (voir
> [AI_HANDOFF.md](AI_HANDOFF.md) §3 et les décisions D69-D77 dans
> [AI_DECISIONS.md](AI_DECISIONS.md)). Le volet MOBILE a été interrompu en
> cours de route (limite d'API du sous-agent) : il est **PARTIEL mais SAIN**
> (`flutter analyze` sans erreur, 44 tests verts) — la feature `pages`
> existe et compile, mais n'est **pas encore câblée au routeur** (code
> inatteignable depuis l'app), et il manque des écrans + toutes les
> intégrations. Ce fichier est le plan de reprise, découpé en deux
> checkpoints à valider un par un par le product owner.

## Sources de vérité pour la reprise

- **Contrat API** : `apps/api/src/modules/pages/README.md` (tableau des
  endpoints + règles), les interfaces de vue dans
  `apps/api/src/common/mappers/page.mapper.ts` (formes PAGE/PAGE_CARD/DISH/
  MENU_DAY/OFFER/EVENT exactes) et `post.mapper.ts` (`FeedPost.page`,
  `PostPageRef`), Swagger `http://localhost:3001/docs` (tag `pages`).
- **Référence visuelle** : mockup local `02_MOCKUPS/08 Page restaurant.png`
  (écran public), mockups 04/05 pour l'insertion « Mes pages » au profil.
- **Seed de démo** : page « Bon Goût » (restaurant vérifié de David Payet,
  menus sur la semaine glissante, 2 cartes PDF, offre, événement, 3 posts de
  page) et « Ti Kaz Services » (entreprise, 1 signalement ouvert) —
  comptes/`endirek974`, détail au §4 nonies du [AI_RUNBOOK.md](AI_RUNBOOK.md).

## État PRÉCIS du mobile (commit du 2026-07-15)

### ✅ Fait (compile, testé par `flutter analyze`/`test` — mais INACCESSIBLE tant que les routes ne sont pas posées)

- `pubspec.yaml` : dépendances **url_launcher** (itinéraire + ouverture PDF)
  et **file_picker** (sélection de PDF) ajoutées, `pub get` passé.
- Modèles transverses : `lib/core/api/models/post_page_ref.dart` ;
  `feed_post.dart` et `map_post_item.dart` portent le champ `page`
  (PARSÉ mais PAS ENCORE AFFICHÉ par les widgets).
- `media_repository.uploaderDocument(...)` (POST /media/upload-document).
- Feature `lib/features/pages/` :
  - `data/pages_repository.dart` — tous les appels API du contrat ;
  - `application/pages_providers.dart` — providers Riverpod ;
  - `domain/` — `page_models.dart` (Page, PageCard, Dish, MenuDay, Offer,
    Event, OpenStatus…), `formatage_pages.dart` (centimes → « 12,50 € »,
    jours/horaires français), `types_posts_page.dart` (libellés/couleurs
    des slugs menu/offer/event : #0EA5A4/#D97706/#DB2777) ;
  - `presentation/` — `page_screen.dart` (écran PUBLIC complet du mockup
    08 : couverture, ✓, statut dérivé, horaires bottom sheet, menus de la
    semaine, « Nos cartes », offres, événements, publications, suivre/
    message/itinéraire/signaler), `page_posts_screen.dart`,
    `create_page_screen.dart`, `publier_libre_screen.dart`,
    `gestion/gerer_page_screen.dart` (hub) + `gerer_infos_screen.dart` +
    `gerer_horaires_screen.dart` + `gerer_plats_screen.dart`, widgets
    (badge ✓, carte de plat, chip de statut, bottom sheet horaires,
    tuile de page pour le profil).

### ❌ Reste à faire

Voir les deux checkpoints ci-dessous.

## CP3.R1 — Finaliser la feature mobile + intégrations

1. **Routes go_router** (`lib/core/router/…`, pattern des routes
   `/dealplace/:id` hors shell) : `/pages/create`, `/pages/:id`,
   `/pages/:id/posts`, `/pages/:id/gerer` (+ sous-écrans de gestion,
   navigation depuis le hub), écran de publication libre. VÉRIFIER en
   passant que les écrans déjà écrits naviguent avec les bons noms.
2. **Écrans de gestion manquants** (à ancrer dans le hub `gerer_page_screen`,
   restaurant uniquement pour menus/cartes) :
   - menus de la semaine : par jour de la semaine glissante, sélection
     ORDONNÉE parmi les plats actifs, `PUT /pages/:id/menus/:date`
     ([] = supprimer) ;
   - « Nos cartes » : liste + ajout (file_picker → `uploaderDocument` →
     `POST /pages/:id/documents`, gérer le quota 400 « 5 documents max »)
     + suppression ;
   - offres : CRUD avec période optionnelle (DatePickers) ;
   - événements : CRUD avec `startsAt` obligatoire (date + heure).
3. **Bottom sheet « Publier »** (bouton du hub/page si propriétaire) :
   Publication libre (écran déjà écrit) / Menu du jour (`kind=menu`, gérer
   le 400 « Aucun menu programmé pour aujourd'hui ») / Offre (choisir puis
   `kind=offer` + offerId) / Événement (`kind=event` + eventId). Snackbar
   succès + navigation vers la page.
4. **Intégration feed + détail de post** : quand `FeedPost.page != null`,
   la carte de post et l'en-tête du détail affichent l'IDENTITÉ DE PAGE
   (avatar, nom, ✓ si vérifiée, libellé/couleur du type via
   `types_posts_page.dart`) au lieu de l'auteur ; tap → `/pages/:id`.
5. **Intégration messages (D75)** : `ConversationCard.listing` devient
   NULLABLE + champ `page` (adapter `fromJson` et TOUS les usages — liste
   des conversations et fil affichent le bandeau de PAGE cliquable quand
   `page != null`) ; bouton « Message » de `page_screen` → fil existant
   (`GET /conversations/page/:id`) ou premier message
   (`POST /conversations {pageId, body}`) — réutiliser les écrans du CP2.3.
6. **Intégration profil** : section « Mes pages » dans « Mes infos »
   (cartes `tuile_page_profil` déjà écrites — badge « Masquée » si
   status=hidden) + bouton « Créer une page ».
7. **Intégration carte** : ajouter menu/offer/event aux filtres et aux
   marqueurs (icônes restaurant/tag/événement, couleurs de
   `types_posts_page.dart`), identité de page dans la preview
   (`MapPostItem.page`). Suivre le pattern weather/traffic/danger existant.
8. **Vérifications** : `flutter analyze` (« No issues found! »),
   `flutter test` (tous verts — corriger les tests impactés, en ajouter
   sur le formatage/parsing pages), boot API mock + parcours runtime rapide.

## CP3.R2 — Vérification visuelle émulateur + validation product owner

1. API mock démarrée (`npm run api:dev`), émulateur `Pixel_3a_API_34`,
   `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001`.
2. Parcours complet : page « Bon Goût » fidèle au mockup 08 (statut,
   horaires, menus avec sélecteur de jours, cartes PDF qui s'ouvrent,
   offres/événements, publications), suivre/se désabonner, message à la
   page, itinéraire, signalement ; côté propriétaire (David) : gestion
   complète + publication du menu du jour → post visible feed + carte ;
   page masquée au backoffice → disparaît du feed/carte.
3. Boucle de re-test croisé postgres si un repository a bougé.
4. Mise à jour des docs de passation (AI_HANDOFF §4 mobile, suppression de
   ce fichier ou marquage « fait »), commit, **validation product owner,
   puis push**.

## Rappels de périmètre (NE PAS déborder)

Réservation restaurant, offres exceptionnelles/monétisation, changement de
propriétaire de page, rendu web public, marqueurs de PAGES permanents sur la
carte : HORS Lot 3 (voir [KNOWN_LIMITS.md](KNOWN_LIMITS.md) §2 septies).

# ENDIREK — Passation IA (AI_HANDOFF)

> **Point d'entrée unique pour tout agent IA (Claude Code, Opus, Codex, GLM, autre) qui reprend ce projet.**
> Lis ce fichier EN PREMIER, puis [AI_DECISIONS.md](AI_DECISIONS.md) et [AI_RUNBOOK.md](AI_RUNBOOK.md), puis fais `git status` avant toute modification.
> Ce fichier est la source de vérité de l'état du projet. Il doit être **mis à jour à la fin de chaque checkpoint**.

_Dernière mise à jour : **Lot 3 — API, backoffice ET mobile (CP3.R1) COMPLETS** ; reste le CP3.R2 (vérification émulateur + validation product owner) avant push — voir [TODO_LOT_3.md](TODO_LOT_3.md) ; Lots 1 et 2 validés et poussés (2026-07-15)._

---

## 1. Projet

**ENDIREK** (« en direct » en créole réunionnais) — réseau social **mobile local temps réel** centré sur **La Réunion**.

**Vision courte** : permettre à l'utilisateur de comprendre rapidement *ce qui se passe autour de lui, maintenant* — éviter un bouchon, repérer une alerte météo, découvrir une offre locale, poser une question à la communauté. L'app combine un **fil d'actualité social**, une **carte interactive live** (interface signature), une marketplace **Dealplace**, et une section **News** automatisée.

Territoire MVP : La Réunion uniquement, mais architecture pensée pour être exportable.

---

## 2. Les 4 grands lots produit

| Lot | Contenu | Statut |
|---|---|---|
| **Lot 1 — Socle + Live Local** | Auth, profils, follows, feed social (5 types de posts), interactions, carte météo/trafic, caméras, notifications, backoffice minimal, préparation démo | **STABILISÉ — validation product owner attendue** |
| **Lot 2 — Dealplace** | Marketplace biens/services, annonces, conversations 1-to-1 temps réel, deals contractuels (états, éléments validables, litiges), modération avancée | **COMPLET — validé et poussé** |
| **Lot 3 — Pages restaurants / entreprises** | Pages pro, menus programmés, cartes, horaires, offres, événements, publications de page | **API + BACKOFFICE + MOBILE (CP3.R1) COMPLETS (D69-D77) — commits locaux, reste le CP3.R2 (émulateur + validation product owner) avant push, voir [TODO_LOT_3.md](TODO_LOT_3.md)** |
| **Lot 4 — News automatisées IA** | Harnais IA supervisé, sources, génération d'articles, page News | Non commencé — anticipé |

> Monétisation (premium, offres exceptionnelles, Google Ads) = transverse/future, hors des 4 lots ci-dessus.
> « Anticipé » = points d'ancrage présents dans le code (dossiers `apps/api/src/modules/_future/`, `page_id` nullable, gateway WS prévue, adapters), **rien n'est développé**. Voir [TODO_LOT_2.md](TODO_LOT_2.md).

---

## 3. Lot actuel et checkpoints

**Lot 1 : terminé** (7 checkpoints + Lot 1.5). **Lot 2 : COMPLET, validé et poussé.** **Lot actuel : Lot 3 — API + backoffice + mobile (CP3.R1) complets ; reste le CP3.R2, vérification émulateur + validation product owner ([TODO_LOT_3.md](TODO_LOT_3.md)).**

### Lot 1 (rappel)

| # | Checkpoint | Statut |
|---|---|---|
| 1 | Socle du monorepo (API, admin, mobile, infra, docs) | ✅ validé |
| 2 | Schéma DB PostGIS + adapter mock + seed La Réunion | ✅ validé |
| 3 | Auth, utilisateurs, profils, follows, RGPD | ✅ validé |
| 4 | Posts, feed, interactions sociales, médias | ✅ validé |
| 5 | **Carte, caméras, notifications, temps réel (WebSocket)** | ✅ validé |
| 6 | **Backoffice minimal (types de posts, modération, UX, robustesse)** | ✅ validé techniquement |
| 7 | **Audit final, stabilisation, polish, préparation démo** | ✅ **implémenté** (validation product owner à venir) |

> **Lot 1.5 (2026-07-10) — driver PostgreSQL fonctionnel.** Chantier technique
> transverse (aucune nouvelle fonctionnalité produit) : les repositories SQL
> (`pg` + SQL brut paramétré) sont désormais implémentés. Le Lot 1 tourne au
> choix en `DB_DRIVER=mock` (défaut/fallback) **ou** `DB_DRIVER=postgres`, avec
> un comportement observable identique. Voir §4 (composant DB) et
> [AI_DECISIONS.md](AI_DECISIONS.md) D47-D50.

### Lot 2 — Dealplace (en cours)

| # | Checkpoint | Statut |
|---|---|---|
| **2.1** | **Dealplace : taxonomie biens/services (tables de référence pilotables) + listings (annonces) — annuaire public filtré, CRUD propriétaire, backoffice annonces + taxonomie, parité mock+postgres** | ✅ **validé et poussé** (2026-07-11) |
| **2.2** | **Profil Dealplace — volet profil SANS avis (D59/D62)** : onglets « Mes infos »/« Profil Dealplace » sur mon profil, écran public `/dealplace/profil/:userId`, « Ce que je recherche » (`users.dealplace_seeking`, migration 0005), sections Services/Biens (`?family=`), placeholders avis/deals | ✅ **validé et poussé** (2026-07-11) |
| **2.3** | **Conversations 1-to-1 temps réel (D63)** : messagerie LIÉE À UNE ANNONCE (« Contacter » du détail, get-or-create + premier message), liste + fil mobile, badge messagerie du header ACTIF, event `message.created` via la gateway du Lot 1, migration 0006 (`conversations`/`messages`), parité mock+postgres (12ᵉ repository) | ✅ **validé et poussé** (2026-07-11) |
| **2.4** | **Deals contractuels + avis détaillés (D64)** : machine à états (proposed→active→completed + declined/cancelled/disputed), éléments/sous-éléments validables par les DEUX parties (conclusion AUTOMATIQUE), ajustements appliqués à l'acceptation, notes de suivi, annulation amiable en 2 temps, litige, avis 3 critères sur deal conclu, stats du profil (mockup 05 ACTIVÉ), « Proposer un deal » RÉEL, migration 0007 (6 tables), 13ᵉ repository parité mock+postgres | ✅ **validé et poussé** (2026-07-12) |
| **2.5** | **Modération avancée Dealplace / consolidation (D65/D66/D67)** : signalement d'annonce côté utilisateur (`targetType='listing'`, menu ⋮ mobile, file admin étendue + `openReportsCount` + `flaggedOnly`), arbitrage des litiges au backoffice (3 issues cancelled/completed/resumed, note obligatoire montrée aux parties, traçabilité `dispute_resolved_*`), visibilité backoffice des deals (liste tous statuts + détail 2 parties), modération des messages (`messages.status`, masquage doux réversible, corps remplacé pour les participants, fil backoffice en clair), migration 0008, consolidation documentaire du Lot 2, seed enrichi (deal en litige, signalement d'annonce, message masqué) | ✅ **implémenté** (validation product owner à venir) |

> **CP2.1 (2026-07-10) — première fonctionnalité produit du Lot 2.** La
> **taxonomie** (catégories/sous-catégories/tags biens & services, en tables de
> référence pilotables par le backoffice) et les **listings** (annonces) sont
> livrés : annuaire public paginé/filtré, création/édition/suppression par le
> propriétaire, listes de profil, backoffice annonces + taxonomie. **Parité
> mock+postgres** maintenue (2 nouveaux repositories : listings + taxonomie,
> comportement observable identique). HORS périmètre CP2.1 : conversations,
> deals, avis/profil Dealplace, paiement (hors app). Voir §4 (module
> `dealplace`) et [AI_DECISIONS.md](AI_DECISIONS.md) D51-D58.

**Le Lot 2 (CP2.1→CP2.5) et le correctif carte (D68) sont validés et intégralement POUSSÉS.**

### Lot 3 — Pages restaurants & entreprises (2026-07-14)

**IMPLÉMENTÉ EN UN PASSAGE** (décision product owner — pas de checkpoints
intermédiaires) : pages professionnelles possédées par des utilisateurs
(plusieurs par compte), de type restaurant ou entreprise. Décisions D69-D77.
Spécification : PRD §12 + mockup « 08 Page restaurant ».

Livré côté API (COMPLET, vérifié) : identité de page (nom, bio,
avatar/couverture, commune, attributs, téléphone, badge ✓ accordé au
backoffice), horaires hebdomadaires avec statut ouvert/fermé/congés DÉRIVÉ
(heure Réunion), plats et menus du jour programmés PAR DATE (restaurant),
cartes PDF (« Nos cartes », upload `/media/upload-document`), offres et
événements, abonnés (bonus feed), publications AU NOM de la page (types
réservés `menu`/`offer`/`event` — Feed + Carte avec fenêtres 23 h / J-3 —
+ publication libre), messagerie de page (D75), signalement de page (D76),
export RGPD enrichi. Migration `0009` (rejouable), 14ᵉ repository `pages`,
parité mock+postgres vérifiée par sondes croisées (27 lectures strictement
identiques, 44 écritures) sur les DEUX drivers. Backoffice Pages COMPLET
(build vert). **Volet MOBILE COMPLET (CP3.R1, 2026-07-15)** : routes
`/pages/*` câblées, 4 écrans de gestion ajoutés (menus de la semaine,
cartes PDF, offres, événements), publication au nom de la page atteignable,
et toutes les intégrations posées (identité de page dans le fil/détail/
carte, conversations de page, section « Mes pages » du profil) — détail
au §CP3.R1 de [TODO_LOT_3.md](TODO_LOT_3.md). `flutter analyze` vierge,
74 tests verts, parcours runtime API mock vérifié. **Commits LOCAUX, non
poussés** — le push attendra le CP3.R2 (vérification émulateur +
validation product owner).
> ✅ **Revue qualité complète CP2.1 exécutée le 2026-07-11** (l'avertissement « revue à relancer » du 2026-07-10 est levé) : relecture intégrale du diff (migrations, contrat + 2 implémentations de repositories, service, DTOs, assembleur, admin, mobile), builds/tests (`api:build`, `admin:build`, `flutter analyze`, `flutter test` — tous verts), boot des DEUX drivers et sondes croisées (taxonomie, annuaire, filtres, détail, backoffice : résultats identiques). **1 finding de parité corrigé** (`3f1c1a1`) : le filtre `?tags=` avec doublons divergeait entre mock et postgres. **2 points mineurs relevés puis ARBITRÉS et CORRIGÉS le jour même** (décisions D60/D61) : (a) une catégorie/sous-catégorie INACTIVE refuse désormais toute nouvelle annonce (400 « inconnue ou inactive », les annonces existantes restent affichées et éditables) ; (b) les cartes de `GET /users/me/listings` portent désormais le champ `status` (le propriétaire distingue ses annonces masquées). Vérifiés par sondes runtime (création/édition refusées sur inactif, édition hors taxonomie toujours OK, statut présent).

---

## 4. État actuel par composant

### API — `apps/api` (NestJS 11, TypeScript, port **3001**)
Fonctionnelle. Modules livrés : `health`, `database` (mock/postgres), `auth`, `users`, `admin` (utilisateurs + posts + signalements + caméras + types de posts + commentaires signalés + notifications système dev/mock + **annonces & taxonomie Dealplace** + **deals/litiges & conversations — CP2.5** + **pages — Lot 3**), `media` (+ **upload de documents PDF — Lot 3, D77**), `posts`, `feed`, `comments`, `reactions`, `saved-posts`, `moderation` (posts + **annonces — CP2.5** + **pages — Lot 3, D76**), `map`, `cameras`, `notifications`, `realtime`, **`dealplace` (Lot 2 — CP2.1/CP2.2)**, **`conversations` (Lot 2 — CP2.3/CP2.5 + fils de PAGE — Lot 3, D75)**, **`deals` (Lot 2 — CP2.4/CP2.5)**, **`pages` (Lot 3 — D69-D77, remplace `_future/pages`)**.
- Routes métier préfixées `/api/v1`, `GET /health` hors préfixe, Swagger sur `/docs`.
- Guard JWT **global** (@Public pour exceptions), access + refresh tokens, bcrypt.
- Upload médias local (`/uploads/` statique), validation par décodage réel (sharp), thumbnails.
- Feed scoré (récence/proximité/type/popularité/abonnements), pagination offset.
- **Carte** : `GET /map/overview` (posts + caméras en un appel), `/map/cameras`, `/map/posts`, `/map/communes` ; seuls les types `showsOnMap` non expirés sortent sur la carte, caméras `active` uniquement.
- **Caméras** : `GET /cameras/:id` public (caméra `active` seulement) ; 6 routes backoffice `/admin/cameras` (numéro auto, ville déduite par géocodage mock, statuts ; `DELETE` = masquage doux `hidden`).
- **Notifications** : `GET /notifications` (+ `total`/`unreadCount`), `/unread-count`, `PATCH /read-all`, `/:id/read` (uniquement les siennes) ; types `comment`/`reply`/`reaction`/`report_handled` créés via un point d'entrée unique (persistance + émission socket).
- **Checkpoint 6 admin** : `GET|PATCH /admin/post-types` (types actifs/inactifs, `showsOnMap`, durée carte, activation, ordre), `PATCH /admin/comments/:id/status`, `POST /admin/notifications/system`, filtres admin `role`, `mapVisible`, `targetType` et alias `pending` → `open`.
- **Temps réel** : gateway **socket.io** (namespace par défaut, auth handshake JWT), events `notification.created` (room `user:<id>`), `map.updated` (room `map`), **`message.created`** (CP2.3 — room `user:<id>` du destinataire, payload `{ conversationId, message, unreadConversations }`) et **`deal.updated`** (CP2.4 — `{ dealId }`, la page de deal ouverte se recharge), CORS aligné sur l'API via `RealtimeIoAdapter`.
- **Deals (Lot 2 — CP2.4, D64)** : `POST /deals` (proposition sur une annonce `active`, contrepartie = propriétaire ou `recipientId` ; UN SEUL deal ouvert par (annonce, paire) → 409 ; items avec fournisseur ∈ parties, steps auto « titre » si absents ; conversation liée créée si besoin), `GET /deals` (cartes DEAL_CARD triées par activité), `GET /deals/:id` (page complète : items+badges dérivés, ajustements, notes, avis, `stage` du stepper dérivé), `GET /deals/conversation/:id` (bandeau du fil), `PUT /deals/:id/items` (proposeur, phase proposed), `POST .../accept|decline|withdraw`, `POST .../steps/:stepId/honor|validate` (fournisseur honore, contrepartie valide — **conclusion AUTOMATIQUE quand tout est validé**), `POST .../adjustments` + `.../adjustments/:id/accept|reject` (payload appliqué à l'acceptation : add/modify/remove), `POST .../notes`, `POST .../cancellation` (2 temps) + `/cancellation/withdraw`, `POST .../dispute` (arbitré au backoffice — CP2.5), `POST .../review` (deal conclu, 3 critères 1-5, un avis par partie). **`GET /users/:id/deal-profile`** (+ `me`) : deals réalisés, moyennes des 3 critères + note globale (2 décimales), 3 derniers avis, deals conclus (mockup 05). Accès participants only (404) ; notifications in-app type **'deal'** sur les JALONS uniquement (anti-flood).
- **Modération avancée (Lot 2 — CP2.5, D65/D66/D67)** : **signalement d'annonce** `POST /dealplace/listings/:id/report` (mêmes règles que les posts : visibilité 404, auto-signalement 400, doublon 409 ; `reports.target_type` étendu à `'listing'` — migration 0008) ; file admin `?targetType=listing` avec extrait d'annonce, liste admin des annonces enrichie (`openReportsCount`, filtre `flaggedOnly`), détail admin avec signalements liés. **Deals backoffice** : `GET /admin/dealplace/deals` (tous statuts, `?status=disputed` = file d'arbitrage, recherche partie/annonce/n°), `GET .../deals/:id` (les DEUX parties nommées), `POST .../deals/:id/resolve-dispute` (`{outcome: cancelled|completed|resumed, note}` — note 10-1000 OBLIGATOIRE montrée aux deux parties, identité du modérateur jamais exposée aux parties, 409 si non disputé, 403 si arbitre partie prenante ; `completed` OUVRE les avis ; `resumed` → deal `active`, un nouveau litige efface les traces d'arbitrage) — délégué à `DealsService` (pattern caméras, la machine à états reste au module deals) ; notification 'deal' event `dispute_resolved` + `deal.updated` aux deux parties. **Messages** : `messages.status` (`active`/`hidden`) — masquage doux réversible, message CONSERVÉ dans le fil (pagination/non-lus inchangés), corps remplacé pour les participants (« Message masqué par la modération. ») ; backoffice EN CLAIR : `GET /admin/dealplace/conversations` (+ `/:id/messages`), `PATCH /admin/dealplace/messages/:id/status` ; pas d'event socket de modération (resynchronisation à la réouverture du fil).
- **Pages (Lot 3 — D69-D77)** : pages professionnelles possédées par des utilisateurs (plusieurs par compte), type `restaurant`/`business`, ACTIVES dès création (« validation légère »), badge ✓ accordé au backoffice. `POST /pages`, `GET /pages/:id` (+ `/slug/:slug` — forme PAGE : horaires, documents, `openStatus` DÉRIVÉ heure Réunion, isOwner/myFollow), `PATCH` (congés compris), `DELETE` (soft), `PUT .../hours` (≤4 plages/jour sans chevauchement), plats (`.../dishes` — prix en CENTIMES, ≥1 des 2 prix, suppression douce = retrait des menus), menus PAR DATE (`GET .../menus?from=` : 7 jours ; `PUT .../menus/:date` : liste ordonnée, [] supprime), documents PDF (`.../documents`, ≤5, via `POST /media/upload-document` — magic bytes %PDF), offres/événements (CRUD soft, public = non expirés/à venir, `?all=true` propriétaire/modo), abonnés (`.../follow`, compteur à la lecture, bonus feed `followedPage`), publications AU NOM de la page (`POST .../posts` kind free|menu|offer|event — corps AUTO-COMPOSÉS, types réservés `page_only` absents du composer, fenêtres carte 23 h Réunion / J-3→fin via `posts.map_visible_from`), `GET .../posts` (posts de page exclus des listes de profil), signalement `POST /pages/:id/report`, listes de profil `GET /users/me/pages` (avec statut) et `GET /users/:id/pages`. FEED_POST et MapPostItem exposent `page` (identité de page) ; les posts d'une page non-active sortent du feed/carte. Backoffice : `GET /admin/pages` (filtres type/statut/vérifiée/flaggedOnly/recherche + `openReportsCount`), `GET /admin/pages/:id` (compteurs + historiques + signalements), `PATCH .../status`, `PATCH .../verified`. Conversations : cible annonce OU page (`POST /conversations {pageId}` XOR `{listingId}`, `GET /conversations/page/:pageId`). Export RGPD enrichi (`pages`, `followedPages`).
- **Conversations (Lot 2 — CP2.3, D63)** : messagerie 1-to-1 **liée à une annonce** — `POST /conversations` (get-or-create sur (annonce, moi) + premier message ; annonce `active` uniquement, jamais la sienne), `GET /conversations` (cartes : annonce en référence légère, interlocuteur, dernier message, non-lus + `unreadConversations`), `GET /conversations/unread-count` (badge), `GET /conversations/listing/:listingId` (mon fil pour une annonce), `GET /conversations/:id`, `GET|POST /conversations/:id/messages` (récent → ancien ; texte 1-2000), `PATCH /conversations/:id/read`. Accès strictement réservé aux participants (404 sinon). **Pas de notification in-app par message** (anti-flood) : badge dédié + event socket. Tables `conversations`/`messages` (migration 0006), non-lus calculés à la lecture via les jalons `*_last_read_at`.
- **Dealplace (Lot 2 — CP2.1)** : `GET /dealplace/taxonomy` (catégories actives + sous-catégories + tags, pour le formulaire mobile) ; annuaire public `GET /dealplace/listings` (annonces `active`, filtres `family/category/subcategory/city/valueMin/valueMax/tags/search`, pagination) ; `POST /dealplace/listings` (règles métier : valeur fixe/fourchette cohérente, **photo obligatoire pour un bien**, commune du référentiel, catégorie+sous-catégorie cohérentes, **catégorie « forbidden » refusée 400**, médias issus de `/media/upload`) ; `GET /dealplace/listings/:id`, `GET /dealplace/listings/slug/:slug`, `PATCH|DELETE /dealplace/listings/:id` (propriétaire, soft-delete) ; listes de profil `GET /users/me/listings` (active+hidden, cartes enrichies du `status` — D61) et `GET /users/:id/listings` (active), toutes deux filtrables par `?family=good|service` (CP2.2) ; catégorie/sous-catégorie **inactive** refusée à la création et au changement de catégorie (400 — D60). **CP2.2 (D62)** : champ de profil `dealplaceSeeking` (« Ce que je recherche », public, 500 caractères, migration 0005) exposé dans les profils complet et public, édité via `PATCH /users/me/profile` (chaîne vide → null). **Backoffice** : `GET|POST|PATCH /admin/dealplace/categories|subcategories|tags` (taxonomie pilotable, slug immuable) ; `GET /admin/dealplace/listings` (tous statuts + recherche), `GET /admin/dealplace/listings/:id`, `PATCH /admin/dealplace/listings/:id/status` (masquer/republier — `deleted` non restaurable). Forme `LISTING`/`LISTING_CARD` assemblée par `ListingAssembler` (source unique, partagée avec le backoffice, comme `FeedPostAssembler`).

### Mobile — `apps/mobile` (Flutter 3.44, Riverpod, go_router, dio)
Fonctionnel et stabilisé. Shell 4 onglets (Accueil, Carte, News, Dealplace) ; **News = placeholder propre**, la **Carte** et **désormais le Dealplace (CP2.1)** sont réels. Écrans réels : login/register, profil + édition, feed (infinite scroll, pull-to-refresh), composer (5 types actifs depuis `GET /posts/types`, images, choix de commune), détail post (commentaires 2 niveaux, réactions, signalement, édition), **carte Météo & trafic** (`flutter_map` + tuiles OSM, clustering client-side, cartes de preview, filtres), **détail caméra** (image live pour `streamType='image'`, repli pour video/iframe), **écran notifications** + **cloche active avec badge de non-lues**, et l'**onglet Dealplace** (`features/dealplace`) : annuaire (grille de cartes, recherche + filtres, états loading/vide/erreur, pull-to-refresh, pagination, FAB), **création d'annonce** (`/dealplace/create` — photo obligatoire pour un bien, upload via `/media/upload`), **détail** (`/dealplace/:id`, fidèle au mockup 06). **CP2.2 — Profil Dealplace (D59/D62)** : mon profil passe en **deux onglets** « Mes infos » / « Profil Dealplace » (mockups 04/05) et le bloc vendeur du détail d'annonce ouvre l'**écran public** `/dealplace/profil/:userId` ; le volet (vue partagée `profil_dealplace_view`) affiche le placeholder avis/deals (pastille « Bientôt »), « **Ce que je recherche** » (éditable sur mon profil), les sections **Services / Biens** (tuiles compactes, badge « Masquée » sur mes annonces cachées) et « Comment ça marche ? » (bottom sheet). **CP2.4 — Deals (`features/deals`, D64)** : le bouton **« Proposer un deal »** est **RÉEL** — écran de composition (`/dealplace/:id/proposer` : éléments des deux côtés, nature/valeur/sous-éléments) ; **page de deal** (`/deals/:id`, mockup 07 : stepper 5 étapes dérivé, sections d'éléments avec steps actionnables — honorer/valider —, ajustements avec décision, timeline de notes, annulation 2 temps, litige, formulaire d'avis 3 critères en étoiles sur deal conclu) ; **liste « Mes deals »** (`/deals`) ; **bandeau de deal** dans le fil de conversation + action « Proposer un deal » depuis le fil (les deux parties) ; **profil Dealplace ACTIVÉ** (stats réelles : note globale, barres des 3 critères, dernier avis, « X deals réalisés », « Deals conclus » — plus de placeholders) ; notifications type `deal` (tap → page du deal) et rafraîchissement en direct via `deal.updated`. **CP2.3 — Messagerie (`features/messages`, D63)** : bouton **« Contacter »** sur le détail d'annonce (masqué sur mes annonces) → fil lié à l'annonce (`/dealplace/:id/contact`, repris s'il existe, créé au premier envoi) ; **liste des conversations** (`/messages` — cartes avec badge par fil) ; **écran de fil** (`/messages/:id` — bulles chronologiques, bandeau annonce cliquable, saisie 2000 max) ; réception **en direct** (event `message.created`) + marquage lu à l'ouverture/réception. **Lot 3 — Pages (`features/pages`, D69-D77, CP3.R1 fait — reste la
vérification émulateur CP3.R2)** : routes `/pages/*` câblées (création,
écran public du mockup 08, publications, publication libre, contact, hub
de gestion + 7 sous-écrans) ; écran public complet (couverture, ✓, statut
dérivé, horaires, menus de la semaine, « Nos cartes » PDF ouvertes via
url_launcher, offres, événements, publications, suivre/message/itinéraire/
signaler) ; côté propriétaire : hub de gestion COMPLET (infos + congés,
horaires, plats, **menus de la semaine** — sélection ordonnée ≤12 plats
par jour glissant, réordonnancement par glisser, [] = suppression —,
**cartes PDF** — file_picker → `uploaderDocument` → attache, quota 5 —,
**offres** et **événements** — CRUD avec périodes) et FAB « Publier »
(bottom sheet 4 choix : libre/menu/offre/événement, erreurs 400 du contrat
en snackbar). Intégrations : les publications DE PAGE affichent l'identité
de la page (avatar, nom, ✓ — tap → `/pages/:id`) dans le fil, le détail de
post et la preview carte, types réservés menu/offer/event résolus par la
table locale `types_posts_page.dart` ; **conversations de page (D75)** —
`ConversationCard.listing` NULLABLE + `page`, bouton « Message » →
`/pages/:id/contact` (get-or-create), bandeau de page cliquable dans le
fil, vignette de page dans la liste ; section **« Mes pages »** de l'onglet
« Mes infos » du profil (badge « Masquée », bouton « Créer une page ») ;
**carte** : filtres menus/offres/événements (bottom sheet + chips de mode
devenues bascules rapides par famille), marqueurs et preview aux couleurs
du contrat (#0EA5A4/#D97706/#DB2777). Les notifications `system` affichent `payload.title` ou `payload.message`. Temps réel via **socket.io** (`socket_io_client`) : notifications + `map.updated` + `message.created`, avec **fallback polling ~45 s** (cloche ET messagerie). Header : icône messagerie **ACTIVE avec badge** (conversations avec non-lus), cloche **active**. Les libellés Material sont localisés en français via `flutter_localizations`. **CP2.5 — Modération (D65/D66/D67)** : menu **⋮ « Signaler »** sur le détail d'annonce (non-propriétaire, dialogue de signalement du Lot 1 réutilisé avec titre paramétré) ; page de deal : bandeau de litige actualisé (« L'équipe de modération va examiner la situation. ») + **bandeau « Litige tranché »** (issue + note de décision, bleu pâle) dès qu'un arbitrage est rendu (`disputeResolution*` dans le modèle Deal) ; messages masqués rendus en **placeholder italique** « Message masqué par la modération. » (bulle neutre, aperçu de conversation en italique).

### Admin — `apps/admin` (React 19 + Vite 7, CSS pur, port 5173)
Backoffice consolidé : connexion réservée aux rôles admin, onglets **Utilisateurs** (recherche + statut + rôle, suspendre/réactiver), **Publications** (type/statut/recherche + filtre carte `mapVisible`, détail, masquer/réactiver), **Signalements** (statut + cible — dont **Annonces** depuis le CP2.5 : actions directes Masquer/Réactiver + « Voir l'annonce », traitement, action directe sur commentaire signalé), **Caméras** (`CamerasView` + `CameraForm` : liste tous statuts, création/édition, changement de statut, masquage doux), **Dealplace** — `DealplaceView` à **quatre sous-vues** : **Annonces** (`ListingsView` + `ListingDetailAdmin` : liste tous statuts + filtres famille/catégorie/statut/modération/recherche, colonne signalements, détail avec signalements liés, masquer/republier), **Deals (CP2.5)** (`DealsView` + `DealDetailAdmin` : file « Litiges à arbitrer » par défaut avec badge sur le sous-onglet, tous statuts, détail 2 parties + éléments/steps + **formulaire d'arbitrage** 3 issues avec note obligatoire + **conversation liée moderable**), **Conversations (CP2.5)** (`ConversationsView` : liste + fil en clair, masquer/réactiver par message) et **Taxonomie** (`TaxonomyView` : catégories/sous-catégories/tags pilotables, création + édition, slug immuable) — **Pages (Lot 3)** (`PagesView` + `PageDetailAdmin` : liste tous statuts avec filtres type/statut/vérifiée/« Signalées seulement » + recherche nom/commune/propriétaire, colonne signalements, détail complet — identité, horaires lisibles, congés, compteurs, documents, offres/événements, signalements liés — actions Masquer/Republier et badge ✓ Accorder/Retirer ; la file Signalements gère la cible **Pages** avec actions directes, les conversations affichent les fils de PAGE, les types de posts réservés aux pages portent un badge dédié) — et **Paramètres** (types de posts pilotables + notification système dev/mock).

### DB mock + PostgreSQL/PostGIS — `apps/api/src/database` / `infra`
La couche persistance expose **14 repositories** (9 du Lot 1 + `listings` et
`listing-taxonomy` du CP2.1, `conversations` du CP2.3, `deals` du CP2.4,
`pages` du Lot 3)
derrière un contrat unique (`repositories/interfaces.ts`) et deux drivers au
**comportement observable identique**, choisis au chargement du module via
`process.env.DB_DRIVER` :

- **`DB_DRIVER=mock` (défaut, fallback)** : repositories in-memory au-dessus de
  `MockDatabaseService`. Aucune infra requise. Seed La Réunion rechargé à chaque
  boot avec timestamps relatifs.
- **`DB_DRIVER=postgres` (fonctionnel — Lot 1.5)** : repositories SQL (`pg` +
  SQL brut paramétré `$1, $2…`, pas d'ORM) dans `src/database/postgres/`
  (pool partagé `POSTGRES_POOL`, mappers ligne→entité, seeder, PostGIS). En
  mode postgres, `MockDatabaseService` **n'est même pas instancié**. Nécessite
  le conteneur Docker `endirek-postgres` et les migrations appliquées
  (`npm run db:migrate`).

Points saillants du driver postgres :
- **Compteurs dénormalisés calculés À LA LECTURE** (sous-requêtes/JOIN :
  `reactionCount`, `commentCount`, `saveCount`, `followersCount`…) — parité de
  comportement avec le mock, colonnes compteur de la base non maintenues à
  l'écriture.
- **Seeder idempotent et atomique** (`PostgresSeeder`) réutilisant la source
  unique `buildSeed()` : seed inséré **une seule fois si la table `users` est
  vide** (`ON CONFLICT DO NOTHING`, transaction). `npm run db:reset` vide les
  données pour forcer un re-seed.
- Géométrie PostGIS : écriture `ST_SetSRID(ST_MakePoint(lng,lat),4326)`, lecture
  `ST_Y(location) AS lat, ST_X(location) AS lng`, bbox via `ST_MakeEnvelope`.

Docker : `infra/docker-compose.yml` démarre PostgreSQL/PostGIS
(`postgis/postgis:16-3.4`) ; migrations `0001`→`0009` appliquées avec succès
(`0001`/`0002` Lot 1, `0003`/`0004` CP2.1, `0005` CP2.2, `0006` CP2.3,
`0007` CP2.4, `0008` CP2.5, `0009` pages Lot 3 — `npm run db:migrate` applique tout le dossier
dans l'ordre lexicographique sur une base VIERGE ; sur base vivante,
appliquer les nouvelles à la main, voir AI_RUNBOOK §8). **Sur cette machine,
le conteneur `endirek-postgres` est remappé sur le port hôte `55432`** (un
PostgreSQL natif occupe déjà 5432) —
`DATABASE_URL=postgresql://endirek:endirek@127.0.0.1:55432/endirek`.
**Log de boot attendu (mock)** : `Mock DB prête : 15 utilisateurs, 32 follows, 46 posts (dont 16 visibles carte), 60 commentaires, 155 réactions, 12 caméras, 6 signalements, 12 notifications, 8 annonces Dealplace (20 catégories, 79 sous-catégories, 10 tags), 4 conversations (11 messages), 3 deals (2 avis), 2 pages (6 plats, 6 menus, 2 offres, 2 événements, 5 abonnés)` (compteurs enrichis au Lot 3 : +4 publications de page, +1 signalement de page, +1 fil de page/2 messages, +2 pages complètes).
**Log de boot attendu (postgres, première base seedée)** : `PostgreSQL prêt : connecté (15 utilisateurs, 32 follows, 46 posts (dont 16 visibles carte), 60 commentaires, 155 réactions, 12 caméras, 6 signalements, 12 notifications)` (la ligne postgres s'arrête aux tables du Lot 1 — asymétrie assumée avec le mock ; le log du SEEDER, lui, détaille tout, pages comprises).

---

## 5. Services mockés (aucune clé externe requise)

| Service | Driver / état | Détail |
|---|---|---|
| Base de données | `DB_DRIVER=mock` (défaut) **ou** `DB_DRIVER=postgres` (fonctionnel) | mock in-memory (fallback) ; postgres = repositories SQL sur le conteneur Docker migré — comportement identique |
| Stockage médias | `MEDIA_STORAGE_DRIVER=local` | disque `apps/api/uploads/` ; S3/Hetzner = `throw` explicite |
| Géocodage | `GEOCODING_PROVIDER=mock` | table des 12 communes du seed + plus proche voisin |
| Push (FCM/APNs) | `PUSH_DRIVER=mock` | notifications persistées en base, pas d'envoi réel |
| Email (Brevo) | `EMAIL_DRIVER=mock` | contenu logué en console |
| OAuth Google/Apple | endpoints **501** | placeholders propres, auth email/mdp suffit |

Détail complet : [MOCKED_SERVICES.md](MOCKED_SERVICES.md). Accès à fournir plus tard : [ACCESS_NEEDED.md](ACCESS_NEEDED.md).

---

## 6. Limites connues (état honnête)

- **Driver PostgreSQL fonctionnel (Lot 1.5)** : l'API tourne au choix en `DB_DRIVER=mock` (défaut) ou `DB_DRIVER=postgres`. Nuances : le seed n'est inséré **qu'une seule fois si la base est vide** (idempotent — `npm run db:reset` pour re-seeder) ; les **compteurs dénormalisés sont calculés à la lecture** (parité de comportement, mais perf via triggers `updated_at`/compteurs à grande échelle = TODO).
- Données mock **non persistées** entre redémarrages (seed rechargé, timestamps relatifs) ; en postgres, les données **persistent** en base.
- Refresh token **non révocable** (invalidation via re-vérification du statut à chaque requête).
- Pas de vérification d'email ni de reset de mot de passe ; pas de rate-limiting.
- **Partage** de post = bouton « prochainement », `share_count` jamais incrémenté.
- Changements de `post_types` non rétroactifs : une durée carte modifiée ne recalcule pas les posts existants.
- Signalement de commentaires côté utilisateur non exposé au Lot 1 ; la file admin et l'action de modération existent.
- Pas de vidéos (images seulement) ; uploads orphelins non purgés.
- Notifications in-app OK (`comment`/`reply`/`reaction`/`report_handled`) ; **push mobile toujours mock** (WebSocket + base, pas de FCM/APNs).
- Notifications système backoffice = in-app + WebSocket uniquement, dev/mock.
- **Tuiles OSM = dev uniquement** (provider dédié en prod via `MAP_TILE_URL`/`MAP_API_KEY`).
- **Caméras** : seul `streamType='image'` est affiché dans l'app (video/iframe → vignette + repli).
- **Pas de présence temps réel** (« N personnes ici » du mockup non implémenté) ; temps réel = notifications + `map.updated` + **messages (CP2.3)**, **fallback polling ~45 s**.
- **Clustering client-side** (grille maison) ; clustering serveur à prévoir à grande échelle.
- Carte mobile **réelle** mais centrée sur l'île ; **GPS réel non branché** (pas de « autour de moi », position par choix de commune). La caméra est bornée par `CameraConstraint.containCenter` (le centre reste sur l'île — D68) : au zoom minimum, un peu d'océan est visible autour de l'île (normal). **Ne PAS repasser en `CameraConstraint.contain`** : ça faisait planter `flutter_map` (assertion) sur écran de téléphone en portrait — cf. `test/map_camera_constraint_test.dart`.
- **Dealplace (CP2.1-2.5, COMPLET)** : taxonomie + listings + profil + conversations + deals/avis + modération avancée. **Paiement hors app** (définitif). Annuaire filtré par commune (pas de rayon géographique) ; images seulement ; en édition, type/commune/médias non modifiables. **Messagerie** : texte seul (pas de pièces jointes), pas d'édition/suppression de message, pas de groupe, fils toujours liés à une annonce ; le masquage d'un message par la modération ne se propage pas en temps réel (resynchronisation à la réouverture du fil — D67). **Litiges** : arbitrage HUMAIN backoffice (D66), l'arbitrage IA reste futur ; pas de signalement de message/profil côté user ; un litige tranché ne se re-arbitre pas.
- Visual Studio C++ absent → pas de build Flutter Windows desktop (non nécessaire, cible Android/iOS).

Liste complète et à jour : [KNOWN_LIMITS.md](KNOWN_LIMITS.md).

---

## 7. Prochaine étape recommandée

**Lots 1 et 2 terminés, validés et poussés. Lot 3 IMPLÉMENTÉ en un passage.**

**L'API et le backoffice du Lot 3 sont implémentés et vérifiés** (api/admin
builds + flutter analyze/test verts ; migration 0009 rejouable ; boot mock
ET postgres ; sondes croisées mock/postgres STRICTEMENT identiques — 27
lectures — et 44 sondes d'écriture vertes sur les DEUX drivers : création/
édition de page, congés, horaires avec chevauchement refusé, plats/menus
transactionnels, publication menu/offre/événement avec fenêtres carte,
abonnements, masquage admin retirant les posts du feed, badge vérifié,
suppressions). **Le volet MOBILE (CP3.R1) est FAIT** (routes + écrans de
gestion + intégrations, analyze vierge, 74 tests verts, parcours runtime
API mock — détail dans [TODO_LOT_3.md](TODO_LOT_3.md)). **PROCHAINE
ÉTAPE : le CP3.R2** — vérification visuelle sur l'émulateur
`Pixel_3a_API_34` (parcours « Bon Goût » complet, côté visiteur puis
propriétaire) + validation product owner, PUIS pousser. Ensuite : Lot 4
(News automatisées IA) ou dettes transverses
(tests e2e API, rate limiting, vérification d'email, purge des uploads
orphelins — voir [KNOWN_LIMITS.md](KNOWN_LIMITS.md)).
**Paiement = hors app** (jamais dans le périmètre applicatif).
Côté base, le chantier de **performance** (compteurs calculés à la lecture →
triggers/colonnes maintenues à grande échelle) reste ouvert mais non requis.

---

## 8. Consignes strictes pour le prochain modèle

1. **Lire d'abord** : ce fichier, puis [AI_DECISIONS.md](AI_DECISIONS.md) et [AI_RUNBOOK.md](AI_RUNBOOK.md). Puis `git status`.
2. **Rester dans le périmètre du lot courant.** Le Lot 3 est IMPLÉMENTÉ (en attente de validation product owner). Ne développe PAS, avant le feu vert du product owner : News IA (Lot 4), premium/Google Ads réel, arbitrage IA des litiges, offres exceptionnelles. **Paiement = hors app.**
3. **`DB_DRIVER=mock` par défaut**, mais **`DB_DRIVER=postgres` est fonctionnel** (Lot 1.5). Les deux drivers doivent rester au comportement observable identique : toute modification d'un repository (les 14, `pages` du Lot 3 compris) doit être répercutée dans les DEUX implémentations (mock ET postgres), le mock restant la spécification de référence. **La parité mock+postgres est OBLIGATOIRE pour tous les lots.**
4. **Aucun secret dans le repo.** Jamais de clé API, token, mot de passe réel. Tout via variables d'environnement ; mettre à jour `.env.example` si une variable apparaît.
5. **Ne pas versionner** `01_PRD/`, `02_MOCKUPS/`, `03_PROMPTS/`, `04_ACCESS/` (contexte produit local, dans `.gitignore`).
6. **Ne pas créer les tables des lots non encore démarrés** (news, billing…) ; se contenter de les documenter. Toutes les tables des Lots 2 et 3 sont créées (migrations 0003→0009 — listings/taxonomie, `dealplace_seeking`, conversations/messages, deals, modération, pages).
7. **Respecter les décisions figées** (voir [AI_DECISIONS.md](AI_DECISIONS.md)), notamment : commentaires option A (commentaire + réponse, pas de réponse à une réponse), durée carte 2 h pilotée par `post_types`, feed-only vs feed+carte selon le type.
8. **Vérifier avant de commiter** : `npm run api:build`, `npm run admin:build`, `flutter analyze`, `flutter test` (voir [AI_RUNBOOK.md](AI_RUNBOOK.md)). Le log de boot du seed doit rester inchangé.
9. **Ne pas réécrire l'historique Git**, ne pas force-push, sauf demande explicite du product owner.
10. **Avancer checkpoint par checkpoint**, s'arrêter et attendre la validation du product owner à la fin de chacun.
11. **À la fin de chaque checkpoint, mettre à jour** ce fichier (toujours), [AI_DECISIONS.md](AI_DECISIONS.md) (si nouvelle décision) et [AI_RUNBOOK.md](AI_RUNBOOK.md) (si commande/procédure/compte change).

---

## 9. Fichiers à lire avant de travailler (ordre conseillé)

1. **`docs/AI_HANDOFF.md`** (ce fichier) — état et périmètre.
2. **`docs/AI_DECISIONS.md`** — décisions figées, à ne pas rediscuter.
3. **`docs/AI_RUNBOOK.md`** — comment lancer, tester, vérifier.
4. `docs/ARCHITECTURE.md` — arborescence, modules, stack, décisions techniques.
5. `docs/DATABASE.md` — schéma des tables du Lot 1 + tables Dealplace du CP2.1 (migrations 0003/0004) + drivers mock/postgres (bascule réalisée au Lot 1.5).
6. `docs/KNOWN_LIMITS.md` — limites détaillées et à jour.
7. `apps/api/README.md`, `apps/mobile/README.md`, `apps/admin/README.md` — spécifiques à chaque app.
8. Les `README.md` dans `apps/api/src/modules/*/` — rôle et règles métier de chaque module.

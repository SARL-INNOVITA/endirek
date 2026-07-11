# ENDIREK — Passation IA (AI_HANDOFF)

> **Point d'entrée unique pour tout agent IA (Claude Code, Opus, Codex, GLM, autre) qui reprend ce projet.**
> Lis ce fichier EN PREMIER, puis [AI_DECISIONS.md](AI_DECISIONS.md) et [AI_RUNBOOK.md](AI_RUNBOOK.md), puis fais `git status` avant toute modification.
> Ce fichier est la source de vérité de l'état du projet. Il doit être **mis à jour à la fin de chaque checkpoint**.

_Dernière mise à jour : Lot 2 — CP2.1/CP2.2/CP2.3 validés et poussés + **CP2.4 implémenté** (deals contractuels + avis — D64, validation product owner à venir) (2026-07-11)._

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
| **Lot 2 — Dealplace** | Marketplace biens/services, annonces, conversations 1-to-1 temps réel, deals contractuels (états, éléments validables, litiges) | **EN COURS — CP2.1 (taxonomie + listings) et CP2.2 (profil sans avis) validés et poussés** ; conversations (CP2.3), deals + avis (CP2.4), modération (CP2.5) à venir |
| **Lot 3 — Pages restaurants / entreprises** | Pages pro, menus programmés, cartes, offres, événements | Non commencé — anticipé |
| **Lot 4 — News automatisées IA** | Harnais IA supervisé, sources, génération d'articles, page News | Non commencé — anticipé |

> Monétisation (premium, offres exceptionnelles, Google Ads) = transverse/future, hors des 4 lots ci-dessus.
> « Anticipé » = points d'ancrage présents dans le code (dossiers `apps/api/src/modules/_future/`, `page_id` nullable, gateway WS prévue, adapters), **rien n'est développé**. Voir [TODO_LOT_2.md](TODO_LOT_2.md).

---

## 3. Lot actuel et checkpoints

**Lot 1 : terminé** (7 checkpoints validés/implémentés + Lot 1.5). **Lot actuel : Lot 2 — Dealplace**, exécuté par checkpoints validés un par un par le product owner.

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
| **2.4** | **Deals contractuels + avis détaillés (D64)** : machine à états (proposed→active→completed + declined/cancelled/disputed), éléments/sous-éléments validables par les DEUX parties (conclusion AUTOMATIQUE), ajustements appliqués à l'acceptation, notes de suivi, annulation amiable en 2 temps, litige (terminal), avis 3 critères sur deal conclu, stats du profil (mockup 05 ACTIVÉ), « Proposer un deal » RÉEL, migration 0007 (6 tables), 13ᵉ repository parité mock+postgres | ✅ **implémenté** (validation product owner à venir) |
| 2.5 | Modération avancée Dealplace / consolidation | ⏳ à venir |

> **CP2.1 (2026-07-10) — première fonctionnalité produit du Lot 2.** La
> **taxonomie** (catégories/sous-catégories/tags biens & services, en tables de
> référence pilotables par le backoffice) et les **listings** (annonces) sont
> livrés : annuaire public paginé/filtré, création/édition/suppression par le
> propriétaire, listes de profil, backoffice annonces + taxonomie. **Parité
> mock+postgres** maintenue (2 nouveaux repositories : listings + taxonomie,
> comportement observable identique). HORS périmètre CP2.1 : conversations,
> deals, avis/profil Dealplace, paiement (hors app). Voir §4 (module
> `dealplace`) et [AI_DECISIONS.md](AI_DECISIONS.md) D51-D58.

**Dernier commit connu : `f700b8b`** — `feat: Deals contractuels + avis détaillés (Lot 2 CP2.4)`.
Branche : `main`. Historique récent : `b1258e8` (**CP2.3 — Conversations**) → `3f6ab3c` (doc CP2.3) → `6b41692` (validation CP2.3 — poussés) → `f700b8b` (**CP2.4 — Deals + avis**, **local, non poussé** : validation product owner attendue). CP2.1, CP2.2 et CP2.3 **validés par le product owner et poussés le 2026-07-11**.
> ✅ **Revue qualité complète CP2.1 exécutée le 2026-07-11** (l'avertissement « revue à relancer » du 2026-07-10 est levé) : relecture intégrale du diff (migrations, contrat + 2 implémentations de repositories, service, DTOs, assembleur, admin, mobile), builds/tests (`api:build`, `admin:build`, `flutter analyze`, `flutter test` — tous verts), boot des DEUX drivers et sondes croisées (taxonomie, annuaire, filtres, détail, backoffice : résultats identiques). **1 finding de parité corrigé** (`3f1c1a1`) : le filtre `?tags=` avec doublons divergeait entre mock et postgres. **2 points mineurs relevés puis ARBITRÉS et CORRIGÉS le jour même** (décisions D60/D61) : (a) une catégorie/sous-catégorie INACTIVE refuse désormais toute nouvelle annonce (400 « inconnue ou inactive », les annonces existantes restent affichées et éditables) ; (b) les cartes de `GET /users/me/listings` portent désormais le champ `status` (le propriétaire distingue ses annonces masquées). Vérifiés par sondes runtime (création/édition refusées sur inactif, édition hors taxonomie toujours OK, statut présent).

---

## 4. État actuel par composant

### API — `apps/api` (NestJS 11, TypeScript, port **3001**)
Fonctionnelle. Modules livrés : `health`, `database` (mock/postgres), `auth`, `users`, `admin` (utilisateurs + posts + signalements + caméras + types de posts + commentaires signalés + notifications système dev/mock + **annonces & taxonomie Dealplace**), `media`, `posts`, `feed`, `comments`, `reactions`, `saved-posts`, `moderation`, `map`, `cameras`, `notifications`, `realtime`, **`dealplace` (Lot 2 — CP2.1/CP2.2)**, **`conversations` (Lot 2 — CP2.3, remplace `_future/conversations`)**, **`deals` (Lot 2 — CP2.4, remplace `_future/deals`)**.
- Routes métier préfixées `/api/v1`, `GET /health` hors préfixe, Swagger sur `/docs`.
- Guard JWT **global** (@Public pour exceptions), access + refresh tokens, bcrypt.
- Upload médias local (`/uploads/` statique), validation par décodage réel (sharp), thumbnails.
- Feed scoré (récence/proximité/type/popularité/abonnements), pagination offset.
- **Carte** : `GET /map/overview` (posts + caméras en un appel), `/map/cameras`, `/map/posts`, `/map/communes` ; seuls les types `showsOnMap` non expirés sortent sur la carte, caméras `active` uniquement.
- **Caméras** : `GET /cameras/:id` public (caméra `active` seulement) ; 6 routes backoffice `/admin/cameras` (numéro auto, ville déduite par géocodage mock, statuts ; `DELETE` = masquage doux `hidden`).
- **Notifications** : `GET /notifications` (+ `total`/`unreadCount`), `/unread-count`, `PATCH /read-all`, `/:id/read` (uniquement les siennes) ; types `comment`/`reply`/`reaction`/`report_handled` créés via un point d'entrée unique (persistance + émission socket).
- **Checkpoint 6 admin** : `GET|PATCH /admin/post-types` (types actifs/inactifs, `showsOnMap`, durée carte, activation, ordre), `PATCH /admin/comments/:id/status`, `POST /admin/notifications/system`, filtres admin `role`, `mapVisible`, `targetType` et alias `pending` → `open`.
- **Temps réel** : gateway **socket.io** (namespace par défaut, auth handshake JWT), events `notification.created` (room `user:<id>`), `map.updated` (room `map`), **`message.created`** (CP2.3 — room `user:<id>` du destinataire, payload `{ conversationId, message, unreadConversations }`) et **`deal.updated`** (CP2.4 — `{ dealId }`, la page de deal ouverte se recharge), CORS aligné sur l'API via `RealtimeIoAdapter`.
- **Deals (Lot 2 — CP2.4, D64)** : `POST /deals` (proposition sur une annonce `active`, contrepartie = propriétaire ou `recipientId` ; UN SEUL deal ouvert par (annonce, paire) → 409 ; items avec fournisseur ∈ parties, steps auto « titre » si absents ; conversation liée créée si besoin), `GET /deals` (cartes DEAL_CARD triées par activité), `GET /deals/:id` (page complète : items+badges dérivés, ajustements, notes, avis, `stage` du stepper dérivé), `GET /deals/conversation/:id` (bandeau du fil), `PUT /deals/:id/items` (proposeur, phase proposed), `POST .../accept|decline|withdraw`, `POST .../steps/:stepId/honor|validate` (fournisseur honore, contrepartie valide — **conclusion AUTOMATIQUE quand tout est validé**), `POST .../adjustments` + `.../adjustments/:id/accept|reject` (payload appliqué à l'acceptation : add/modify/remove), `POST .../notes`, `POST .../cancellation` (2 temps) + `/cancellation/withdraw`, `POST .../dispute` (terminal), `POST .../review` (deal conclu, 3 critères 1-5, un avis par partie). **`GET /users/:id/deal-profile`** (+ `me`) : deals réalisés, moyennes des 3 critères + note globale (2 décimales), 3 derniers avis, deals conclus (mockup 05). Accès participants only (404) ; notifications in-app type **'deal'** sur les JALONS uniquement (anti-flood).
- **Conversations (Lot 2 — CP2.3, D63)** : messagerie 1-to-1 **liée à une annonce** — `POST /conversations` (get-or-create sur (annonce, moi) + premier message ; annonce `active` uniquement, jamais la sienne), `GET /conversations` (cartes : annonce en référence légère, interlocuteur, dernier message, non-lus + `unreadConversations`), `GET /conversations/unread-count` (badge), `GET /conversations/listing/:listingId` (mon fil pour une annonce), `GET /conversations/:id`, `GET|POST /conversations/:id/messages` (récent → ancien ; texte 1-2000), `PATCH /conversations/:id/read`. Accès strictement réservé aux participants (404 sinon). **Pas de notification in-app par message** (anti-flood) : badge dédié + event socket. Tables `conversations`/`messages` (migration 0006), non-lus calculés à la lecture via les jalons `*_last_read_at`.
- **Dealplace (Lot 2 — CP2.1)** : `GET /dealplace/taxonomy` (catégories actives + sous-catégories + tags, pour le formulaire mobile) ; annuaire public `GET /dealplace/listings` (annonces `active`, filtres `family/category/subcategory/city/valueMin/valueMax/tags/search`, pagination) ; `POST /dealplace/listings` (règles métier : valeur fixe/fourchette cohérente, **photo obligatoire pour un bien**, commune du référentiel, catégorie+sous-catégorie cohérentes, **catégorie « forbidden » refusée 400**, médias issus de `/media/upload`) ; `GET /dealplace/listings/:id`, `GET /dealplace/listings/slug/:slug`, `PATCH|DELETE /dealplace/listings/:id` (propriétaire, soft-delete) ; listes de profil `GET /users/me/listings` (active+hidden, cartes enrichies du `status` — D61) et `GET /users/:id/listings` (active), toutes deux filtrables par `?family=good|service` (CP2.2) ; catégorie/sous-catégorie **inactive** refusée à la création et au changement de catégorie (400 — D60). **CP2.2 (D62)** : champ de profil `dealplaceSeeking` (« Ce que je recherche », public, 500 caractères, migration 0005) exposé dans les profils complet et public, édité via `PATCH /users/me/profile` (chaîne vide → null). **Backoffice** : `GET|POST|PATCH /admin/dealplace/categories|subcategories|tags` (taxonomie pilotable, slug immuable) ; `GET /admin/dealplace/listings` (tous statuts + recherche), `GET /admin/dealplace/listings/:id`, `PATCH /admin/dealplace/listings/:id/status` (masquer/republier — `deleted` non restaurable). Forme `LISTING`/`LISTING_CARD` assemblée par `ListingAssembler` (source unique, partagée avec le backoffice, comme `FeedPostAssembler`).

### Mobile — `apps/mobile` (Flutter 3.44, Riverpod, go_router, dio)
Fonctionnel et stabilisé. Shell 4 onglets (Accueil, Carte, News, Dealplace) ; **News = placeholder propre**, la **Carte** et **désormais le Dealplace (CP2.1)** sont réels. Écrans réels : login/register, profil + édition, feed (infinite scroll, pull-to-refresh), composer (5 types actifs depuis `GET /posts/types`, images, choix de commune), détail post (commentaires 2 niveaux, réactions, signalement, édition), **carte Météo & trafic** (`flutter_map` + tuiles OSM, clustering client-side, cartes de preview, filtres), **détail caméra** (image live pour `streamType='image'`, repli pour video/iframe), **écran notifications** + **cloche active avec badge de non-lues**, et l'**onglet Dealplace** (`features/dealplace`) : annuaire (grille de cartes, recherche + filtres, états loading/vide/erreur, pull-to-refresh, pagination, FAB), **création d'annonce** (`/dealplace/create` — photo obligatoire pour un bien, upload via `/media/upload`), **détail** (`/dealplace/:id`, fidèle au mockup 06). **CP2.2 — Profil Dealplace (D59/D62)** : mon profil passe en **deux onglets** « Mes infos » / « Profil Dealplace » (mockups 04/05) et le bloc vendeur du détail d'annonce ouvre l'**écran public** `/dealplace/profil/:userId` ; le volet (vue partagée `profil_dealplace_view`) affiche le placeholder avis/deals (pastille « Bientôt »), « **Ce que je recherche** » (éditable sur mon profil), les sections **Services / Biens** (tuiles compactes, badge « Masquée » sur mes annonces cachées) et « Comment ça marche ? » (bottom sheet). **CP2.4 — Deals (`features/deals`, D64)** : le bouton **« Proposer un deal »** est **RÉEL** — écran de composition (`/dealplace/:id/proposer` : éléments des deux côtés, nature/valeur/sous-éléments) ; **page de deal** (`/deals/:id`, mockup 07 : stepper 5 étapes dérivé, sections d'éléments avec steps actionnables — honorer/valider —, ajustements avec décision, timeline de notes, annulation 2 temps, litige, formulaire d'avis 3 critères en étoiles sur deal conclu) ; **liste « Mes deals »** (`/deals`) ; **bandeau de deal** dans le fil de conversation + action « Proposer un deal » depuis le fil (les deux parties) ; **profil Dealplace ACTIVÉ** (stats réelles : note globale, barres des 3 critères, dernier avis, « X deals réalisés », « Deals conclus » — plus de placeholders) ; notifications type `deal` (tap → page du deal) et rafraîchissement en direct via `deal.updated`. **CP2.3 — Messagerie (`features/messages`, D63)** : bouton **« Contacter »** sur le détail d'annonce (masqué sur mes annonces) → fil lié à l'annonce (`/dealplace/:id/contact`, repris s'il existe, créé au premier envoi) ; **liste des conversations** (`/messages` — cartes avec badge par fil) ; **écran de fil** (`/messages/:id` — bulles chronologiques, bandeau annonce cliquable, saisie 2000 max) ; réception **en direct** (event `message.created`) + marquage lu à l'ouverture/réception. Les notifications `system` affichent `payload.title` ou `payload.message`. Temps réel via **socket.io** (`socket_io_client`) : notifications + `map.updated` + `message.created`, avec **fallback polling ~45 s** (cloche ET messagerie). Header : icône messagerie **ACTIVE avec badge** (conversations avec non-lus), cloche **active**. Les libellés Material sont localisés en français via `flutter_localizations`.

### Admin — `apps/admin` (React 19 + Vite 7, CSS pur, port 5173)
Backoffice consolidé : connexion réservée aux rôles admin, onglets **Utilisateurs** (recherche + statut + rôle, suspendre/réactiver), **Publications** (type/statut/recherche + filtre carte `mapVisible`, détail, masquer/réactiver), **Signalements** (statut + cible, traitement, action directe sur commentaire signalé), **Caméras** (`CamerasView` + `CameraForm` : liste tous statuts, création/édition, changement de statut, masquage doux), **Dealplace (CP2.1)** — `DealplaceView` à deux sous-vues : **Annonces** (`ListingsView` + `ListingDetailAdmin` : liste tous statuts + filtres famille/catégorie/statut/recherche, détail, masquer/republier) et **Taxonomie** (`TaxonomyView` : catégories/sous-catégories/tags pilotables, création + édition, slug immuable) — et **Paramètres** (types de posts pilotables + notification système dev/mock).

### DB mock + PostgreSQL/PostGIS — `apps/api/src/database` / `infra`
La couche persistance expose **11 repositories** (9 du Lot 1 + `listings` et
`listing-taxonomy` ajoutés au CP2.1) derrière un contrat unique
(`repositories/interfaces.ts`) et deux drivers au **comportement observable
identique**, choisis au chargement du module via `process.env.DB_DRIVER` :

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
(`postgis/postgis:16-3.4`) ; migrations `0001_lot1_init.sql` +
`0002_reference_data.sql` (Lot 1) puis `0003_dealplace_listings.sql` +
`0004_dealplace_reference.sql` (Lot 2 — CP2.1 : tables Dealplace + taxonomie)
appliquées avec succès (`npm run db:migrate` applique tout le dossier dans
l'ordre lexicographique). **Sur cette machine, le conteneur `endirek-postgres`
est remappé sur le port hôte `55432`** (un PostgreSQL natif occupe déjà 5432) —
`DATABASE_URL=postgresql://endirek:endirek@127.0.0.1:55432/endirek`.
**Log de boot attendu (mock)** : `Mock DB prête : 15 utilisateurs, 32 follows, 42 posts (dont 13 visibles carte), 60 commentaires, 155 réactions, 12 caméras, 4 signalements, 12 notifications, 8 annonces Dealplace (20 catégories, 79 sous-catégories, 10 tags), 2 conversations (6 messages), 2 deals (2 avis)` (suffixe Dealplace ajouté au CP2.1).
**Log de boot attendu (postgres, première base seedée)** : `PostgreSQL prêt : connecté (15 utilisateurs, 32 follows, 42 posts (dont 13 visibles carte), 60 commentaires, 155 réactions, 12 caméras, 4 signalements, 12 notifications)`.

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
- Carte mobile **réelle** mais centrée sur l'île ; **GPS réel non branché** (pas de « autour de moi », position par choix de commune).
- **Dealplace (CP2.1-2.3)** : taxonomie + listings + profil (sans avis — D59) + conversations. **Pas de deals** (« Proposer un deal » = placeholder, CP2.4), **pas d'avis** (CP2.4, avec les deals), **pas de signalement d'annonce côté user** (modération backoffice seulement), **paiement hors app**. Annuaire filtré par commune (pas de rayon géographique) ; images seulement ; en édition, type/commune/médias non modifiables. **Messagerie (CP2.3)** : texte seul (pas de pièces jointes), pas d'édition/suppression de message, pas de groupe, fils toujours liés à une annonce, pas de modération backoffice des messages (CP2.5).
- Visual Studio C++ absent → pas de build Flutter Windows desktop (non nécessaire, cible Android/iOS).

Liste complète et à jour : [KNOWN_LIMITS.md](KNOWN_LIMITS.md).

---

## 7. Prochaine étape recommandée

**Lot 1 terminé (7 checkpoints + Lot 1.5), Lot 2 démarré : CP2.1 implémenté.**
Le CP2.1 livre la **première fonctionnalité produit du Lot 2** : la taxonomie
biens/services (tables de référence pilotables) et les listings (annonces) —
annuaire public filtré, CRUD propriétaire, listes de profil, backoffice annonces
+ taxonomie, onglet Dealplace mobile réel. **Parité mock+postgres** maintenue
(2 nouveaux repositories). Builds/tests passés.

**Le CP2.4 est implémenté et vérifié** (builds/tests verts — 39 tests flutter,
14 sondes croisées mock/postgres STRICTEMENT identiques couvrant tout le cycle
de vie : proposition/409/acceptation/refus, honorer/valider + conclusion
automatique, ajustement appliqué, annulation 2 temps, litige, avis + moyennes,
profil, confidentialité) mais **NON poussé** : attendre la **validation du
product owner du CP2.4**, pousser, puis **démarrer le CP2.5** — modération
avancée Dealplace / consolidation : backoffice des deals et des litiges
(l'état `disputed` est TERMINAL au CP2.4, personne ne peut le trancher),
modération des messages de conversation, signalement d'annonce côté
utilisateur (non exposé depuis le CP2.1), et consolidation générale du Lot 2.
**Paiement = hors app** (jamais dans le périmètre applicatif).
Côté base, le chantier de **performance** (compteurs calculés à la lecture →
triggers/colonnes maintenues à grande échelle) reste ouvert mais non requis.

---

## 8. Consignes strictes pour le prochain modèle

1. **Lire d'abord** : ce fichier, puis [AI_DECISIONS.md](AI_DECISIONS.md) et [AI_RUNBOOK.md](AI_RUNBOOK.md). Puis `git status`.
2. **Rester dans le périmètre du checkpoint courant du Lot 2.** Le CP2.1 (taxonomie + listings) est livré. Ne développe PAS, avant le feu vert : conversations (CP2.3), deals contractuels (CP2.4 — « Proposer un deal » reste un placeholder), avis/profil Dealplace (CP2.2), pages restos/entreprises (Lot 3), News IA (Lot 4), premium/Google Ads réel. **Paiement = hors app.**
3. **`DB_DRIVER=mock` par défaut**, mais **`DB_DRIVER=postgres` est fonctionnel** (Lot 1.5). Les deux drivers doivent rester au comportement observable identique : toute modification d'un repository (y compris les nouveaux `listings`/`listing-taxonomy` du CP2.1) doit être répercutée dans les DEUX implémentations (mock ET postgres), le mock restant la spécification de référence. **La parité mock+postgres est OBLIGATOIRE aussi pour le Lot 2.**
4. **Aucun secret dans le repo.** Jamais de clé API, token, mot de passe réel. Tout via variables d'environnement ; mettre à jour `.env.example` si une variable apparaît.
5. **Ne pas versionner** `01_PRD/`, `02_MOCKUPS/`, `03_PROMPTS/`, `04_ACCESS/` (contexte produit local, dans `.gitignore`).
6. **Ne pas créer les tables des lots/checkpoints non encore démarrés** (conversations, deals, pages, news, billing…) ; se contenter de les documenter. Les tables du CP2.1 (`listings`, `listing_media`, `listing_tag_map`, `listing_categories/subcategories/tags`) sont créées (migrations 0003/0004).
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

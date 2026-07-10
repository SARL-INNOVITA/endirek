# ENDIREK — Passation IA (AI_HANDOFF)

> **Point d'entrée unique pour tout agent IA (Claude Code, Opus, Codex, GLM, autre) qui reprend ce projet.**
> Lis ce fichier EN PREMIER, puis [AI_DECISIONS.md](AI_DECISIONS.md) et [AI_RUNBOOK.md](AI_RUNBOOK.md), puis fais `git status` avant toute modification.
> Ce fichier est la source de vérité de l'état du projet. Il doit être **mis à jour à la fin de chaque checkpoint**.

_Dernière mise à jour : Lot 2 — CP2.1 livré (Dealplace : taxonomie biens/services + listings, parité mock+postgres) (2026-07-10)._

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
| **Lot 2 — Dealplace** | Marketplace biens/services, annonces, conversations 1-to-1 temps réel, deals contractuels (états, éléments validables, litiges) | **DÉMARRÉ — CP2.1 livré** (taxonomie + listings) ; conversations/deals/avis à venir (CP2.2-2.5) |
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
| **2.1** | **Dealplace : taxonomie biens/services (tables de référence pilotables) + listings (annonces) — annuaire public filtré, CRUD propriétaire, backoffice annonces + taxonomie, parité mock+postgres** | ✅ **implémenté** (validation product owner à venir) |
| 2.2 | Profil Dealplace + avis détaillés (note + critères) | ⏳ à venir |
| 2.3 | Conversations 1-to-1 temps réel (gateway WebSocket du Lot 1) | ⏳ à venir |
| 2.4 | Deals contractuels (machine à états, éléments validables, litiges) — le bouton « Proposer un deal » du mobile est aujourd'hui un **placeholder** | ⏳ à venir |
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

**Dernier commit connu : `0cce389`** — `feat: Dealplace — taxonomie biens/services + listings (Lot 2 CP2.1)`.
Branche : `main`. Historique récent : `591d54f` (validation Docker/PostGIS) → `a7a99b2` (doc hash PostGIS) → `85d4b95` (Lot 1.5 — driver PostgreSQL) → `9aa7755` (doc hash Lot 1.5) → `0cce389` (CP2.1 — Dealplace taxonomie + listings).
> ⚠️ Revue adversariale formelle CP2.1 NON exécutée (limite de dépense mensuelle atteinte le 2026-07-10) — vérification croisée directe (deux drivers) + relecture manuelle du repo postgres des listings effectuées à la place. Revue à relancer avant CP2.2.

---

## 4. État actuel par composant

### API — `apps/api` (NestJS 11, TypeScript, port **3001**)
Fonctionnelle. Modules livrés : `health`, `database` (mock/postgres), `auth`, `users`, `admin` (utilisateurs + posts + signalements + caméras + types de posts + commentaires signalés + notifications système dev/mock + **annonces & taxonomie Dealplace**), `media`, `posts`, `feed`, `comments`, `reactions`, `saved-posts`, `moderation`, `map`, `cameras`, `notifications`, `realtime`, **`dealplace` (Lot 2 — CP2.1)**.
- Routes métier préfixées `/api/v1`, `GET /health` hors préfixe, Swagger sur `/docs`.
- Guard JWT **global** (@Public pour exceptions), access + refresh tokens, bcrypt.
- Upload médias local (`/uploads/` statique), validation par décodage réel (sharp), thumbnails.
- Feed scoré (récence/proximité/type/popularité/abonnements), pagination offset.
- **Carte** : `GET /map/overview` (posts + caméras en un appel), `/map/cameras`, `/map/posts`, `/map/communes` ; seuls les types `showsOnMap` non expirés sortent sur la carte, caméras `active` uniquement.
- **Caméras** : `GET /cameras/:id` public (caméra `active` seulement) ; 6 routes backoffice `/admin/cameras` (numéro auto, ville déduite par géocodage mock, statuts ; `DELETE` = masquage doux `hidden`).
- **Notifications** : `GET /notifications` (+ `total`/`unreadCount`), `/unread-count`, `PATCH /read-all`, `/:id/read` (uniquement les siennes) ; types `comment`/`reply`/`reaction`/`report_handled` créés via un point d'entrée unique (persistance + émission socket).
- **Checkpoint 6 admin** : `GET|PATCH /admin/post-types` (types actifs/inactifs, `showsOnMap`, durée carte, activation, ordre), `PATCH /admin/comments/:id/status`, `POST /admin/notifications/system`, filtres admin `role`, `mapVisible`, `targetType` et alias `pending` → `open`.
- **Temps réel** : gateway **socket.io** (namespace par défaut, auth handshake JWT), events `notification.created` (room `user:<id>`) et `map.updated` (room `map`), CORS aligné sur l'API via `RealtimeIoAdapter`.
- **Dealplace (Lot 2 — CP2.1)** : `GET /dealplace/taxonomy` (catégories actives + sous-catégories + tags, pour le formulaire mobile) ; annuaire public `GET /dealplace/listings` (annonces `active`, filtres `family/category/subcategory/city/valueMin/valueMax/tags/search`, pagination) ; `POST /dealplace/listings` (règles métier : valeur fixe/fourchette cohérente, **photo obligatoire pour un bien**, commune du référentiel, catégorie+sous-catégorie cohérentes, **catégorie « forbidden » refusée 400**, médias issus de `/media/upload`) ; `GET /dealplace/listings/:id`, `GET /dealplace/listings/slug/:slug`, `PATCH|DELETE /dealplace/listings/:id` (propriétaire, soft-delete) ; listes de profil `GET /users/me/listings` (active+hidden) et `GET /users/:id/listings` (active). **Backoffice** : `GET|POST|PATCH /admin/dealplace/categories|subcategories|tags` (taxonomie pilotable, slug immuable) ; `GET /admin/dealplace/listings` (tous statuts + recherche), `GET /admin/dealplace/listings/:id`, `PATCH /admin/dealplace/listings/:id/status` (masquer/republier — `deleted` non restaurable). Forme `LISTING`/`LISTING_CARD` assemblée par `ListingAssembler` (source unique, partagée avec le backoffice, comme `FeedPostAssembler`).

### Mobile — `apps/mobile` (Flutter 3.44, Riverpod, go_router, dio)
Fonctionnel et stabilisé. Shell 4 onglets (Accueil, Carte, News, Dealplace) ; **News = placeholder propre**, la **Carte** et **désormais le Dealplace (CP2.1)** sont réels. Écrans réels : login/register, profil + édition, feed (infinite scroll, pull-to-refresh), composer (5 types actifs depuis `GET /posts/types`, images, choix de commune), détail post (commentaires 2 niveaux, réactions, signalement, édition), **carte Météo & trafic** (`flutter_map` + tuiles OSM, clustering client-side, cartes de preview, filtres), **détail caméra** (image live pour `streamType='image'`, repli pour video/iframe), **écran notifications** + **cloche active avec badge de non-lues**, et l'**onglet Dealplace** (`features/dealplace`) : annuaire (grille de cartes, recherche + filtres, états loading/vide/erreur, pull-to-refresh, pagination, FAB), **création d'annonce** (`/dealplace/create` — photo obligatoire pour un bien, upload via `/media/upload`), **détail** (`/dealplace/:id`, fidèle au mockup 06). Le bouton **« Proposer un deal »** du détail est un **PLACEHOLDER** (deals = CP2.4) : il affiche un snackbar « Disponible au prochain lot ». Les notifications `system` affichent `payload.title` ou `payload.message`. Temps réel via **socket.io** (`socket_io_client`) : notifications poussées en direct + `map.updated`, avec **fallback polling ~45 s**. Header : icône messagerie **inactive** (conversations = CP2.3), cloche **active**. Les libellés Material sont localisés en français via `flutter_localizations`.

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
**Log de boot attendu (mock)** : `Mock DB prête : 15 utilisateurs, 32 follows, 42 posts (dont 13 visibles carte), 60 commentaires, 155 réactions, 12 caméras, 4 signalements, 12 notifications, 8 annonces Dealplace (20 catégories, 79 sous-catégories, 10 tags)` (suffixe Dealplace ajouté au CP2.1).
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
- **Pas de présence temps réel** (« N personnes ici » du mockup non implémenté) ; temps réel = notifications + `map.updated` seulement (pas de messagerie), **fallback polling ~45 s**.
- **Clustering client-side** (grille maison) ; clustering serveur à prévoir à grande échelle.
- Carte mobile **réelle** mais centrée sur l'île ; **GPS réel non branché** (pas de « autour de moi », position par choix de commune).
- **Dealplace (CP2.1)** : taxonomie + listings seulement. **Pas de deals** (« Proposer un deal » = placeholder, CP2.4), **pas de conversations** (CP2.3, icône messagerie inactive), **pas d'avis/profil Dealplace** (CP2.2), **pas de signalement d'annonce côté user** (modération backoffice seulement), **paiement hors app**. Annuaire filtré par commune (pas de rayon géographique) ; images seulement ; en édition, type/commune/médias non modifiables.
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

**Prochaine étape recommandée : attendre la validation du product owner du CP2.1,
puis démarrer le CP2.2** (profil Dealplace + avis détaillés). Ne pas anticiper les
checkpoints suivants avant le feu vert : conversations (CP2.3), deals contractuels
(CP2.4 — le bouton « Proposer un deal » reste un placeholder d'ici là), modération
avancée (CP2.5). **Paiement = hors app** (jamais dans le périmètre applicatif).
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

# ENDIREK — Architecture technique

Vue d'ensemble du socle posé et stabilisé au Lot 1 (« socle + expérience Live Local »),
de la première fonctionnalité du **Lot 2 — Dealplace (CP2.1 : taxonomie + listings)**,
et des points d'ancrage prévus pour les checkpoints/lots suivants.

> **Règle permanente (agents IA)** : tout agent IA travaillant sur ce repo
> doit commencer par lire `docs/AI_HANDOFF.md`, `docs/AI_DECISIONS.md` et
> `docs/AI_RUNBOOK.md`, puis vérifier `git status` avant de modifier le code.
> À la fin de chaque checkpoint, mettre à jour ces fichiers de passation.

---

## 1. Arborescence du monorepo

```
ENDIREK/
├── package.json              # Racine npm workspaces (apps/api, apps/admin)
│                             # Scripts : api:dev, api:build, api:start,
│                             #           admin:dev, admin:build
├── apps/
│   ├── api/                  # Backend NestJS (port 3001)
│   │   ├── .env.example      # Toutes les variables attendues (aucun secret)
│   │   ├── db/migrations/    # Schéma SQL PostgreSQL/PostGIS — source de
│   │   │                     # vérité : 0001/0002 (Lot 1) + 0003/0004
│   │   │                     # (Dealplace CP2.1), voir DATABASE.md
│   │   ├── uploads/          # Médias en dev (créé à l'étape 4, non versionné)
│   │   └── src/
│   │       ├── config/       # Chargement de la configuration typée
│   │       ├── common/       # DTO, guards, helpers partagés (étapes 3+)
│   │       ├── database/     # Couche persistance : interfaces + drivers
│   │       │                 # mock/ ET postgres/ (étape 2 + Lot 1.5, voir §3)
│   │       ├── adapters/     # Intégrations remplaçables (étapes 2-5, voir §3)
│   │       └── modules/      # Modules métier (voir §2), dont _future/
│   ├── admin/                # Backoffice React + Vite (port 5173)
│   │   └── .env.example      # VITE_API_URL
│   └── mobile/               # Application Flutter (org re.endirek)
│                             # Cibles : Android / iOS (+ chrome en dev)
├── infra/                    # docker-compose.yml PostgreSQL/PostGIS
│                             # (+ MinIO en commentaire — TODO Lot 2+)
├── docs/                     # INSTALL, ARCHITECTURE, DATABASE,
│                             # MOCKED_SERVICES, ACCESS_NEEDED,
│                             # KNOWN_LIMITS, TODO_LOT_2
├── 01_PRD/  02_MOCKUPS/      # Documents produit — contexte LOCAL, non versionnés
├── 03_PROMPTS/  04_ACCESS/   # (source de vérité fonctionnelle, hors repo git)
└── README.md
```

---

## 2. Backend NestJS modulaire

Un module NestJS par domaine métier, montés au fil des étapes du Lot 1 :

| Module | Rôle | Étape Lot 1 |
|---|---|---|
| `health` | `GET /health` (hors préfixe `api/v1`) — sonde de vie | 1 ✅ |
| `database` | Accès données derrière une interface unique (**11 repositories** : 9 Lot 1 + `listings` et `listing-taxonomy` du CP2.1), **deux drivers `DB_DRIVER=mock\|postgres`** au comportement identique, schéma PostGIS + seed La Réunion — voir [DATABASE.md](DATABASE.md) | 2 ✅ / Lot 1.5 ✅ / CP2.1 ✅ |
| `auth` | Email/mot de passe, JWT access+refresh, guard global ; endpoints OAuth Google/Apple en 501 | 3 ✅ |
| `users` | Comptes, profils (photo, bio, ville), follows, export + suppression RGPD (voir [RGPD.md](RGPD.md)) | 3 ✅ |
| `posts` | Publications typées (libre, météo, trafic, danger, question), `url_slug`, expiration carte 2 h, listes de profil | 4 ✅ |
| `feed` | Algorithme simple : récence + proximité + type + popularité + abonnements — implémenté DANS le module posts (`feed.service.ts`, poids centralisés `FEED_WEIGHTS`), voir `modules/feed/README.md` | 4 ✅ |
| `comments` | Commentaires (niveau 0) + réponses (niveau 1), pas de réponse à une réponse au MVP (option A) ; notifications in-app `comment`/`reply` créées à la volée | 4 ✅ |
| `reactions` | Réactions emoji sur posts et commentaires (upsert, palette validée contre la table `reaction_types`) | 4 ✅ |
| `saved-posts` | Enregistrements (collection « Général » par défaut, idempotents) | 4 ✅ |
| `media` | Upload d'images via l'adapter stockage (local implémenté, S3 en prod) : validation par décodage réel, miniatures sharp, `/uploads/` statique | 4 ✅ |
| `map` | Marqueurs par viewport/bbox, géocodage inverse (adapter), caméras + posts en un appel — `GET /map/overview`, `/map/cameras`, `/map/posts`, `/map/communes` ; seuls les types `showsOnMap` (météo/trafic/danger) sortent sur la carte | 5 ✅ |
| `cameras` | Caméras météo/trafic (numéro auto, ville déduite par géocodage, statuts) — détail public `GET /cameras/:id` (caméra `active` uniquement) ; gestion backoffice sous `/admin/cameras` | 5 ✅ |
| `notifications` | Notifications in-app persistées + émission temps réel — lecture `GET /notifications`, `/unread-count`, `PATCH /read-all`, `/:id/read` ; types `comment`/`reply`/`reaction`/`report_handled` créés via un point d'entrée unique (persistance + push socket) | 5 ✅ |
| `realtime` | Gateway WebSocket **socket.io** (namespace par défaut, auth handshake JWT) — events `notification.created` (room privée `user:<id>`) et `map.updated` (room `map`) ; fallback polling REST côté client | 5 ✅ |
| `moderation` | Signalements, masquage de posts, modération de commentaires signalés ; le signalement utilisateur de posts (`POST /posts/:id/report`, anti-doublon 409) reste le flux public Lot 1 | 4 + 6 ✅ |
| `admin` | Endpoints d'administration consommés par le backoffice — utilisateurs, publications, signalements, caméras, types de posts, commentaires signalés, notifications système dev/mock, **annonces & taxonomie Dealplace (CP2.1)** | 3-6 + CP2.1 ✅ |
| `dealplace` | **Lot 2 — CP2.1** : taxonomie biens/services (référence pilotable) + annonces (listings). `GET /dealplace/taxonomy` ; annuaire public filtré `GET /dealplace/listings` ; CRUD propriétaire `POST /dealplace/listings`, `GET …/:id` (+ `/slug/:slug`), `PATCH|DELETE …/:id` (soft-delete) ; listes de profil `GET /users/me/listings`, `GET /users/:id/listings`. Forme `LISTING`/`LISTING_CARD` assemblée par `ListingAssembler` (source unique, exportée au module `admin` — comme `FeedPostAssembler`). Règles métier au service (valeur fixe/fourchette, photo obligatoire pour un bien, catégorie `forbidden` refusée, médias `/media/upload`) | Lot 2 CP2.1 ✅ |
| `modules/_future/*` | Placeholders des checkpoints/lots non démarrés (deals, conversations, pages, news, billing — voir §6) — **TODO** | — |

> **État réel au checkpoint 7** : le socle est en place — `health`, la couche
> `database` (driver mock + seed La Réunion), `auth` et `users` (étape 3) —
> ainsi que le cœur social de l'étape 4 : `posts` (CRUD, détail par id et
> par `url_slug`, listes de profil), le feed scoré (`GET /posts/feed`),
> `comments` (deux niveaux option A, soft-delete), `reactions`,
> `saved-posts`, `media` (`POST /media/upload`, driver local + miniatures
> sharp), le signalement utilisateur (`POST /posts/:id/report`) et
> l'administration des utilisateurs, publications et signalements.
> L'étape 5 est désormais livrée : la **carte** complète (`GET /map/overview`
> pour posts + caméras en un appel, `/map/cameras`, `/map/posts`,
> `/map/communes`), les **caméras** (détail public `GET /cameras/:id` limité
> aux caméras `active` ; gestion backoffice complète sous `/admin/cameras`,
> masquage doux), les **notifications** in-app (endpoints de lecture, badge
> de non-lues ; types `comment`/`reply`/`reaction`/`report_handled` créés via
> un point d'entrée unique) et le **temps réel** (gateway socket.io, events
> `notification.created` et `map.updated`, auth handshake JWT + fallback
> polling côté client). Le checkpoint 6 consolide le backoffice :
> filtres `role`/`mapVisible`/`targetType`, gestion des `post_types`, actions
> sur commentaires signalés et notifications système dev/mock. Le checkpoint 7
> stabilise la démo Lot 1 : localisation Flutter en français, README remis à
> jour et guide [DEMO_LOT_1.md](DEMO_LOT_1.md). Le tableau est mis à jour au
> fil des étapes.

Conventions transverses :

- Routes métier préfixées **`/api/v1`** ; `GET /health` volontairement hors
  préfixe ; documentation Swagger sur **`/docs`**.
- Configuration exclusivement par variables d'environnement
  (`apps/api/.env`, modèle dans `.env.example`) — aucun secret en dur.

---

## 3. Pattern « adapters remplaçables »

Toute intégration externe est isolée derrière une **interface stable**,
avec une implémentation sélectionnée par variable d'environnement. Le code
métier ne connaît que l'interface : passer du mock au service réel ne
demande **aucun changement de code métier**, seulement du `.env`.

| Adapter | Variable de sélection | Implémentation dev (actuelle) | Implémentation prod (cible) |
|---|---|---|---|
| Base de données | `DB_DRIVER` | `mock` (en mémoire, seed La Réunion — **disponible depuis l'étape 2**, `DB_MOCK_SEED=true` par défaut) **et** `postgres` (**fonctionnel depuis le Lot 1.5** : repositories SQL + PostGIS, comportement identique — voir [DATABASE.md](DATABASE.md) §7) | `postgres` (PostgreSQL 16 + PostGIS 3.4) |
| Stockage médias | `MEDIA_STORAGE_DRIVER` | `local` (**implémenté à l'étape 4** : upload d'images + miniatures sharp, fichiers écrits sous `UPLOAD_DIR` — `apps/api/uploads/` — et servis statiquement sur `/uploads/`) | `s3` (S3/Hetzner — non implémenté : le démarrage échoue avec une erreur explicite) |
| Géocodage inverse | `GEOCODING_PROVIDER` | `mock` (**implémenté à l'étape 5**, `GEOCODING_PROVIDER=mock` : table des 12 communes de La Réunion + plus proche voisin — déduit `cityName` d'une caméra créée sans ville ; tout autre provider → `throw` explicite au démarrage) | API de géocodage réelle (`GEOCODING_API_KEY`) |
| Push | `PUSH_DRIVER` | `mock` (notifications persistées en base uniquement) | `fcm` (Firebase/APNs) |
| Email | `EMAIL_DRIVER` | `mock` (log console) | `brevo` |

Détail complet (comportements, variables, procédure de bascule) :
[MOCKED_SERVICES.md](MOCKED_SERVICES.md).

### Persistance : mock ET postgres disponibles (Lot 1.5)

La couche `apps/api/src/database/` expose un **contrat unique** (**11 repositories**
au CP2.1 — 9 du Lot 1 + `listings` et `listing-taxonomy`,
`repositories/interfaces.ts` ; entités `domain/entities.ts` ; tokens
`database.tokens.ts`) et deux implémentations sélectionnées **au chargement du
module** (`process.env.DB_DRIVER`, dans `database.module.ts`) :

- **`mock/`** (défaut, fallback) : repositories in-memory + `MockDatabaseService`
  — spécification de comportement de référence, seed La Réunion en mémoire.
- **`postgres/`** (fonctionnel depuis le Lot 1.5) : un **pool `pg` partagé**
  (`postgres-pool.ts`, token `POSTGRES_POOL`), les **11 repositories SQL** (9 du
  Lot 1 + `postgres-listings` et `postgres-listing-taxonomy` du CP2.1,
  `repositories/postgres-*.repository.ts`, **SQL brut paramétré**, pas d'ORM),
  des **mappers ligne→entité** (`pg-helpers.ts`, conversions snake_case→camelCase,
  jsonb, GeoPoint), un **seeder idempotent** (`postgres-seeder.ts`, réutilise
  `buildSeed()`) et `postgres-database.service.ts` (ping + seed + fermeture du
  pool). En mode postgres, la couche mock n'est **pas instanciée**.

**PostGIS** : les colonnes `location` sont `geometry(Point,4326)` — écriture
`ST_SetSRID(ST_MakePoint(lng,lat),4326)`, lecture `ST_Y(location) AS lat,
ST_X(location) AS lng`, bbox via `ST_MakeEnvelope(…) && location`. Les
**compteurs dénormalisés sont calculés à la lecture** (sous-requêtes/JOIN),
garantissant la parité de comportement avec le mock.

---

## 4. Stack technique

| Couche | Choix | Justification courte |
|---|---|---|
| Mobile | Flutter + Riverpod + go_router + flutter_map | Un seul code Android/iOS ; Riverpod = état testable ; go_router = deep links (slugs de posts) ; flutter_map = tuiles OSM/MapLibre sans clé en dev |
| Backend | NestJS (Node ≥ 22, TypeScript) | Modulaire par design, DI native (idéale pour les adapters), écosystème mûr (Swagger, WebSocket, guards JWT) |
| Base de données | PostgreSQL 16 + PostGIS 3.4 | Requêtes géospatiales natives (proximité, bbox carte) — cœur de « Live Local » ; relationnel robuste pour le social |
| Backoffice | React + Vite | SPA légère, démarrage instantané, largement maîtrisée ; suffisant pour un backoffice CRUD |
| Cartographie | MapLibre / tuiles OSM | Open source, sans clé en développement ; compatible flutter_map côté mobile ; provider dédié prévu en prod (voir [KNOWN_LIMITS.md](KNOWN_LIMITS.md)) |

---

## 5. Décisions structurantes

- **Préfixe `api/v1`** sur toutes les routes métier : versionnement d'API
  dès le départ, évolutions non cassantes pour l'app mobile déployée.
- **`GET /health` hors préfixe** : URL stable pour les sondes
  (reverse proxy, orchestrateur), indépendante des versions d'API.
- **JWT access + refresh** (`JWT_*` dans `.env`) : sessions mobiles longues
  sans stocker de session serveur. Au Lot 1, le refresh est **stateless** :
  aucune révocation côté serveur (le logout ne révoque rien, le client jette
  ses jetons) — la révocation unitaire viendra avec la **persistance des
  refresh tokens** (TODO, voir [RGPD.md](RGPD.md) §5).
- **Guard JWT global + `@Public()`** : toutes les routes exigent un jeton
  par défaut (`APP_GUARD`) ; seules les routes explicitement décorées
  `@Public()` (register, login, refresh, placeholders OAuth) sont ouvertes —
  impossible d'oublier de protéger un nouvel endpoint.
- **Le guard recharge l'utilisateur à chaque requête** : le statut du compte
  est toujours à jour — les jetons encore valides d'un compte supprimé
  (RGPD) ou suspendu (modération) sont rejetés immédiatement (401/403), sans
  liste de révocation.
- **Temps réel = socket.io, canal minimal** (étape 5) : gateway sur le
  namespace par défaut, **authentification au handshake** (access token JWT
  dans `handshake.auth.token`, rejeté si compte supprimé/suspendu — même
  politique que le guard HTTP). Deux events sortants seulement :
  `notification.created` (room privée `user:<id>`) et `map.updated` (room
  `map`, rejointe via `map.subscribe`). Le temps réel est un **confort, pas
  une source de vérité** : si le socket est indisponible, le client retombe
  sur du **polling REST** (`GET /notifications/unread-count`, ~45 s). La
  gateway sert de socle au temps réel futur (conversations Dealplace —
  TODO Lot 2+). **Pas de messagerie au Lot 1.**
- **Carte : flutter_map + tuiles OSM sans clé** (étape 5) : rendu client via
  `flutter_map`, tuiles publiques OpenStreetMap (dev uniquement, provider
  dédié en prod via `MAP_TILE_URL`/`MAP_API_KEY` — voir
  [KNOWN_LIMITS.md](KNOWN_LIMITS.md)). **Clustering client-side** par grille
  maison (regroupement des marqueurs proches, barycentre affiché) —
  suffisant au volume du Lot 1 ; l'architecture reste prête pour un
  clustering serveur à grande échelle. La carte est centrée sur l'île (pas
  de « autour de moi » : GPS réel non branché).
- **`REUNION_BBOX` partagée** : l'emprise géographique de La Réunion est une
  **source unique** (`common/geo/reunion.ts`), importée par les modules
  `posts` (création) et `cameras` (création/mise à jour) — aucune constante
  dupliquée ; l'exportabilité future passera par une table de territoires.
- **Caméra masquée = suppression douce** : `DELETE /admin/cameras/:id` passe
  la caméra en statut `hidden` (jamais de suppression dure) — le
  `cameraNumber` est préservé (numérotation stable, traçabilité). Une caméra
  non `active` n'apparaît jamais côté public (carte ni `GET /cameras/:id`,
  404 pour ne pas divulguer son existence).
- **Notifications : point d'entrée unique** (étape 5) : tous les producteurs
  (`comment`, `reply`, `reaction`, `report_handled`) passent par
  `NotificationsService.create`, qui **persiste puis émet** en temps réel —
  une seule source pour la base et la diffusion. Jamais de notification à
  soi-même. Lecture strictement limitée aux notifications du user courant.
- **Scoring du feed à poids centralisés** : les poids de l'algorithme
  (récence, proximité, type, popularité, abonnements) vivent dans une seule
  constante extensible (`FEED_WEIGHTS`, `posts/feed.service.ts`) — aucune
  valeur magique dispersée ; re-régler le feed = ajuster une constante. Le
  scoring vit dans le **service** (`feed.service.ts`) au-dessus d'une fenêtre de
  posts candidats fournie par le repository — donc **identique en mock et en
  postgres** (le driver SQL ne fait que renvoyer la fenêtre `active` récente).
- **Fichiers médias servis statiquement = URLs publiques** : `/uploads/`
  est monté hors préfixe `api/v1` ET hors guard JWT (les fichiers statiques
  Express ne passent pas par les guards Nest — c'est voulu). Quiconque
  possède l'URL d'un média peut le lire ; les noms de fichiers aléatoires
  (crypto) rendent les URLs non devinables.
- **Anti-doublon de signalement garanti en base** : la contrainte
  `UNIQUE (reporter_id, target_type, target_id)` de la table `reports`
  (migration `0001`) double la vérification du service — un même
  utilisateur ne signale une même cible qu'une fois (409 côté API), même
  en cas de requêtes concurrentes.
- **Option A appliquée à l'API** : la limite « commentaire (depth 0) +
  réponse (depth 1), jamais de niveau 2+ » n'est pas qu'une contrainte de
  schéma — le service commentaires refuse en 400 toute réponse à une
  réponse, et le fil est servi déjà imbriqué sur deux niveaux.
- **`url_slug` sur les posts publics** : chaque post public est conçu pour
  avoir une URL web partageable plus tard (SEO, partage hors app).
- **`page_id` nullable sur les entités de publication** : anticipe les pages
  restaurants/entreprises (un post pourra être émis par une page et non un
  utilisateur) sans migration cassante — TODO Lot 2+.
- **Expiration carte ≠ expiration feed** : les posts météo/trafic/danger
  disparaissent de la carte après 2 h (par défaut) mais restent dans le feed.

---

## 5 bis. Carte & temps réel (étape 5)

**Carte (HTTP).** L'écran carte mobile consomme le module `map` :

- `GET /map/overview` — **point d'entrée mobile** : un seul appel ramène les
  marqueurs de posts *et* les caméras actives (mêmes filtres de bbox et de
  catégorie). `GET /map/posts` et `GET /map/cameras` restent disponibles pour
  un rafraîchissement ciblé, `GET /map/communes` fournit le référentiel des
  12 centres-villes.
- **bbox optionnelle** : les 4 bornes (`minLat/minLng/maxLat/maxLng`) vont
  ensemble (toutes → filtre, aucune → toute l'île, partiel/inversé → 400).
- **Filtre de sécurité** : seuls les types de posts `showsOnMap`
  (météo/trafic/danger, piloté par `post_types`) et les posts non expirés
  (`mapExpiresAt` futur) sortent sur la carte — un post libre/question
  géolocalisé n'y apparaît jamais. Les caméras servies sont `active`
  uniquement, en projection `CAMERA_PUBLIC` (sans `status`/`updatedAt`).

**Temps réel (socket.io).** Le module `realtime` expose une gateway sur le
namespace par défaut, dont le CORS reprend `app.corsOrigins` via
`RealtimeIoAdapter` (branché au boot dans `main.ts`) :

- **Handshake authentifié** : le client fournit son access token
  (`handshake.auth.token` ou `?token=`) ; la gateway vérifie la signature,
  recharge l'utilisateur et refuse la connexion s'il est absent/non `active`.
- **Rooms** : chaque connexion rejoint sa room privée `user:<id>` ; l'écran
  carte rejoint la room commune `map` en émettant `map.subscribe`.
- **Events sortants** : `notification.created` (`{ notification, unreadCount }`
  vers la room du destinataire, émis par `NotificationsService.create` après
  persistance) et `map.updated` (`{ reason }` vers la room `map`, émis à la
  création d'un post visible carte — le client recharge alors `/map/overview`).
- **Fallback** : si le socket est indisponible, le client poll
  `GET /notifications/unread-count` (~45 s). Aucun message entrant traité
  hormis l'abonnement carte — **pas de messagerie au Lot 1**.

---

## 6. Checkpoints/lots suivants (points d'ancrage)

Le CP2.1 est livré (module réel `modules/dealplace` + tables 0003/0004). Le reste
n'est **pas** développé — uniquement des ancrages propres, marqués **TODO** dans
le code :

| Chantier | Statut | Ancrage posé dans le socle |
|---|---|---|
| Dealplace : taxonomie biens/services + listings | ✅ **CP2.1** | Module réel `modules/dealplace` (remplace `_future/dealplace`) ; onglet Dealplace mobile réel ; tables `listing_*` (migrations 0003/0004) |
| Avis / profil Dealplace | ⏳ CP2.2 | Profil `users` du Lot 1 à étendre (pas de duplication) |
| Conversations 1-to-1 temps réel | ⏳ CP2.3 | Gateway WebSocket de l'étape 5 (namespaces réservés) ; `modules/_future/conversations` ; icône messagerie mobile (inactive) |
| Deals contractuels (états, éléments validables, litiges) | ⏳ CP2.4 | `modules/_future/deals` ; machine à états documentée dans [TODO_LOT_2.md](TODO_LOT_2.md) ; bouton « Proposer un deal » (placeholder) |
| Pages restaurants / entreprises | ⏳ Lot 3 | `page_id` nullable ; `modules/_future/pages` ; profil utilisateur prêt à « posséder » des pages |
| News IA automatisées | ⏳ Lot 4 | Onglet News placeholder mobile ; `modules/_future/news` |
| Premium / monétisation (Stripe, Google Ads) | ⏳ transverse | `modules/_future/billing` ; variables réservées dans [ACCESS_NEEDED.md](ACCESS_NEEDED.md). **Paiement Dealplace = hors app.** |

Détail des TODO du Lot 2 : [TODO_LOT_2.md](TODO_LOT_2.md).

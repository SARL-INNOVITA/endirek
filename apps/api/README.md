# @endirek/api — Backend Endirek

API REST + WebSocket (NestJS 11) du réseau social mobile local temps réel de La Réunion.
Elle sert l'application mobile Flutter (`apps/mobile`) et le backoffice (`apps/admin`).

> **État actuel — étape 5** : configuration typée, healthcheck, couche
> persistance (driver mock + seed La Réunion), authentification JWT (guard
> global), profils/follows/RGPD (étape 3), le cœur social (étape 4 :
> publications, feed scoré, commentaires deux niveaux, réactions,
> enregistrements, upload d'images, signalements et modération backoffice)
> puis l'étape 5 : **carte** (`/map/overview`, `/map/cameras`, `/map/posts`,
> `/map/communes`), **caméras** (`GET /cameras/:id` public + gestion
> `/admin/cameras`), **notifications** in-app (lecture + badge de non-lues,
> types `comment`/`reply`/`reaction`/`report_handled`) et **temps réel**
> (gateway socket.io, events `notification.created` / `map.updated`, auth
> handshake JWT + fallback polling). Reste le complément backoffice de
> l'étape 6.

## Lancement

Depuis la **racine du monorepo** :

```bash
npm install          # installe tous les workspaces
npm run api:dev      # démarre l'API en mode watch
```

Ou directement depuis `apps/api` :

```bash
npm run start:dev
```

Avant le premier lancement, copier `.env.example` vers `.env` et ajuster si besoin
(les valeurs par défaut fonctionnent en développement local, tout est mocké).

## URLs

| URL | Description |
|---|---|
| `http://localhost:3001/health` | Healthcheck (hors préfixe, pour la supervision) |
| `http://localhost:3001/docs` | Documentation Swagger (OpenAPI) |
| `http://localhost:3001/api/v1/...` | Routes métier (préfixe global `api/v1`) |

Toutes les routes métier sont préfixées par **`api/v1`** ; seul `/health` est exclu
du préfixe afin de rester accessible aux sondes (Docker, Hetzner, monitoring).

## Modules et planning d'implémentation (Lot 1)

| Module | Rôle | Étape |
|---|---|---|
| `health` | Healthcheck | **1 ✅** |
| `config` (src/config) | Configuration typée depuis l'environnement | **1 ✅** |
| `database` (src/database) | Persistance PostgreSQL/PostGIS + adapter mock (seed La Réunion) | **2 ✅** |
| `auth` | Email/mot de passe (bcrypt), JWT access+refresh, guard global + `@Public()`, OAuth Google/Apple en 501 | **3 ✅** |
| `users` | Profils (complet/public), follows, export RGPD, suppression RGPD (voir [docs/RGPD.md](../../docs/RGPD.md)) | **3 ✅** |
| `media` | `POST /media/upload` — images JPEG/PNG/WebP validées par décodage réel, miniatures webp (sharp), fichiers servis sur `/uploads/` | **4 ✅** |
| `posts` | Publications (libre, météo, trafic, danger, question), détail par id et `url_slug`, listes de profil, règles carte (`mapExpiresAt`) | **4 ✅** |
| `feed` | Fil d'actualité (algorithme MVP, poids centralisés `FEED_WEIGHTS`) — implémenté dans le module `posts` (`feed.service.ts`, voir `modules/feed/README.md`) | **4 ✅** |
| `comments` | Commentaires (niveau 0) + réponses (niveau 1) — pas de réponse à une réponse au Lot 1 ; notifications in-app `comment`/`reply` créées | **4 ✅** |
| `reactions` | Réactions emoji sur posts et commentaires (upsert, palette validée contre `reaction_types`) | **4 ✅** |
| `saved-posts` | Enregistrements (collection « Général » par défaut, idempotents) | **4 ✅** |
| `map` | Carte interactive — mode Météo & trafic : `GET /map/overview` (posts + caméras en un appel), `/map/cameras`, `/map/posts`, `/map/communes` ; seuls les types `showsOnMap` non expirés sortent sur la carte | **5 ✅** |
| `cameras` | Caméras météo/trafic — `GET /cameras/:id` public (caméra `active` uniquement) ; numéro auto, ville déduite par géocodage, statuts | **5 ✅** |
| `notifications` | Notifications in-app — lecture (`GET /notifications`, `/unread-count`, `PATCH /read-all`, `/:id/read`), types `comment`/`reply`/`reaction`/`report_handled` via un point d'entrée unique (persistance + émission socket) | **5 ✅** |
| `realtime` | Gateway WebSocket **socket.io** (namespace par défaut, auth handshake JWT) — events `notification.created` / `map.updated`, CORS aligné via `RealtimeIoAdapter` | **5 ✅** |
| `moderation` | Signalements et traitement — **signalement utilisateur fait à l'étape 4** (`POST /posts/:id/report`, anti-doublon 409) | **4 partiel** / 6 |
| `admin` | Endpoints du backoffice — **utilisateurs (étape 3), publications et signalements (étape 4), caméras (étape 5 : 6 routes `/admin/cameras`)** ; les paramètres des types de posts à l'étape 6 | **3-5 partiel** / 6 |
| `_future/*` | Lots 2+ (pages, dealplace, deals, conversations, news, billing) | TODO Lot 2+ |

Chaque dossier de module contient un `README.md` détaillant son périmètre et
les règles métier du Lot 1 ; les modules de l'étape 6 n'ont pas encore de
code (hors parties partielles ci-dessus), seuls leurs README documentent
l'architecture cible.

## Exemples rapides (étape 4)

Se connecter puis poser le Bearer token (`<TOKEN>`) — tout est aussi
testable dans Swagger (`/docs`, bouton « Authorize ») :

```bash
# Types de publication (référence pilotable post_types)
curl http://localhost:3001/api/v1/posts/types -H "Authorization: Bearer <TOKEN>"

# Feed scoré (lat/lng optionnels — bonus de proximité)
curl "http://localhost:3001/api/v1/posts/feed?limit=5&lat=-21.34&lng=55.48" \
  -H "Authorization: Bearer <TOKEN>"

# Créer un post trafic géolocalisé (visible carte 2 h)
curl -X POST http://localhost:3001/api/v1/posts \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"typeSlug":"traffic","body":"Bouchon route du littoral, comptez 30 minutes.","location":{"lat":-20.9,"lng":55.35}}'

# Commenter, réagir, enregistrer, signaler
curl -X POST http://localhost:3001/api/v1/posts/<POST_ID>/comments \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"body":"Merci pour le signalement !"}'
curl -X POST http://localhost:3001/api/v1/posts/<POST_ID>/reactions \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"emoji":"👍"}'
curl -X POST http://localhost:3001/api/v1/posts/<POST_ID>/save \
  -H "Authorization: Bearer <TOKEN>"
curl -X POST http://localhost:3001/api/v1/posts/<POST_ID>/report \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"reasonCode":"spam"}'

# Uploader une image (multipart) puis la référencer dans POST /posts (media[])
curl -X POST http://localhost:3001/api/v1/media/upload \
  -H "Authorization: Bearer <TOKEN>" -F "file=@photo.jpg"
```

## Exemples rapides — carte & notifications (étape 5)

```bash
# Carte : posts + caméras en un seul appel (bbox et filtres optionnels)
curl "http://localhost:3001/api/v1/map/overview" -H "Authorization: Bearer <TOKEN>"

# Caméras actives (filtre de catégorie optionnel : weather|traffic)
curl "http://localhost:3001/api/v1/map/cameras?categories=traffic" \
  -H "Authorization: Bearer <TOKEN>"

# Détail public d'une caméra active (404 si masquée/inactive/inexistante)
curl "http://localhost:3001/api/v1/cameras/<CAMERA_ID>" -H "Authorization: Bearer <TOKEN>"

# Mes notifications (avec total et unreadCount) puis compteur de non-lues
curl "http://localhost:3001/api/v1/notifications?limit=20" -H "Authorization: Bearer <TOKEN>"
curl "http://localhost:3001/api/v1/notifications/unread-count" -H "Authorization: Bearer <TOKEN>"
curl -X PATCH "http://localhost:3001/api/v1/notifications/read-all" -H "Authorization: Bearer <TOKEN>"

# Backoffice caméras (rôle moderator/super_admin ; DELETE = masquage doux)
curl -X POST http://localhost:3001/api/v1/admin/cameras \
  -H "Authorization: Bearer <TOKEN_ADMIN>" -H "Content-Type: application/json" \
  -d '{"name":"Caméra Saint-Denis Barachois","streamType":"image","url":"https://exemple.re/cam.jpg","category":"traffic","description":"Vue front de mer","location":{"lat":-20.87,"lng":55.45},"status":"active"}'
```

Le temps réel (socket.io) écoute sur le même port (3001), hors préfixe
`api/v1` ; il se vérifie surtout depuis l'app mobile (voir
[docs/AI_RUNBOOK.md](../../docs/AI_RUNBOOK.md) §4 bis).

## Comptes de test (seed)

Avec `DB_DRIVER=mock` et `DB_MOCK_SEED=true` (défauts), 15 comptes de
démonstration La Réunion sont chargés au boot — **mot de passe commun de
développement : `endirek974`** (haché bcrypt comme en réel ; à ne jamais
utiliser en production). Emails en `@endirek.invalid`, liste complète dans
`src/database/seed/users.seed.ts`. Notamment :

| Compte | Email | Rôle |
|---|---|---|
| Équipe Endirek | `equipe@endirek.invalid` | `super_admin` |
| Marie Hoarau | `marie.hoarau@endirek.invalid` | `moderator` |
| Jean-Yves Payet | `jean-yves.payet@endirek.invalid` | `user` (13 autres comptes `user` du même type) |

## Architecture « adapters remplaçables »

Les services externes sont abstraits derrière des interfaces avec un driver
sélectionné par variable d'environnement — jamais de clé hardcodée, jamais de
blocage si un service externe manque :

| Domaine | Variable | Drivers |
|---|---|---|
| Stockage médias | `MEDIA_STORAGE_DRIVER` | `local` (dev) → `s3` (Hetzner) |
| Géocodage inverse | `GEOCODING_PROVIDER` | `mock` (implémenté : 12 communes + plus proche voisin) → API réelle plus tard |
| Notifications push | `PUSH_DRIVER` | `mock` (dev) → Firebase/APNs plus tard |
| Email transactionnel | `EMAIL_DRIVER` | `mock` (dev) → Brevo plus tard |

## Stratégie base de données

- **Cible et source de vérité du schéma : PostgreSQL/PostGIS** (via Docker,
  `infra/docker-compose.yml`).
- **Sans Docker (état actuel)** : `DB_DRIVER=mock` — un adapter local implémente
  la même interface que Postgres, permettant de développer et démontrer sans
  infrastructure.
- La bascule vers le vrai Postgres se fait par simple changement de
  `DB_DRIVER=postgres` dès que Docker est disponible.
- Mise en place à l'**étape 2** (schéma + seed de données réalistes La Réunion).
  Voir `src/database/README.md`.

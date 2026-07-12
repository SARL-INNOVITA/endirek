# @endirek/api — Backend Endirek

API REST + WebSocket (NestJS 11) du réseau social mobile local temps réel de La Réunion.
Elle sert l'application mobile Flutter (`apps/mobile`) et le backoffice (`apps/admin`).

> **État actuel — Lot 1 complet + Lot 2 (Dealplace) complet** : configuration
> typée, healthcheck, couche persistance à **deux drivers** (`mock` défaut /
> `postgres` fonctionnel — Lot 1.5), authentification JWT (guard global),
> profils/follows/RGPD, cœur social (publications, feed scoré, commentaires
> deux niveaux, réactions, enregistrements, upload d'images), carte, caméras,
> notifications in-app, temps réel (socket.io), backoffice consolidé — puis
> le **Lot 2** : taxonomie + annonces Dealplace (CP2.1), profil Dealplace
> (CP2.2), conversations 1-to-1 temps réel (CP2.3), deals contractuels + avis
> (CP2.4) et **modération avancée** (CP2.5 : signalement d'annonce, arbitrage
> des litiges, modération des messages). Voir
> [docs/AI_HANDOFF.md](../../docs/AI_HANDOFF.md).

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
| `database` (src/database) | Persistance : contrat unique + **deux drivers `mock` et `postgres`** (SQL/PostGIS, fonctionnel depuis le Lot 1.5), seed La Réunion | **2 ✅ / Lot 1.5 ✅** |
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
| `moderation` | Signalements et traitement — posts (`POST /posts/:id/report`, étape 4) et **annonces Dealplace** (`POST /dealplace/listings/:id/report`, CP2.5 — D65), anti-doublon 409 | **4 + 6 + CP2.5 ✅** |
| `admin` | Endpoints du backoffice — utilisateurs, publications, signalements, caméras, types de posts, commentaires, notifications système, **annonces & taxonomie Dealplace (CP2.1)**, **deals/litiges & conversations (CP2.5)** | **3-6 + Lot 2 ✅** |
| `dealplace` | **Lot 2 — CP2.1/CP2.2** : taxonomie biens/services pilotable + annonces (annuaire filtré, CRUD propriétaire, listes de profil) | **Lot 2 ✅** |
| `conversations` | **Lot 2 — CP2.3/CP2.5** : messagerie 1-to-1 liée aux annonces, temps réel, modération des messages | **Lot 2 ✅** |
| `deals` | **Lot 2 — CP2.4/CP2.5** : deals contractuels (machine à états, éléments validables, ajustements, avis) + arbitrage des litiges | **Lot 2 ✅** |
| `_future/*` | Lots 3+ (pages, news, billing) | TODO Lot 3+ |

Chaque dossier de module contient un `README.md` détaillant son périmètre et
ses règles métier.

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

## Stratégie base de données — deux drivers (`DB_DRIVER`)

Le choix du driver est lu **au chargement du module** (`process.env.DB_DRIVER`) ;
les deux ont un **comportement observable identique** :

- **`DB_DRIVER=mock` (défaut, fallback)** : adapter in-memory (seed La Réunion),
  aucune infra requise — idéal pour développer l'API.
- **`DB_DRIVER=postgres` (fonctionnel depuis le Lot 1.5)** : repositories **SQL
  brut paramétré** (`pg`, pas d'ORM) au-dessus du conteneur Docker PostgreSQL +
  PostGIS (`src/database/postgres/` : pool partagé, mappers, seeder idempotent).
  Les compteurs dénormalisés sont **calculés à la lecture** (parité mock).

**Cible et source de vérité du schéma : PostgreSQL 16 + PostGIS 3.4** (migrations
`db/migrations/`, appliquées via Docker `infra/docker-compose.yml`).

Mise en route du mode postgres (voir [docs/AI_RUNBOOK.md](../../docs/AI_RUNBOOK.md) §8 bis) :

```bash
docker compose -f infra/docker-compose.yml up -d postgres   # conteneur endirek-postgres
npm run db:migrate --workspace apps/api                      # applique 0001 + 0002 (13 tables + référence)
# puis dans apps/api/.env : DB_DRIVER=postgres (DATABASE_URL déjà pointée sur localhost:5432)
npm run db:reset --workspace apps/api                        # (optionnel) vide les données → re-seed au prochain boot
```

Schéma + seed posés à l'**étape 2**, driver postgres livré au **Lot 1.5**.
Détails : `src/database/README.md` et [docs/DATABASE.md](../../docs/DATABASE.md).

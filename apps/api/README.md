# @endirek/api — Backend Endirek

API REST + WebSocket (NestJS 11) du réseau social mobile local temps réel de La Réunion.
Elle sert l'application mobile Flutter (`apps/mobile`) et le backoffice (`apps/admin`).

> **État actuel — étape 1 (socle)** : seuls la configuration typée et le healthcheck
> sont câblés. Aucune logique métier, aucune base de données, aucun ORM pour l'instant.

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
| `health` | Healthcheck | **1 (fait)** |
| `config` (src/config) | Configuration typée depuis l'environnement | **1 (fait)** |
| `database` (src/database) | Persistance PostgreSQL/PostGIS + adapter mock | 2 |
| `auth` | Authentification email/mot de passe, JWT, OAuth préparé | 3 |
| `users` | Profils, followers, paramètres | 3 |
| `media` | Upload et stockage des médias | 4 |
| `posts` | Publications (libre, météo, trafic, danger, question) | 4 |
| `feed` | Fil d'actualité (algorithme MVP) | 4 |
| `comments` | Commentaires (2 niveaux max) | 4 |
| `reactions` | Réactions emoji (6 réactions MVP) | 4 |
| `saved-posts` | Enregistrements (catégorie « Général » par défaut) | 4 |
| `map` | Carte interactive — mode Météo & trafic | 5 |
| `cameras` | Caméras météo/trafic | 5 |
| `notifications` | Notifications in-app (push préparé) | 5 |
| `realtime` | Gateway WebSocket temps réel | 5 |
| `moderation` | Signalements et traitement | 6 |
| `admin` | Endpoints du backoffice minimal | 6 |
| `_future/*` | Lots 2+ (pages, dealplace, deals, conversations, news, billing) | TODO Lot 2+ |

Chaque dossier de module contient un `README.md` détaillant son périmètre et
les règles métier du Lot 1. À cette étape, **aucun fichier `.ts`** n'existe dans
ces dossiers (hors `health`) : seuls les README documentent l'architecture cible.

## Architecture « adapters remplaçables »

Les services externes sont abstraits derrière des interfaces avec un driver
sélectionné par variable d'environnement — jamais de clé hardcodée, jamais de
blocage si un service externe manque :

| Domaine | Variable | Drivers |
|---|---|---|
| Stockage médias | `MEDIA_STORAGE_DRIVER` | `local` (dev) → `s3` (Hetzner) |
| Géocodage | `GEOCODING_PROVIDER` | `mock` (dev) → API réelle plus tard |
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

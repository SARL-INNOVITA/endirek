# @endirek/api — Backend Endirek

API REST + WebSocket (NestJS 11) du réseau social mobile local temps réel de La Réunion.
Elle sert l'application mobile Flutter (`apps/mobile`) et le backoffice (`apps/admin`).

> **État actuel — étape 3** : configuration typée, healthcheck, couche
> persistance (driver mock + seed La Réunion), authentification JWT (guard
> global), profils/follows/RGPD et gestion des utilisateurs du backoffice
> sont câblés. Les modules posts/feed/carte/notifications arrivent aux
> étapes 4 et 5.

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
| `media` | Upload et stockage des médias | 4 |
| `posts` | Publications (libre, météo, trafic, danger, question) | 4 |
| `feed` | Fil d'actualité (algorithme MVP) | 4 |
| `comments` | Commentaires (niveau 0) + réponses (niveau 1) — pas de réponse à une réponse au Lot 1 | 4 |
| `reactions` | Réactions emoji (6 réactions MVP) | 4 |
| `saved-posts` | Enregistrements (catégorie « Général » par défaut) | 4 |
| `map` | Carte interactive — mode Météo & trafic | 5 |
| `cameras` | Caméras météo/trafic | 5 |
| `notifications` | Notifications in-app (push préparé) | 5 |
| `realtime` | Gateway WebSocket temps réel | 5 |
| `moderation` | Signalements et traitement | 6 |
| `admin` | Endpoints du backoffice — **gestion des utilisateurs (liste/détail/statut) faite à l'étape 3** ; le reste à l'étape 6 | **3 partiel** / 6 |
| `_future/*` | Lots 2+ (pages, dealplace, deals, conversations, news, billing) | TODO Lot 2+ |

Chaque dossier de module contient un `README.md` détaillant son périmètre et
les règles métier du Lot 1 ; les modules des étapes 4 à 6 n'ont pas encore de
code, seuls leurs README documentent l'architecture cible.

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

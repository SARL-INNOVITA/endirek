# ENDIREK — Architecture technique

Vue d'ensemble du socle posé au Lot 1 (« socle + expérience Live Local »)
et des points d'ancrage prévus pour les lots suivants.

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
│   │   │                     # vérité (étape 2, voir DATABASE.md)
│   │   ├── uploads/          # Médias en dev (créé à l'étape 4, non versionné)
│   │   └── src/
│   │       ├── config/       # Chargement de la configuration typée
│   │       ├── common/       # DTO, guards, helpers partagés (étapes 3+)
│   │       ├── database/     # Couche persistance (étape 2, voir §3)
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
| `database` | Accès données derrière une interface (`DB_DRIVER=postgres\|mock`), schéma PostGIS + seed La Réunion — voir [DATABASE.md](DATABASE.md) | 2 ✅ |
| `auth` | Email/mot de passe, JWT access+refresh ; endpoints OAuth Google/Apple en 501 | 3 |
| `users` | Comptes, profils (photo, bio, ville), follows | 3 |
| `posts` | Publications typées (libre, météo, trafic, danger, question), `url_slug`, expiration carte 2 h | 4 |
| `feed` | Algorithme simple : récence + proximité + type + popularité + abonnements | 4 |
| `comments` | Commentaires (niveau 0) + réponses (niveau 1), pas de réponse à une réponse au MVP | 4 |
| `reactions` | Réactions emoji (set MVP : 👍 ❤️ 😂 😮 😢 😡) | 4 |
| `saved-posts` | Enregistrements (catégorie « Général » par défaut) | 4 |
| `media` | Upload via l'adapter stockage (local en dev, S3 en prod) | 4 |
| `map` | Marqueurs par viewport/mode, géocodage inverse (adapter), proximité | 5 |
| `cameras` | Caméras météo/trafic (numéro auto, ville déduite, statut) | 5 |
| `notifications` | Notifications in-app persistées + adapter push (mock en dev) | 5 |
| `realtime` | Gateway WebSocket (socle temps réel, consommé dès la carte live) | 5 |
| `moderation` | Signalements, masquage de posts, outillage backoffice | 6 |
| `admin` | Endpoints d'administration consommés par le backoffice | 6 |
| `modules/_future/*` | Placeholders des lots suivants (voir §6) — **TODO Lot 2+** | — |

> **État réel à l'étape 2** : seuls `health` et la couche `database`
> (schéma SQL source de vérité + driver mock + seed La Réunion) sont
> implémentés — la couche donnée est interne, aucune route métier ne
> l'expose encore. Les autres modules listés ci-dessus décrivent le plan
> de montage du Lot 1 ; le tableau est mis à jour au fil des étapes.

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
| Base de données | `DB_DRIVER` | `mock` (en mémoire, seed La Réunion — **disponible depuis l'étape 2**, `DB_MOCK_SEED=true` par défaut) | `postgres` (PostgreSQL + PostGIS — driver à implémenter, voir [DATABASE.md](DATABASE.md) §7) |
| Stockage médias | `MEDIA_STORAGE_DRIVER` | `local` (disque, `apps/api/uploads/`) | `s3` (S3/Hetzner) |
| Géocodage inverse | `GEOCODING_PROVIDER` | `mock` (table des communes de La Réunion + plus proche voisin) | API de géocodage réelle (`GEOCODING_API_KEY`) |
| Push | `PUSH_DRIVER` | `mock` (notifications persistées en base uniquement) | `fcm` (Firebase/APNs) |
| Email | `EMAIL_DRIVER` | `mock` (log console) | `brevo` |

Détail complet (comportements, variables, procédure de bascule) :
[MOCKED_SERVICES.md](MOCKED_SERVICES.md).

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
  sans stocker de session serveur ; le refresh permet la révocation.
- **Gateway WebSocket posée à l'étape 5** : la carte live l'utilise dès le
  Lot 1, et elle sert de socle au temps réel futur (conversations
  Dealplace — TODO Lot 2+).
- **`url_slug` sur les posts publics** : chaque post public est conçu pour
  avoir une URL web partageable plus tard (SEO, partage hors app).
- **`page_id` nullable sur les entités de publication** : anticipe les pages
  restaurants/entreprises (un post pourra être émis par une page et non un
  utilisateur) sans migration cassante — TODO Lot 2+.
- **Expiration carte ≠ expiration feed** : les posts météo/trafic/danger
  disparaissent de la carte après 2 h (par défaut) mais restent dans le feed.

---

## 6. Anticipation des Lots 2+ (points d'ancrage)

Rien de tout cela n'est développé au Lot 1 — uniquement des ancrages
propres, marqués **TODO Lot 2+** dans le code :

| Futur module | Ancrage posé dans le socle |
|---|---|
| Dealplace (taxonomie biens/services, listings) | Onglet placeholder dans la bottom nav mobile ; dossier `modules/_future/dealplace` |
| Deals contractuels (états, éléments validables, litiges) | `modules/_future/deals` ; machine à états documentée dans [TODO_LOT_2.md](TODO_LOT_2.md) |
| Conversations 1-to-1 temps réel | Gateway WebSocket de l'étape 5 (namespaces réservés) ; `modules/_future/conversations` |
| Pages restaurants / entreprises | `page_id` nullable ; `modules/_future/pages` ; profil utilisateur prêt à « posséder » des pages |
| News IA automatisées | Onglet News placeholder mobile ; `modules/_future/news` |
| Premium / monétisation (Stripe, Google Ads) | `modules/_future/billing` ; variables réservées dans [ACCESS_NEEDED.md](ACCESS_NEEDED.md) |

Détail des TODO du Lot 2 : [TODO_LOT_2.md](TODO_LOT_2.md).

# ENDIREK — Architecture technique

Vue d'ensemble du socle posé au Lot 1 (« socle + expérience Live Local »)
et des points d'ancrage prévus pour les lots suivants.

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
| `auth` | Email/mot de passe, JWT access+refresh, guard global ; endpoints OAuth Google/Apple en 501 | 3 ✅ |
| `users` | Comptes, profils (photo, bio, ville), follows, export + suppression RGPD (voir [RGPD.md](RGPD.md)) | 3 ✅ |
| `posts` | Publications typées (libre, météo, trafic, danger, question), `url_slug`, expiration carte 2 h, listes de profil | 4 ✅ |
| `feed` | Algorithme simple : récence + proximité + type + popularité + abonnements — implémenté DANS le module posts (`feed.service.ts`, poids centralisés `FEED_WEIGHTS`), voir `modules/feed/README.md` | 4 ✅ |
| `comments` | Commentaires (niveau 0) + réponses (niveau 1), pas de réponse à une réponse au MVP (option A) ; notifications in-app `comment`/`reply` créées à la volée | 4 ✅ |
| `reactions` | Réactions emoji sur posts et commentaires (upsert, palette validée contre la table `reaction_types`) | 4 ✅ |
| `saved-posts` | Enregistrements (collection « Général » par défaut, idempotents) | 4 ✅ |
| `media` | Upload d'images via l'adapter stockage (local implémenté, S3 en prod) : validation par décodage réel, miniatures sharp, `/uploads/` statique | 4 ✅ |
| `map` | Marqueurs par viewport/mode, géocodage inverse (adapter), proximité — endpoints préparatoires `GET /map/communes` et `GET /map/posts` livrés à l'étape 4, l'écran carte complet (caméras incluses) arrive à l'étape 5 | 4 partiel (préparatoire) / 5 |
| `cameras` | Caméras météo/trafic (numéro auto, ville déduite, statut) | 5 |
| `notifications` | Notifications in-app persistées + adapter push (mock en dev) — les notifications `comment`/`reply` sont déjà CRÉÉES à l'étape 4, les endpoints de lecture arrivent à l'étape 5 | 5 |
| `realtime` | Gateway WebSocket (socle temps réel, consommé dès la carte live) | 5 |
| `moderation` | Signalements, masquage de posts, outillage backoffice — le signalement côté utilisateur (`POST /posts/:id/report`, anti-doublon 409) est fait à l'étape 4 | 4 partiel (signalements) / 6 |
| `admin` | Endpoints d'administration consommés par le backoffice — gestion des utilisateurs (étape 3), modération des publications et file des signalements (étape 4) ; le reste (caméras, types de posts…) arrive à l'étape 6 | 3-4 partiel / 6 |
| `modules/_future/*` | Placeholders des lots suivants (voir §6) — **TODO Lot 2+** | — |

> **État réel à l'étape 4** : `health`, la couche `database` (driver mock +
> seed La Réunion), `auth`, `users` (étape 3) sont en place, et le cœur
> social de l'étape 4 est implémenté : `posts` (CRUD, détail par id et par
> `url_slug`, listes de profil), le feed scoré (`GET /posts/feed`, service
> dans le module posts), `comments` (deux niveaux option A, soft-delete,
> notifications in-app `comment`/`reply` créées), `reactions` (posts et
> commentaires, upsert), `saved-posts`, `media` (`POST /media/upload`,
> driver local + miniatures sharp), le signalement utilisateur de
> `moderation` (`POST /posts/:id/report`) et l'extension d'`admin`
> (modération des publications + file des signalements, en plus de la
> gestion des utilisateurs de l'étape 3). Le module `map` n'expose que ses
> endpoints préparatoires (`/map/communes`, `/map/posts`). Restent à venir :
> carte complète, caméras, lecture des notifications, temps réel (étape 5)
> et le complément backoffice (étape 6). Le tableau est mis à jour au fil
> des étapes.

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
| Stockage médias | `MEDIA_STORAGE_DRIVER` | `local` (**implémenté à l'étape 4** : upload d'images + miniatures sharp, fichiers écrits sous `UPLOAD_DIR` — `apps/api/uploads/` — et servis statiquement sur `/uploads/`) | `s3` (S3/Hetzner — non implémenté : le démarrage échoue avec une erreur explicite) |
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
- **Gateway WebSocket posée à l'étape 5** : la carte live l'utilise dès le
  Lot 1, et elle sert de socle au temps réel futur (conversations
  Dealplace — TODO Lot 2+).
- **Scoring du feed à poids centralisés** : les poids de l'algorithme
  (récence, proximité, type, popularité, abonnements) vivent dans une seule
  constante extensible (`FEED_WEIGHTS`, `posts/feed.service.ts`) — aucune
  valeur magique dispersée ; re-régler le feed = ajuster une constante, et
  le futur driver postgres portera le même scoring en SQL avec ces mêmes
  poids.
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

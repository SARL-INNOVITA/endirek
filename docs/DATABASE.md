# ENDIREK — Base de données (Lot 1)

Documentation du schéma de données posé à **l'étape 2 du Lot 1**.

- **Source de vérité** : le schéma **PostgreSQL 16 + PostGIS 3.4**, écrit dans
  [`apps/api/db/migrations/`](../apps/api/db/migrations/)
  (`0001_lot1_init.sql` : tables, index, triggers ; `0002_reference_data.sql` :
  données de référence, rejouable via `ON CONFLICT DO NOTHING`).
- **Mode par défaut actuel** : `DB_DRIVER=mock` — un adapter **in-memory
  TypeScript** (`apps/api/src/database/mock/`) qui reflète fidèlement ce schéma,
  parce que **Docker est absent de la machine de dev** et qu'aucun PostGIS ne
  tourne. Détails du driver : [`apps/api/src/database/README.md`](../apps/api/src/database/README.md).
- **État honnête** : les fichiers SQL n'ont **PAS encore été exécutés contre un
  vrai PostgreSQL/PostGIS**. Ils seront appliqués et validés dès l'installation
  de Docker (voir la [procédure de bascule](#7-procédure-de-bascule-mock--postgresqlpostgis)).

Le miroir TypeScript du schéma (entités, contraintes reproduites en code) vit
dans `apps/api/src/database/domain/entities.ts` ; le code métier ne dépend que
de ces entités et des interfaces de `repositories/interfaces.ts` — jamais du
driver.

---

## 1. Conventions du schéma

- Clés primaires `uuid DEFAULT gen_random_uuid()` (natif en PG16).
- Coordonnées : `geometry(Point, 4326)` (longitude/latitude WGS84).
- Horodatages : `timestamptz` ; `updated_at` maintenu par le trigger
  `set_updated_at()` (reproduit en code par le mock).
- `snake_case` côté SQL ↔ `camelCase` côté TypeScript.
- Statuts en `TEXT` + contrainte `CHECK` (évolutif sans migration de type).
- Vocabulaires pilotables par le backoffice = tables de référence
  (`post_types`, `reaction_types`) : rien n'est hardcodé côté code.

---

## 2. Tables du Lot 1 (13 tables)

| Table | Rôle |
|---|---|
| `users` | Comptes utilisateurs (rôle, statut, position publique approximative) |
| `follows` | Relations de suivi entre utilisateurs |
| `post_types` | Référence pilotable : types de publication |
| `reaction_types` | Référence pilotable : palette de réactions emoji |
| `posts` | Publications du feed et de la carte |
| `post_media` | Médias (images/vidéos) attachés aux publications |
| `comments` | Commentaires (depth 0) et réponses (depth 1) |
| `reactions` | Réactions emoji sur posts et commentaires (polymorphe) |
| `saved_collections` | Collections de posts enregistrés (« Général » par défaut) |
| `saved_posts` | Association posts ↔ collections |
| `cameras` | Caméras météo/trafic gérées par le backoffice |
| `reports` | Signalements de contenus ou d'utilisateurs (polymorphe) |
| `notifications` | Notifications in-app |

### 2.1 `users`

| Colonne | Type / contrainte |
|---|---|
| `id` | `uuid` PK `DEFAULT gen_random_uuid()` |
| `email` | `text NOT NULL` — unicité **insensible à la casse** via l'index unique `users_email_lower_key` sur `lower(email)` |
| `password_hash` | `text NOT NULL` |
| `display_name` | `text NOT NULL` |
| `avatar_url`, `cover_url` | `text`, nullables |
| `bio` | `text NOT NULL DEFAULT ''` |
| `city` | `text`, nullable |
| `location` | `geometry(Point,4326)`, nullable — position publique **approximative** choisie par l'utilisateur, jamais sa position GPS exacte |
| `settings` | `jsonb NOT NULL DEFAULT '{}'` |
| `role` | `text DEFAULT 'user'`, `CHECK IN ('user','moderator','super_admin')` |
| `status` | `text DEFAULT 'active'`, `CHECK IN ('active','suspended','deleted')` |
| `followers_count`, `following_count` | `int DEFAULT 0` — **dénormalisés** |
| `created_at`, `updated_at` | `timestamptz`, trigger `set_updated_at()` |
| `deleted_at` | `timestamptz`, nullable — **suppression douce RGPD** (la ligne est conservée) |

Index : `users_email_lower_key` (UNIQUE `lower(email)`), `users_status_idx`, `users_city_idx`.

### 2.2 `follows`

| Colonne | Type / contrainte |
|---|---|
| `follower_id`, `followed_id` | `uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `created_at` | `timestamptz` |
| — | PK composite `(follower_id, followed_id)` ; `CHECK (follower_id <> followed_id)` : pas d'auto-suivi |

Index : `follows_followed_id_idx` (liste des abonnés d'un compte).

### 2.3 `post_types` (référence pilotable backoffice)

| Colonne | Type / contrainte |
|---|---|
| `slug` | `text` PK (`free`, `weather`, `traffic`, `danger`, `question` au Lot 1) |
| `label_fr`, `icon`, `color` | `text NOT NULL` — libellés/icônes/couleurs provisoires, ajustables sans migration |
| `requires_location_for_map` | `boolean NOT NULL` — le post doit avoir une location pour la carte |
| `shows_on_map` | `boolean NOT NULL` — type éligible à l'affichage carte |
| `default_map_duration_minutes` | `int`, nullable (120 min pour weather/traffic/danger ; NULL pour les types feed-only) |
| `is_active`, `position` | activation + ordre d'affichage |
| `created_at`, `updated_at` | trigger `set_updated_at()` |

Lignes insérées par `0002_reference_data.sql` (rejouable, `ON CONFLICT DO NOTHING`).

### 2.4 `reaction_types` (référence pilotable backoffice)

| Colonne | Type / contrainte |
|---|---|
| `emoji` | `text` PK (👍 ❤️ 😂 😮 😢 😡 au Lot 1) |
| `label_fr` | `text NOT NULL` |
| `position`, `is_active` | ordre + activation |

Lignes insérées par `0002_reference_data.sql` (fichier à exécuter en **UTF-8**).

### 2.5 `posts`

| Colonne | Type / contrainte |
|---|---|
| `id` | `uuid` PK |
| `author_id` | `uuid NOT NULL REFERENCES users(id)` |
| `page_id` | `uuid`, nullable, **volontairement SANS FK** (voir décisions §3) |
| `type_slug` | `text NOT NULL REFERENCES post_types(slug)` |
| `title` | `text`, nullable |
| `body` | `text NOT NULL` |
| `location` | `geometry(Point,4326)`, nullable |
| `city` | `text`, nullable |
| `visibility` | `text DEFAULT 'public'`, `CHECK IN ('public')` — évolutif |
| `status` | `text DEFAULT 'active'`, `CHECK IN ('active','hidden','deleted')` — **pas de « reported »** (voir §3) |
| `url_slug` | `text NOT NULL UNIQUE` — identifiant public stable pour la future URL web partageable |
| `map_expires_at` | `timestamptz`, nullable — fin d'affichage carte, calculée par le service |
| `reaction_count`, `comment_count`, `share_count`, `save_count` | `int DEFAULT 0` — **dénormalisés** |
| `created_at`, `updated_at` | trigger `set_updated_at()` |

Index : `posts_location_gist_idx` (**GIST partiel** `WHERE location IS NOT NULL`),
`posts_created_at_idx` (`created_at DESC`), `posts_type_slug_idx`,
`posts_map_expires_at_idx` (partiel `WHERE map_expires_at IS NOT NULL`),
`posts_author_id_idx`,
`posts_status_created_at_idx` (composite `(status, created_at DESC)` pour le
feed ; couvre aussi les recherches sur `status` seul — pas d'index simple séparé).

### 2.6 `post_media`

| Colonne | Type / contrainte |
|---|---|
| `id` | `uuid` PK |
| `post_id` | `uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE` |
| `media_type` | `text`, `CHECK IN ('image','video')` |
| `url` | `text NOT NULL` |
| `thumbnail_url` | `text`, nullable |
| `width`, `height` | `int`, nullables |
| `position` | `int DEFAULT 0` — ordre d'affichage |

Index : `post_media_post_id_idx`.

### 2.7 `comments`

| Colonne | Type / contrainte |
|---|---|
| `id` | `uuid` PK |
| `post_id` | `uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE` |
| `author_id` | `uuid NOT NULL REFERENCES users(id)` |
| `parent_comment_id` | `uuid REFERENCES comments(id) ON DELETE CASCADE`, nullable |
| `depth` | `smallint DEFAULT 0`, **`CHECK (depth IN (0, 1))`** — option A (voir §3) |
| `body` | `text NOT NULL` |
| `status` | `text DEFAULT 'active'`, `CHECK IN ('active','hidden','deleted')` |
| `reaction_count` | `int DEFAULT 0` — dénormalisé |
| `created_at`, `updated_at` | trigger `set_updated_at()` |
| — | `CHECK ((parent_comment_id IS NULL) = (depth = 0))` : depth 0 ⇔ pas de parent, depth 1 ⇔ parent présent. La règle « le parent doit être de depth 0 » reste garantie par le service (un trigger serait nécessaire en SQL pur) |

Index : `comments_parent_comment_id_idx`,
`comments_post_id_created_at_idx` (composite, tri chronologique par post ;
couvre aussi les recherches sur `post_id` seul — pas d'index simple séparé),
`comments_author_id_idx`.

### 2.8 `reactions`

| Colonne | Type / contrainte |
|---|---|
| `id` | `uuid` PK |
| `user_id` | `uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `target_type` | `text`, `CHECK IN ('post','comment')` |
| `target_id` | `uuid NOT NULL` — cible **polymorphe**, pas de FK possible : intégrité garantie par le service |
| `emoji` | `text NOT NULL REFERENCES reaction_types(emoji)` |
| — | `UNIQUE (user_id, target_type, target_id)` : **une réaction par utilisateur et par cible** — changer d'emoji = UPDATE de la ligne |

Index : `reactions_target_idx` (`(target_type, target_id)`).

### 2.9 `saved_collections`

| Colonne | Type / contrainte |
|---|---|
| `id` | `uuid` PK |
| `owner_id` | `uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `name` | `text NOT NULL` — `UNIQUE (owner_id, name)` |
| `is_default` | `boolean DEFAULT false` |

Index : `saved_collections_owner_default_key` — **UNIQUE partiel** sur
`owner_id WHERE is_default` : une seule collection par défaut (« Général »,
créée par le service à l'inscription) par utilisateur.

### 2.10 `saved_posts`

| Colonne | Type / contrainte |
|---|---|
| `collection_id` | `uuid NOT NULL REFERENCES saved_collections(id) ON DELETE CASCADE` |
| `post_id` | `uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE` |
| — | PK composite `(collection_id, post_id)` : sauvegarder deux fois ne duplique rien |

Index : `saved_posts_post_id_idx` (calcul de `save_count`).

### 2.11 `cameras`

| Colonne | Type / contrainte |
|---|---|
| `id` | `uuid` PK |
| `camera_number` | `integer GENERATED ALWAYS AS IDENTITY UNIQUE` — numéro public auto-attribué, affiché « #23 » |
| `name` | `text NOT NULL` |
| `stream_type` | `text`, `CHECK IN ('image','video','iframe')` |
| `url` | `text NOT NULL` |
| `category` | `text`, `CHECK IN ('weather','traffic')` |
| `description` | `text NOT NULL DEFAULT ''` |
| `location` | `geometry(Point,4326) NOT NULL` — une caméra est toujours géolocalisée |
| `city_name` | `text NOT NULL` — déduite par géocodage inverse (mock au Lot 1), ajustable manuellement |
| `district_name` | `text`, nullable |
| `status` | `text DEFAULT 'active'`, `CHECK IN ('active','inactive','error','hidden')` |
| `created_at`, `updated_at` | trigger `set_updated_at()` |

Index : `cameras_location_gist_idx` (GIST), `cameras_category_idx`, `cameras_status_idx`.

### 2.12 `reports`

| Colonne | Type / contrainte |
|---|---|
| `id` | `uuid` PK |
| `reporter_id` | `uuid NOT NULL REFERENCES users(id)` |
| `target_type` | `text`, `CHECK IN ('post','comment','user')` |
| `target_id` | `uuid NOT NULL` — polymorphe, pas de FK (intégrité service) |
| `reason_code` | `text NOT NULL` — codes documentés : `spam`, `hateful`, `dangerous`, `false_info`, `other` (pilotables plus tard) |
| `message` | `text NOT NULL DEFAULT ''` |
| `status` | `text DEFAULT 'open'`, `CHECK IN ('open','reviewed','action_taken','dismissed')` |
| `handled_by` | `uuid REFERENCES users(id)`, nullable (modérateur) |
| `handled_at`, `resolution_note` | nullables |
| — | `CONSTRAINT reports_reporter_target_unique UNIQUE (reporter_id, target_type, target_id)` — anti-doublon : un même utilisateur ne signale la même cible qu'une seule fois (409 côté API) |

Index : `reports_target_idx` (`(target_type, target_id)`), `reports_status_idx`
(file de modération), `reports_created_at_idx`.

### 2.13 `notifications`

| Colonne | Type / contrainte |
|---|---|
| `id` | `uuid` PK |
| `user_id` | `uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `type` | `text NOT NULL` — codes documentés : `comment`, `reply`, `reaction`, `report_handled`, `system` |
| `payload` | `jsonb NOT NULL DEFAULT '{}'` — données contextuelles propres à chaque type |
| `read_at` | `timestamptz`, nullable |

Index : `notifications_user_created_idx` (`(user_id, created_at DESC)`),
`notifications_user_unread_idx` (**partiel** `WHERE read_at IS NULL` — badge
« non lues »).

---

## 3. Décisions de conception

- **« reported » n'est PAS un statut de post.** `posts.status` ne contient que
  `active | hidden | deleted` : l'état de signalement vit dans la table
  `reports` (avec son propre cycle de vie `open → reviewed / action_taken /
  dismissed`). Un post signalé peut parfaitement rester `active` tant que la
  modération n'a pas tranché.
- **Admin via `users.role`, pas de table `admin_users`.** Le champ
  `role IN ('user','moderator','super_admin')` vit directement sur le compte
  et suffit au backoffice du Lot 1.
- **`posts.page_id` nullable et volontairement SANS FK.** La table `pages`
  (restaurants/entreprises) n'arrive qu'au **Lot 3** : la colonne anticipe les
  publications émises par une page, et la contrainte `REFERENCES pages(id)`
  sera ajoutée par migration quand la table existera. Toujours `NULL` au Lot 1.
- **Commentaires : option A validée (2 niveaux max).** `depth = 0` =
  commentaire principal, `depth = 1` = réponse à un commentaire principal.
  Le `CHECK (depth IN (0, 1))` est **évolutif** : il suffira de l'élargir pour
  autoriser plus de niveaux. Le service (et le repository mock) **refuse**
  toute tentative de niveau 2+.
- **Compteurs dénormalisés, recalculés — jamais déclarés.**
  `followers_count`, `following_count`, `reaction_count`, `comment_count`,
  `save_count` sont dénormalisés pour la lecture (feed, profils). Le seed ne
  les déclare jamais : le mock les **recalcule depuis les données** au
  chargement, puis les tient à jour à chaque mutation — une seule source de
  cohérence. Exception : `share_count` n'a pas de table source au Lot 1
  (le partage arrive à un lot ultérieur) et reste à 0.
- **Règle carte (règle métier de SERVICE, volontairement pas de contrainte
  DB).** Un post `weather`/`traffic`/`danger` n'apparaît sur la carte QUE s'il
  possède une `location` ; sans location il reste **feed-only** (posture
  légale : on ne force jamais la géolocalisation). À la création avec
  location : `map_expires_at = created_at + default_map_duration_minutes` du
  type (120 min par défaut). Après expiration, le post disparaît de la carte
  mais **RESTE dans le feed**.
- **Vocabulaires pilotables.** Les types de publication (`post_types`) et la
  palette de réactions (`reaction_types`) sont des tables de référence
  administrables depuis le backoffice (libellés, icônes, couleurs, durées
  carte, activation, ordre) — aucun vocabulaire hardcodé dans le code métier.
- **Associations polymorphes assumées** (`reactions.target_id`,
  `reports.target_id`) : pas de FK possible sur une cible multi-tables ;
  l'intégrité référentielle est garantie au niveau du service.

---

## 4. Index PostGIS — pourquoi

Deux index **GIST** portent le cœur de l'expérience « Live Local » :

| Index | Sert à |
|---|---|
| `posts_location_gist_idx` (partiel `WHERE location IS NOT NULL`) | Requêtes **viewport carte** (bbox des marqueurs météo/trafic/danger visibles à l'écran) et calculs de **proximité du feed** (récence + proximité). Partiel car seuls les posts géolocalisés intéressent la carte — l'index reste petit. |
| `cameras_location_gist_idx` | Caméras dans le viewport carte (`listInBbox`). |

S'y ajoutent l'index partiel `posts_map_expires_at_idx` (purge/filtrage des
posts expirés de la carte) et le composite `posts_status_created_at_idx`
(feed antéchronologique des posts actifs).

Côté mock, ces requêtes géographiques sont émulées en mémoire par
`apps/api/src/database/mock/geo.ts` (haversine, bbox, offset) — approximations
suffisantes à l'échelle de La Réunion, pas des requêtes PostGIS réelles.

---

## 5. Le driver mock (`DB_DRIVER=mock`) — mode par défaut actuel

Implémenté à l'étape 2 (détail : [`apps/api/src/database/README.md`](../apps/api/src/database/README.md)) :

- stores en mémoire (une `Map`/tableau par table du schéma) ;
- données de référence embarquées, miroir exact de `0002_reference_data.sql` ;
- contraintes SQL (FK, UNIQUE, CHECK) reproduites en code avec des erreurs
  claires en français ;
- `updated_at` posé en code (équivalent du trigger `set_updated_at()`) ;
- si `DB_MOCK_SEED=true` (défaut), le **seed de démonstration La Réunion** est
  chargé au boot : 15 utilisateurs fictifs, ~30 follows, 42 posts répartis sur
  **12 communes de La Réunion (sélection du seed — l'île en compte 24)**
  (+ 12 médias), 60 commentaires, ~155 réactions, collections
  et sauvegardes, 4 signalements, 12 notifications, 12 caméras météo/trafic.
  Le géocodage inverse mock (étape 5 du Lot 1) ne couvrira que cette
  sélection de communes.
  Les dates sont **relatives au démarrage** (`minutesAgo`) et les UUID
  **déterministes** (`seedUuid`) — la démo est toujours fraîche et
  reproductible.

Au démarrage, l'API loggue :
`Mock DB prête : X utilisateurs, X follows, X posts (dont X visibles carte), ...`

---

## 6. Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `DB_DRIVER` | `mock` | `mock` (en mémoire) ou `postgres` (pas encore implémenté : démarre en erreur explicite) |
| `DB_MOCK_SEED` | `true` | Charger le seed de démonstration La Réunion (driver mock uniquement ; `false` = base mock vide, hors données de référence) |
| `DATABASE_URL`, `POSTGRES_*` | voir `.env.example` | Réservées au futur driver postgres |

---

## 7. Procédure de bascule mock → PostgreSQL/PostGIS

> **État honnête** : à ce jour, le SQL n'a **jamais été exécuté** contre un
> vrai PostGIS (Docker absent). La première exécution des migrations fait
> partie de cette procédure — prévoir d'éventuels correctifs mineurs.

1. **Installer Docker** (Docker Desktop sous Windows/macOS, Docker Engine +
   plugin `compose` sous Linux).
2. **Démarrer la base** :

   ```bash
   cd infra
   docker compose up -d     # PostgreSQL 16 + PostGIS 3.4 sur localhost:5432
   docker compose ps        # attendre le statut "healthy"
   ```

   Détails (identifiants, vérification PostGIS, reset) : [`infra/README.md`](../infra/README.md).
3. **Appliquer les migrations** (`psql`), dans l'ordre, en UTF-8 (émojis dans
   `0002`) :

   ```bash
   # Depuis la racine du monorepo, via le conteneur (aucun client local requis)
   docker compose -f infra/docker-compose.yml exec -T postgres \
     psql -U endirek -d endirek < apps/api/db/migrations/0001_lot1_init.sql
   docker compose -f infra/docker-compose.yml exec -T postgres \
     psql -U endirek -d endirek < apps/api/db/migrations/0002_reference_data.sql
   ```

   (ou, avec un client `psql` local :
   `psql "$DATABASE_URL" -f apps/api/db/migrations/0001_lot1_init.sql` puis `0002`.)
4. **Implémenter/activer le driver postgres** : implémenter chaque interface de
   `apps/api/src/database/repositories/interfaces.ts` en SQL (futur dossier
   `src/database/postgres/`) et étendre les factories de
   `database.module.ts` pour choisir l'implémentation selon `DB_DRIVER`.
   **Mêmes tokens, mêmes interfaces, mêmes entités : aucun changement de code
   métier.** (Aujourd'hui, `DB_DRIVER=postgres` échoue volontairement au
   démarrage avec une erreur explicite — on refuse de faire semblant.)
5. **Basculer la configuration** dans `apps/api/.env` :

   ```env
   DB_DRIVER=postgres
   DATABASE_URL=postgresql://endirek:endirek@localhost:5432/endirek
   ```
6. **Seed SQL** : générer un seed SQL depuis le seed TypeScript
   (`apps/api/src/database/seed/`) — **prévu à ce moment-là**, pas avant. Les
   UUID déterministes (`seedUuid`) rendent la génération directe ; seuls les
   horodatages relatifs (`minutesAgo`) devront être figés ou calculés à
   l'insertion. **Cas particulier `cameras.camera_number`** : la colonne est
   `GENERATED ALWAYS AS IDENTITY` alors que le seed fixe les numéros 1..12 —
   l'INSERT devra utiliser `OVERRIDING SYSTEM VALUE`, puis resynchroniser la
   séquence après insertion (équivalent SQL du `syncCameraSequence` du mock) :

   ```sql
   SELECT setval(pg_get_serial_sequence('cameras', 'camera_number'), 12);
   ```

---

## 8. Tables FUTURES — documentées, PAS créées au Lot 1

Aucune de ces tables n'existe dans les migrations : elles sont uniquement
anticipées (ancrages dans `apps/api/src/modules/_future/` et
[TODO_LOT_2.md](TODO_LOT_2.md)).

| Table future | Rôle (une ligne) | Lot |
|---|---|---|
| `pages` | Pages restaurants/entreprises possédées par des utilisateurs (cible de la future FK `posts.page_id`) | Lot 3 |
| `listings` | Annonces Dealplace (bien ou service, valeur estimée obligatoire, photo obligatoire pour un bien) | Lot 2 |
| `conversations` | Fils de messagerie privée 1-to-1 liés à un listing/deal | Lot 2 |
| `messages` | Messages des conversations (temps réel via la gateway WebSocket du Lot 1) | Lot 2 |
| `deals` | Deals contractuels avec machine à états (brouillon → conclu, annulation, litige) | Lot 2 |
| `deal_elements` | Éléments d'un deal validables par les deux parties | Lot 2 |
| `deal_sub_items` | Sous-éléments détaillant un élément de deal | Lot 2 |
| `news_sources` | Sources d'actualité locales à scraper pour le module News | Lot 2+ (News IA) |
| `news_events` | Événements d'actualité détectés/agrégés à partir des sources | Lot 2+ (News IA) |
| `generated_articles` | Articles rédigés par l'agent IA à partir des news_events | Lot 2+ (News IA) |
| `restaurant_menus` | Menus des pages restaurants | Lot 3 |
| `dishes` | Plats composant les menus des restaurants | Lot 3 |
| `billing` / premium | Abonnements premium, paiements (Stripe ou équivalent), publicité | Lot 2+ (module `_future/billing`) |

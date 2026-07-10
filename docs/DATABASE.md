# ENDIREK — Base de données (Lot 1 + Dealplace CP2.1)

Documentation du schéma de données posé à **l'étape 2 du Lot 1**, étendu au
**CP2.1 du Lot 2** (Dealplace : taxonomie + listings, voir §9).

- **Source de vérité** : le schéma **PostgreSQL 16 + PostGIS 3.4**, écrit dans
  [`apps/api/db/migrations/`](../apps/api/db/migrations/) :
  `0001_lot1_init.sql` (Lot 1 : tables, index, triggers) ;
  `0002_reference_data.sql` (Lot 1 : données de référence, rejouable via
  `ON CONFLICT DO NOTHING`) ; **`0003_dealplace_listings.sql`** (CP2.1 : tables
  Dealplace, rejouable via `CREATE TABLE/INDEX IF NOT EXISTS` + triggers
  recréés) ; **`0004_dealplace_reference.sql`** (CP2.1 : taxonomie de référence,
  rejouable via `ON CONFLICT DO NOTHING`).
- **Deux drivers fonctionnels** (comportement observable identique, choisi au
  chargement du module via `DB_DRIVER`) :
  - `DB_DRIVER=mock` (défaut, fallback) — adapter **in-memory TypeScript**
    (`apps/api/src/database/mock/`) qui reflète fidèlement ce schéma ;
  - `DB_DRIVER=postgres` (**fonctionnel depuis le Lot 1.5**) — repositories
    **SQL brut paramétré** (`pg`, pas d'ORM) dans
    [`apps/api/src/database/postgres/`](../apps/api/src/database/postgres/)
    (pool partagé, mappers ligne→entité, seeder idempotent, PostGIS).
  Détails du driver mock :
  [`apps/api/src/database/README.md`](../apps/api/src/database/README.md).
- **État** : Docker/PostGIS (`postgis/postgis:16-3.4`) démarre via
  `infra/docker-compose.yml`, les migrations SQL Lot 1 **et CP2.1** sont
  appliquées, et `DB_DRIVER=postgres` fait tourner l'API à l'identique du mock
  (voir §7). Sur cette machine, le conteneur `endirek-postgres` écoute sur le
  **port hôte 55432** (un PostgreSQL natif occupe 5432).

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
Depuis le checkpoint 6, le backoffice expose `GET /admin/post-types` et
`PATCH /admin/post-types/:slug` sur ces colonnes existantes. Le slug reste
immuable ; une modification de `default_map_duration_minutes` ne recalcule
pas les `map_expires_at` déjà posés sur les posts existants.

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

Le checkpoint 6 expose `PATCH /admin/comments/:id/status` pour masquer,
réactiver ou soft-delete un commentaire signalé. Une racine non active avec
des réponses actives reste servie comme emplacement vide par le module
`comments`, afin de ne pas casser le fil des réponses.

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

Le checkpoint 6 utilise le type `system` pour les notifications créées depuis
le backoffice dev/mock (`payload.title`, `payload.message`, `payload.source`).
Elles restent in-app + WebSocket ; aucun push FCM/APNs réel n'est envoyé.

---

## 2 bis. Tables Dealplace — CP2.1 (6 tables, migrations 0003/0004)

Le CP2.1 du Lot 2 ajoute la **taxonomie** biens/services (tables de référence
pilotables par le backoffice, même modèle que `post_types`) et les **listings**
(annonces). Créées par `0003_dealplace_listings.sql` (tables/index/triggers,
rejouable) ; peuplées par `0004_dealplace_reference.sql` (taxonomie de référence,
rejouable `ON CONFLICT DO NOTHING`). Le mock TypeScript embarque les mêmes lignes
(parité mock/postgres, D52).

| Table | Rôle |
|---|---|
| `listing_categories` | Référence : catégories (famille `good`/`service` + niveau de modération) |
| `listing_subcategories` | Référence : sous-catégories rattachées à une catégorie (repli « Autres » par catégorie) |
| `listing_tags` | Référence : tags transversaux (urgent, gratuit, pro, occasion…) |
| `listings` | Annonces (biens et services) |
| `listing_media` | Médias attachés à une annonce (images ordonnées) |
| `listing_tag_map` | Association N-N annonces ↔ tags |

### 2b.1 `listing_categories` (référence pilotable backoffice)

| Colonne | Type / contrainte |
|---|---|
| `slug` | `text` PK — **immuable** (D53) |
| `family` | `text NOT NULL`, `CHECK IN ('good','service')` — **figé** |
| `label_fr` | `text NOT NULL` |
| `position` | `int NOT NULL` — ordre d'affichage |
| `moderation_level` | `text DEFAULT 'standard'`, `CHECK IN ('standard','sensitive','forbidden')` — `standard` normale ; `sensitive` autorisée mais **marquée** ; **`forbidden` → création d'annonce refusée par le service (400)** (D56) |
| `is_active` | `boolean DEFAULT true` |
| `created_at`, `updated_at` | trigger `set_updated_at()` |

Index : `listing_categories_family_idx`. Référence peuplée par `0004` : **20
catégories** (10 biens + 10 services ; `vehicules-mobilite` et
`bien-etre-beaute-forme` en `sensitive`).

### 2b.2 `listing_subcategories`

| Colonne | Type / contrainte |
|---|---|
| `slug` | `text` PK — **immuable** |
| `category_slug` | `text NOT NULL REFERENCES listing_categories(slug)` — **figé** |
| `label_fr` | `text NOT NULL` |
| `position` | `int NOT NULL` (la sous-catégorie de repli « autres-<cat> » est en position 99) |
| `is_active` | `boolean DEFAULT true` |
| `created_at`, `updated_at` | trigger `set_updated_at()` |

Index : `listing_subcategories_category_slug_idx`. **Chaque catégorie possède une
sous-catégorie de repli « autres-<cat> » (label « Autres »)** — repli métier
autorisé pour ne jamais bloquer une annonce faute de sous-catégorie précise.

### 2b.3 `listing_tags`

| Colonne | Type / contrainte |
|---|---|
| `slug` | `text` PK — **immuable** |
| `label_fr` | `text NOT NULL` |
| `is_active` | `boolean DEFAULT true` |
| `created_at`, `updated_at` | trigger `set_updated_at()` |

Référence peuplée par `0004` : ~10 tags (`urgent`, `gratuit`, `pro`, `occasion`,
`neuf`, `local`, `livraison`, `echange-ok`, `negociable`, `fait-main`).

### 2b.4 `listings`

| Colonne | Type / contrainte |
|---|---|
| `id` | `uuid` PK `DEFAULT gen_random_uuid()` |
| `owner_id` | `uuid NOT NULL REFERENCES users(id)` |
| `listing_type` | `text NOT NULL`, `CHECK IN ('good','service')` |
| `title` | `text NOT NULL`, `CHECK char_length BETWEEN 1 AND 120` |
| `description` | `text NOT NULL`, `CHECK char_length BETWEEN 1 AND 4000` |
| `category_slug` | `text NOT NULL REFERENCES listing_categories(slug)` |
| `subcategory_slug` | `text NOT NULL REFERENCES listing_subcategories(slug)` |
| `value_kind` | `text NOT NULL`, `CHECK IN ('fixed','range')` (D54) |
| `value_min` | `integer NOT NULL`, `CHECK >= 0` |
| `value_max` | `integer`, `CHECK value_max IS NULL OR value_max >= value_min` |
| `currency` | `text NOT NULL DEFAULT 'EUR'` |
| `city` | `text NOT NULL` — commune du référentiel (adresse exacte **jamais** stockée) |
| `location` | `geometry(Point,4326)`, nullable — **centre de la commune** (pas l'adresse exacte) |
| `exchange_prefs` | `text[] NOT NULL` — sous-ensemble **non vide** de `{goods, services, money, open}` |
| `external_links` | `jsonb NOT NULL DEFAULT '[]'` — `[{label, url}]` |
| `url_slug` | `text NOT NULL UNIQUE` — identifiant public stable (slug titre + suffixe, comme les posts) |
| `status` | `text DEFAULT 'active'`, `CHECK IN ('active','hidden','deleted')` — miroir des posts |
| `created_at`, `updated_at` | trigger `set_updated_at()` |
| `deleted_at` | `timestamptz`, nullable — soft-delete |
| — | `CONSTRAINT listings_value_kind_max_ck` : `fixed` ⇒ `value_max NULL` ; `range` ⇒ `value_max NOT NULL` |
| — | `CONSTRAINT listings_exchange_prefs_nonempty_ck` : `array_length(exchange_prefs,1) >= 1` |

Index : `listings_owner_id_idx`, `listings_category_slug_idx`,
`listings_status_idx`, `listings_created_at_idx` (`created_at DESC`),
`listings_location_gist_idx` (**GIST partiel** `WHERE location IS NOT NULL`).

Règles métier au **service** (pas de contrainte DB) : **photo obligatoire pour
un bien** (D55), commune du référentiel, catégorie+sous-catégorie cohérentes
(sous-catégorie de la catégorie, catégorie de la bonne famille), catégorie
`forbidden` refusée, `sensitive` marquée, médias issus de l'upload Endirek.

### 2b.5 `listing_media`

| Colonne | Type / contrainte |
|---|---|
| `id` | `uuid` PK |
| `listing_id` | `uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE` |
| `media_type` | `text`, `CHECK IN ('image','video')` |
| `url` | `text NOT NULL` |
| `thumbnail_url` | `text`, nullable |
| `width`, `height` | `int`, nullables |
| `position` | `int DEFAULT 0` — ordre d'affichage |
| `created_at` | `timestamptz` |

Index : `listing_media_listing_id_idx`.

### 2b.6 `listing_tag_map`

| Colonne | Type / contrainte |
|---|---|
| `listing_id` | `uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE` |
| `tag_slug` | `text NOT NULL REFERENCES listing_tags(slug)` |
| — | PK composite `(listing_id, tag_slug)` |

Index : `listing_tag_map_tag_slug_idx`.

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

## 5. Le driver mock (`DB_DRIVER=mock`) — défaut / spécification de référence

Implémenté à l'étape 2 (détail : [`apps/api/src/database/README.md`](../apps/api/src/database/README.md)).
C'est aussi la **spécification de comportement** que le driver postgres (§7)
reproduit à l'identique :

- stores en mémoire (une `Map`/tableau par table du schéma) ;
- données de référence embarquées, miroir exact de `0002_reference_data.sql`
  (Lot 1) **et de `0004_dealplace_reference.sql`** (taxonomie Dealplace du CP2.1) ;
- contraintes SQL (FK, UNIQUE, CHECK) reproduites en code avec des erreurs
  claires en français ;
- `updated_at` posé en code (équivalent du trigger `set_updated_at()`) ;
- si `DB_MOCK_SEED=true` (défaut), le **seed de démonstration La Réunion** est
  chargé au boot : 15 utilisateurs fictifs, ~30 follows, 42 posts répartis sur
  **12 communes de La Réunion (sélection du seed — l'île en compte 24)**
  (+ 12 médias), 60 commentaires, ~155 réactions, collections
  et sauvegardes, 4 signalements, 12 notifications, 12 caméras météo/trafic,
  et — depuis le CP2.1 — la **taxonomie Dealplace** (20 catégories, 79
  sous-catégories, 10 tags) + **8 annonces** de démonstration.
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
| `DB_DRIVER` | `mock` | `mock` (en mémoire) ou `postgres` (repositories SQL fonctionnels — Docker requis, voir §7) |
| `DB_MOCK_SEED` | `true` | Charger le seed de démonstration La Réunion. Mock : rechargé à chaque boot. Postgres : inséré **une seule fois si la table `users` est vide** (idempotent). `false` = base vide (hors données de référence) |
| `DATABASE_URL`, `POSTGRES_*` | voir `.env.example` | Connexion du driver postgres (`DATABASE_URL` prioritaire sur les champs `POSTGRES_*`) |

---

## 7. Procédure PostgreSQL/PostGIS locale — bascule RÉALISÉE (Lot 1.5)

> **État (2026-07-10)** : la bascule mock → postgres est **réalisée**. Le driver
> `DB_DRIVER=postgres` est implémenté (repositories SQL brut `pg`,
> `apps/api/src/database/postgres/`) et fait tourner le Lot 1 à l'identique du
> mock. `DB_DRIVER=mock` reste le défaut et le fallback. Cette section décrit la
> mise en route ; le runbook détaille les commandes ([AI_RUNBOOK.md](AI_RUNBOOK.md) §8 bis).
>
> **Stratégie compteurs = calcul À LA LECTURE.** Les compteurs dénormalisés
> (`reactionCount`, `commentCount`, `saveCount`, `followersCount`…) ne sont
> **pas maintenus à l'écriture** en mode postgres : chaque SELECT les recalcule
> par sous-requête/JOIN avec la **sémantique exacte du mock** (ex. `commentCount`
> = commentaires `active`). Parité de comportement et robustesse ; l'optimisation
> par triggers/colonnes maintenues à grande échelle est un **TODO** non requis au
> Lot 1.

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
   `0002`). Sous Windows/PowerShell, préférer `docker cp` + `psql -f` pour
   éviter les problèmes d'encodage de pipe :

   ```bash
   # Depuis la racine du monorepo, via le conteneur (aucun client local requis)
   docker cp apps/api/db/migrations/0001_lot1_init.sql endirek-postgres:/tmp/0001_lot1_init.sql
   docker cp apps/api/db/migrations/0002_reference_data.sql endirek-postgres:/tmp/0002_reference_data.sql

   docker compose -f infra/docker-compose.yml exec -T postgres \
     psql -v ON_ERROR_STOP=1 -U endirek -d endirek -f /tmp/0001_lot1_init.sql
   docker compose -f infra/docker-compose.yml exec -T postgres \
     psql -v ON_ERROR_STOP=1 -U endirek -d endirek -f /tmp/0002_reference_data.sql
   ```

   (ou, avec un client `psql` local :
   `psql "$DATABASE_URL" -f apps/api/db/migrations/0001_lot1_init.sql` puis `0002`.)

   `0001_lot1_init.sql` crée les tables et ne doit pas être rejoué sur une base
   déjà migrée sans reset préalable (`docker compose down -v`). `0002` est
   rejouable pour les données de référence (`ON CONFLICT DO NOTHING`).
4. **Vérifier le schéma** :

   ```bash
   docker compose -f infra/docker-compose.yml exec -T postgres \
     psql -U endirek -d endirek -c "SELECT postgis_version();"
   docker compose -f infra/docker-compose.yml exec -T postgres \
     psql -U endirek -d endirek -c "SELECT count(*) FROM post_types;"
   docker compose -f infra/docker-compose.yml exec -T postgres \
     psql -U endirek -d endirek -c "SELECT count(*) FROM reaction_types;"
   ```

   Résultat attendu : 13 tables métier Lot 1 + `spatial_ref_sys` (PostGIS),
   5 `post_types`, 6 `reaction_types`, index GIST carte/caméras présents.
   > Raccourci équivalent : `npm run db:migrate --workspace apps/api` (copie
   > chaque `.sql` dans le conteneur et l'exécute via `psql -f`).

5. **Le driver postgres est implémenté** dans
   [`apps/api/src/database/postgres/`](../apps/api/src/database/postgres/) :
   chaque interface de `repositories/interfaces.ts` a son implémentation SQL
   (`repositories/postgres-*.repository.ts`), au-dessus d'un **pool partagé**
   (`postgres-pool.ts`, token `POSTGRES_POOL`), de mappers ligne→entité
   (`pg-helpers.ts`) et de `PostgresDatabaseService` (ping + seed + fermeture du
   pool). `database.module.ts` sélectionne mock ou postgres **au chargement** via
   `process.env.DB_DRIVER`. **Mêmes tokens, mêmes interfaces, mêmes entités :
   aucun changement de code métier.**
6. **Basculer la configuration** dans `apps/api/.env` (`DATABASE_URL` prioritaire
   sur les champs `POSTGRES_*`) :

   ```env
   DB_DRIVER=postgres
   DATABASE_URL=postgresql://endirek:endirek@localhost:5432/endirek
   DB_MOCK_SEED=true
   ```

   Au boot, si `DB_MOCK_SEED=true` et que la table `users` est vide, l'API
   affiche `PostgreSQL prêt : connecté (15 utilisateurs, …)`.
7. **Seed SQL** : le **seeder** (`postgres-seeder.ts`) réutilise la source unique
   `buildSeed()` (`apps/api/src/database/seed/`) et insère les 11 collections en
   **une transaction idempotente** (`ON CONFLICT DO NOTHING`), déclenchée au boot
   **si la table `users` est vide**. Les UUID déterministes (`seedUuid`) et les
   horodatages relatifs (`minutesAgo`) du seed sont insérés **explicitement**
   (jamais les DEFAULT). **Cas `cameras.camera_number`** (`GENERATED ALWAYS AS
   IDENTITY`, numéros 1..12 imposés) : insertion en `OVERRIDING SYSTEM VALUE`
   puis repositionnement de la séquence (miroir du `syncCameraSequence` du mock) :

   ```sql
   SELECT setval(pg_get_serial_sequence('cameras', 'camera_number'), 12);
   ```

   Pour repartir d'une base fraîche : `npm run db:reset --workspace apps/api`
   (vide les tables de données, conserve la référence, force un re-seed au boot).

---

## 8. Tables FUTURES — documentées, PAS encore créées

Aucune de ces tables n'existe dans les migrations : elles sont uniquement
anticipées (ancrages dans `apps/api/src/modules/_future/` et
[TODO_LOT_2.md](TODO_LOT_2.md)). **Les tables Dealplace listings/taxonomie ont
quitté cette liste : elles sont créées au CP2.1** (§2 bis, migrations 0003/0004).

| Table future | Rôle (une ligne) | Lot / CP |
|---|---|---|
| `pages` | Pages restaurants/entreprises possédées par des utilisateurs (cible de la future FK `posts.page_id`) | Lot 3 |
| `conversations` | Fils de messagerie privée 1-to-1 liés à un listing/deal | Lot 2 — CP2.3 |
| `reviews` (avis Dealplace) | Avis détaillés d'un profil Dealplace (note + critères + commentaire) | Lot 2 — CP2.2 |
| `messages` | Messages des conversations (temps réel via la gateway WebSocket du Lot 1) | Lot 2 — CP2.3 |
| `deals` | Deals contractuels avec machine à états (brouillon → conclu, annulation, litige) | Lot 2 — CP2.4 |
| `deal_elements` | Éléments d'un deal validables par les deux parties | Lot 2 — CP2.4 |
| `deal_sub_items` | Sous-éléments détaillant un élément de deal | Lot 2 — CP2.4 |
| `news_sources` | Sources d'actualité locales à scraper pour le module News | Lot 4 (News IA) |
| `news_events` | Événements d'actualité détectés/agrégés à partir des sources | Lot 4 (News IA) |
| `generated_articles` | Articles rédigés par l'agent IA à partir des news_events | Lot 4 (News IA) |
| `restaurant_menus` | Menus des pages restaurants | Lot 3 |
| `dishes` | Plats composant les menus des restaurants | Lot 3 |
| `billing` / premium | Abonnements premium, paiements (Stripe ou équivalent), publicité | Transverse (module `_future/billing`) |

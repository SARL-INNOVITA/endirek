-- ============================================================================
-- ENDIREK — Lot 1 — Migration 0001 : schéma initial
-- ============================================================================
-- AVERTISSEMENT : ce fichier n'a PAS encore été exécuté contre un vrai
-- PostgreSQL/PostGIS (Docker est absent sur la machine de développement).
-- Il sera appliqué et validé dès l'installation de Docker. En attendant,
-- l'adapter mock TypeScript (DB_DRIVER=mock) reflète fidèlement ce schéma,
-- qui reste la SOURCE DE VÉRITÉ.
--
-- Conventions :
--   - PostgreSQL 16 + PostGIS ; gen_random_uuid() est natif en PG16.
--   - Clés primaires uuid DEFAULT gen_random_uuid().
--   - Coordonnées : geometry(Point, 4326) (longitude/latitude WGS84).
--   - Horodatages : timestamptz.
--   - snake_case côté SQL, camelCase côté TypeScript.
--   - Statuts en TEXT + contrainte CHECK (évolutif sans migration de type).
--   - Vocabulaires pilotables par le backoffice = tables de référence
--     (post_types, reaction_types) : rien n'est hardcodé côté code.
--
-- Tables FUTURES (documentées, PAS créées au Lot 1) : pages, listings,
-- conversations, messages, deals, deal_elements, deal_sub_items,
-- news_sources, news_events, generated_articles, restaurant_menus, dishes,
-- billing/premium.
-- ============================================================================

BEGIN;

-- Extension géospatiale (cartes météo/trafic/danger, caméras).
CREATE EXTENSION IF NOT EXISTS postgis;

-- ----------------------------------------------------------------------------
-- Fonction trigger générique : met à jour updated_at à chaque UPDATE.
-- (Le mock TypeScript reproduit ce comportement en code.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1. users — comptes utilisateurs.
-- Le rôle (user / moderator / super_admin) vit directement sur le compte :
-- PAS de table admin_users séparée, ce champ suffit au backoffice du Lot 1.
-- location = position publique APPROXIMATIVE choisie par l'utilisateur
-- (jamais sa position GPS exacte). deleted_at = suppression douce RGPD.
-- followers_count / following_count sont dénormalisés (maintenus par le
-- service lors des follow/unfollow).
-- ============================================================================
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  password_hash   text NOT NULL,
  display_name    text NOT NULL,
  avatar_url      text,
  cover_url       text,
  bio             text NOT NULL DEFAULT '',
  city            text,
  location        geometry(Point, 4326),
  settings        jsonb NOT NULL DEFAULT '{}',
  role            text NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'moderator', 'super_admin')),
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended', 'deleted')),
  followers_count int NOT NULL DEFAULT 0,
  following_count int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- Unicité de l'email insensible à la casse.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
CREATE INDEX users_status_idx ON users (status);
CREATE INDEX users_city_idx ON users (city);

COMMENT ON TABLE users IS
  'Comptes utilisateurs. Le champ role remplace toute table admin_users : il suffit au backoffice du Lot 1.';
COMMENT ON COLUMN users.location IS
  'Position publique approximative choisie par l''utilisateur, jamais sa position GPS exacte.';
COMMENT ON COLUMN users.deleted_at IS
  'Suppression douce (RGPD) : le compte est anonymisé/désactivé, la ligne est conservée.';

-- ============================================================================
-- 2. follows — relations de suivi (follower suit followed).
-- ============================================================================
CREATE TABLE follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

CREATE INDEX follows_followed_id_idx ON follows (followed_id);

COMMENT ON TABLE follows IS
  'Relations de suivi entre utilisateurs. Un utilisateur ne peut pas se suivre lui-même.';

-- ============================================================================
-- 3. post_types — table de référence des types de publication.
-- Pilotable par le backoffice (libellés, icônes, couleurs, durées carte,
-- activation, ordre d'affichage) : rien n'est hardcodé côté code.
-- Les lignes de référence du Lot 1 sont insérées par 0002_reference_data.sql.
-- ============================================================================
CREATE TABLE post_types (
  slug                         text PRIMARY KEY,
  label_fr                     text NOT NULL,
  icon                         text NOT NULL,
  color                        text NOT NULL,
  requires_location_for_map    boolean NOT NULL,
  shows_on_map                 boolean NOT NULL,
  default_map_duration_minutes int,
  is_active                    boolean NOT NULL DEFAULT true,
  position                     int NOT NULL,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE post_types IS
  'Types de publication (référence pilotable backoffice). Icônes et couleurs provisoires, ajustables sans migration.';

-- ============================================================================
-- 4. reaction_types — table de référence des réactions (emojis).
-- Pilotable par le backoffice. Lignes insérées par 0002_reference_data.sql.
-- ============================================================================
CREATE TABLE reaction_types (
  emoji     text PRIMARY KEY,
  label_fr  text NOT NULL,
  position  int NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE reaction_types IS
  'Palette de réactions (référence pilotable backoffice).';

-- ============================================================================
-- 5. posts — publications du feed et de la carte.
--
-- DÉCISIONS DOCUMENTÉES :
--   - page_id est prévu SANS contrainte FK : la table pages (restaurants /
--     entreprises) n'arrive qu'au Lot 3. La contrainte REFERENCES pages(id)
--     sera ajoutée par migration quand la table existera.
--   - « reported » n'est PAS un statut de posts : l'état de signalement vit
--     dans la table reports. Un post signalé peut parfaitement rester
--     'active' tant que la modération n'a pas tranché.
--   - RÈGLE MÉTIER (appliquée par le SERVICE, volontairement PAS de
--     contrainte DB) : un post weather/traffic/danger n'apparaît sur la
--     carte QUE s'il possède une location ; sans location il reste
--     feed-only (posture légale : on ne force jamais la géolocalisation).
--     À la création avec location : map_expires_at = created_at +
--     default_map_duration_minutes du type. Après expiration, le post
--     disparaît de la carte mais RESTE dans le feed.
--   - url_slug : identifiant public stable pour la future URL web
--     partageable.
--   - reaction_count / comment_count / share_count / save_count sont
--     dénormalisés, maintenus par le service.
-- ============================================================================
CREATE TABLE posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id      uuid NOT NULL REFERENCES users(id),
  -- Volontairement SANS FK : la table pages n'existe qu'au Lot 3.
  page_id        uuid,
  type_slug      text NOT NULL REFERENCES post_types(slug),
  title          text,
  body           text NOT NULL,
  location       geometry(Point, 4326),
  city           text,
  visibility     text NOT NULL DEFAULT 'public'
                 CHECK (visibility IN ('public')),
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'hidden', 'deleted')),
  url_slug       text NOT NULL UNIQUE,
  map_expires_at timestamptz,
  reaction_count int NOT NULL DEFAULT 0,
  comment_count  int NOT NULL DEFAULT 0,
  share_count    int NOT NULL DEFAULT 0,
  save_count     int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Recherche spatiale (posts affichés sur la carte uniquement).
CREATE INDEX posts_location_gist_idx ON posts USING GIST (location)
  WHERE location IS NOT NULL;
CREATE INDEX posts_created_at_idx ON posts (created_at DESC);
CREATE INDEX posts_type_slug_idx ON posts (type_slug);
-- Purge/filtrage des posts expirés de la carte.
CREATE INDEX posts_map_expires_at_idx ON posts (map_expires_at)
  WHERE map_expires_at IS NOT NULL;
CREATE INDEX posts_author_id_idx ON posts (author_id);
-- Index composite pour le feed (posts actifs triés du plus récent au plus ancien).
-- Il couvre aussi les recherches sur status seul : pas d'index posts_status_idx séparé.
CREATE INDEX posts_status_created_at_idx ON posts (status, created_at DESC);

COMMENT ON TABLE posts IS
  'Publications (feed + carte). Le statut ne contient pas « reported » : les signalements vivent dans la table reports.';
COMMENT ON COLUMN posts.page_id IS
  'Anticipation Lot 3 (pages restaurants/entreprises) : colonne volontairement SANS contrainte FK, la contrainte REFERENCES pages(id) sera ajoutée quand la table pages existera.';
COMMENT ON COLUMN posts.map_expires_at IS
  'Fin d''affichage sur la carte, calculée par le service à la création (created_at + default_map_duration_minutes du type). Après expiration, le post reste dans le feed.';
COMMENT ON COLUMN posts.url_slug IS
  'Identifiant public unique pour la future URL web partageable.';

-- ============================================================================
-- 6. post_media — médias attachés aux publications (images / vidéos).
-- ============================================================================
CREATE TABLE post_media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_type    text NOT NULL CHECK (media_type IN ('image', 'video')),
  url           text NOT NULL,
  thumbnail_url text,
  width         int,
  height        int,
  position      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX post_media_post_id_idx ON post_media (post_id);

COMMENT ON TABLE post_media IS
  'Médias attachés aux publications, ordonnés par position.';

-- ============================================================================
-- 7. comments — commentaires et réponses.
--
-- DÉCISION PRODUIT VALIDÉE (option A, MVP) :
--   depth = 0 : commentaire principal ; depth = 1 : réponse à un commentaire
--   principal. PAS de réponse à une réponse au Lot 1 : le service refuse ou
--   normalise toute tentative de niveau 2+. Le schéma reste évolutif : il
--   suffira d'élargir la contrainte CHECK pour autoriser plus de niveaux.
-- ============================================================================
CREATE TABLE comments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id         uuid NOT NULL REFERENCES users(id),
  parent_comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  depth             smallint NOT NULL DEFAULT 0 CHECK (depth IN (0, 1)),
  body              text NOT NULL,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'hidden', 'deleted')),
  reaction_count    int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- Lie depth au parent : depth 0 <=> pas de parent, depth 1 <=> parent présent.
  -- La règle « le parent doit être de depth 0 » reste garantie au niveau
  -- service (elle exigerait un trigger en SQL pur).
  CHECK ((parent_comment_id IS NULL) = (depth = 0))
);

CREATE INDEX comments_parent_comment_id_idx ON comments (parent_comment_id);
-- Le composite couvre aussi les recherches sur post_id seul : pas d'index comments_post_id_idx séparé.
CREATE INDEX comments_post_id_created_at_idx ON comments (post_id, created_at);
CREATE INDEX comments_author_id_idx ON comments (author_id);

COMMENT ON TABLE comments IS
  'Commentaires. Option A validée : 2 niveaux max (depth 0 = commentaire, depth 1 = réponse). Le service bloque le niveau 2+.';

-- ============================================================================
-- 8. reactions — réactions emoji sur posts et commentaires.
--
-- DÉCISION DOCUMENTÉE : cible POLYMORPHE (target_type + target_id), donc
-- PAS de FK possible sur target_id ; l'intégrité référentielle est garantie
-- au niveau du service. La contrainte UNIQUE (user_id, target_type,
-- target_id) impose UNE réaction par utilisateur et par cible : changer
-- d'emoji = UPDATE de la ligne existante.
-- ============================================================================
CREATE TABLE reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id   uuid NOT NULL,
  emoji       text NOT NULL REFERENCES reaction_types(emoji),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX reactions_target_idx ON reactions (target_type, target_id);

COMMENT ON TABLE reactions IS
  'Réactions emoji. Cible polymorphe (post ou commentaire) : pas de FK sur target_id, intégrité assurée par le service.';

-- ============================================================================
-- 9. saved_collections — collections de posts enregistrés.
-- Le service crée automatiquement une collection par défaut « Général »
-- pour chaque utilisateur à l'inscription ; l'index unique partiel garantit
-- qu'il n'en existe qu'une seule par utilisateur.
-- ============================================================================
CREATE TABLE saved_collections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

-- Une seule collection par défaut par utilisateur.
CREATE UNIQUE INDEX saved_collections_owner_default_key
  ON saved_collections (owner_id)
  WHERE is_default;

COMMENT ON TABLE saved_collections IS
  'Collections de posts enregistrés. La collection par défaut « Général » est créée par le service à l''inscription.';

-- ============================================================================
-- 10. saved_posts — posts enregistrés dans une collection.
-- ============================================================================
CREATE TABLE saved_posts (
  collection_id uuid NOT NULL REFERENCES saved_collections(id) ON DELETE CASCADE,
  post_id       uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, post_id)
);

CREATE INDEX saved_posts_post_id_idx ON saved_posts (post_id);

COMMENT ON TABLE saved_posts IS
  'Association posts <-> collections d''enregistrement.';

-- ============================================================================
-- 11. cameras — caméras/webcams météo et trafic gérées par le backoffice.
-- camera_number : numéro auto-incrémenté affiché à l'utilisateur (« #23 »).
-- city_name : déduite via géocodage inverse (mock au Lot 1), ajustable
-- manuellement par le backoffice.
-- ============================================================================
CREATE TABLE cameras (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_number integer NOT NULL GENERATED ALWAYS AS IDENTITY UNIQUE,
  name          text NOT NULL,
  stream_type   text NOT NULL CHECK (stream_type IN ('image', 'video', 'iframe')),
  url           text NOT NULL,
  category      text NOT NULL CHECK (category IN ('weather', 'traffic')),
  description   text NOT NULL DEFAULT '',
  location      geometry(Point, 4326) NOT NULL,
  city_name     text NOT NULL,
  district_name text,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'error', 'hidden')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cameras_location_gist_idx ON cameras USING GIST (location);
CREATE INDEX cameras_category_idx ON cameras (category);
CREATE INDEX cameras_status_idx ON cameras (status);

COMMENT ON TABLE cameras IS
  'Caméras météo/trafic gérées par le backoffice. camera_number est le numéro public affiché (« #23 »).';
COMMENT ON COLUMN cameras.city_name IS
  'Ville déduite via géocodage inverse (mock au Lot 1), ajustable manuellement.';

-- ============================================================================
-- 12. reports — signalements de contenus ou d'utilisateurs.
--
-- DÉCISIONS DOCUMENTÉES :
--   - Cible POLYMORPHE (target_type + target_id) : pas de FK sur target_id,
--     intégrité assurée par le service.
--   - C'est ICI que vit l'état de signalement : un post signalé peut rester
--     'active' dans posts tant que la modération n'a pas statué (voir la
--     note sur posts.status).
--   - reason_code (codes documentés, pilotables plus tard) : spam, hateful,
--     dangerous, false_info, other.
-- ============================================================================
CREATE TABLE reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid NOT NULL REFERENCES users(id),
  target_type     text NOT NULL CHECK (target_type IN ('post', 'comment', 'user')),
  target_id       uuid NOT NULL,
  reason_code     text NOT NULL,
  message         text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'reviewed', 'action_taken', 'dismissed')),
  handled_by      uuid REFERENCES users(id),
  handled_at      timestamptz,
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reports_target_idx ON reports (target_type, target_id);
CREATE INDEX reports_status_idx ON reports (status);
CREATE INDEX reports_created_at_idx ON reports (created_at);

COMMENT ON TABLE reports IS
  'Signalements. Cible polymorphe sans FK (intégrité service). Codes de raison documentés : spam, hateful, dangerous, false_info, other.';

-- ============================================================================
-- 13. notifications — notifications in-app.
-- type (codes documentés) : comment, reply, reaction, report_handled, system.
-- payload : données contextuelles (ids, extraits) propres à chaque type.
-- ============================================================================
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}',
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
-- Accès rapide aux notifications non lues.
CREATE INDEX notifications_user_unread_idx ON notifications (user_id)
  WHERE read_at IS NULL;

COMMENT ON TABLE notifications IS
  'Notifications in-app. Codes de type documentés : comment, reply, reaction, report_handled, system.';

-- ----------------------------------------------------------------------------
-- Triggers updated_at (le mock TypeScript reproduit ce comportement en code).
-- ----------------------------------------------------------------------------
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER comments_set_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER cameras_set_updated_at
  BEFORE UPDATE ON cameras
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER post_types_set_updated_at
  BEFORE UPDATE ON post_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

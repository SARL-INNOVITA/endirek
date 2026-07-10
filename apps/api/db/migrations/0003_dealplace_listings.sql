-- ============================================================================
-- ENDIREK — Lot 2 — CP2.1 — Migration 0003 : Dealplace (taxonomie + listings)
-- ============================================================================
-- Première fonctionnalité du Lot 2 : le Dealplace (petites annonces biens/
-- services). Cette migration crée :
--   - la TAXONOMIE pilotable par le backoffice (listing_categories,
--     listing_subcategories, listing_tags), sur le même modèle que post_types ;
--   - les LISTINGS (annonces) avec leurs médias et leurs tags.
--
-- Conventions (identiques au Lot 1, cf. 0001_lot1_init.sql) :
--   - PostgreSQL 16 + PostGIS ; gen_random_uuid() natif.
--   - Clés primaires uuid DEFAULT gen_random_uuid() (sauf tables de référence
--     dont la PK est un slug TEXT stable).
--   - Coordonnées : geometry(Point, 4326).
--   - Horodatages : timestamptz.
--   - snake_case côté SQL, camelCase côté TypeScript.
--   - Statuts / familles en TEXT + contrainte CHECK (évolutif sans migration
--     de type).
--   - Vocabulaires pilotables par le backoffice = tables de référence, jamais
--     hardcodés côté code.
--
-- REJOUABLE : tout est en CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT
-- EXISTS ; les triggers sont recréés proprement (DROP TRIGGER IF EXISTS puis
-- CREATE). La fonction set_updated_at() vient de 0001. Ce fichier peut donc
-- être ré-appliqué sans erreur sur une base déjà migrée.
--
-- Les données de référence de la taxonomie (familles/catégories/sous-
-- catégories/tags) sont insérées par 0004_dealplace_reference.sql.
-- ============================================================================

BEGIN;

-- Extensions/fonctions supposées présentes (créées par 0001) : postgis,
-- set_updated_at(). On sécurise malgré tout l'extension pour une base neuve.
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- 1. listing_categories — catégories de la taxonomie Dealplace.
--
-- Table de RÉFÉRENCE pilotable par le backoffice (comme post_types). Chaque
-- catégorie appartient à une famille ('good' = bien, 'service' = service) et
-- porte un niveau de modération :
--   - 'standard'  : catégorie normale ;
--   - 'sensitive' : autorisée mais MARQUÉE pour la modération (champ dérivé
--                   côté service — les annonces héritent de ce marquage) ;
--   - 'forbidden' : création d'annonce REFUSÉE par le service (400).
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_categories (
  slug             text PRIMARY KEY,
  family           text NOT NULL CHECK (family IN ('good', 'service')),
  label_fr         text NOT NULL,
  position         int NOT NULL,
  moderation_level text NOT NULL DEFAULT 'standard'
                   CHECK (moderation_level IN ('standard', 'sensitive', 'forbidden')),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_categories_family_idx
  ON listing_categories (family);

COMMENT ON TABLE listing_categories IS
  'Catégories de la taxonomie Dealplace (référence pilotable backoffice). family = good/service ; moderation_level = standard/sensitive/forbidden.';
COMMENT ON COLUMN listing_categories.moderation_level IS
  'standard : normale ; sensitive : autorisée mais marquée pour la modération ; forbidden : création d''annonce refusée par le service.';

-- ============================================================================
-- 2. listing_subcategories — sous-catégories rattachées à une catégorie.
--
-- CHAQUE catégorie possède une sous-catégorie de repli « autres-<cat> »
-- (label « Autres ») pour ne jamais bloquer une annonce faute de sous-
-- catégorie précise (fallback autorisé par la règle métier).
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_subcategories (
  slug          text PRIMARY KEY,
  category_slug text NOT NULL REFERENCES listing_categories(slug),
  label_fr      text NOT NULL,
  position      int NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_subcategories_category_slug_idx
  ON listing_subcategories (category_slug);

COMMENT ON TABLE listing_subcategories IS
  'Sous-catégories Dealplace rattachées à une catégorie. Chaque catégorie a une sous-catégorie de repli « autres-<cat> » (label « Autres »).';

-- ============================================================================
-- 3. listing_tags — tags transversaux (référence pilotable backoffice).
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_tags (
  slug       text PRIMARY KEY,
  label_fr   text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE listing_tags IS
  'Tags transversaux du Dealplace (référence pilotable backoffice, ex. urgent, gratuit, pro, occasion...).';

-- ============================================================================
-- 4. listings — annonces (biens et services).
--
-- RÈGLES MÉTIER appliquées au SERVICE (pas de contrainte DB pour elles, sauf
-- celles ci-dessous qui sont exprimables en CHECK) :
--   - valeur obligatoire : value_kind='fixed' → value_min renseigné ;
--     value_kind='range' → value_min <= value_max ;
--   - PHOTO OBLIGATOIRE pour listing_type='good' (>=1 media) — garantie au
--     service (le nombre de médias n'est pas connu à l'INSERT de la ligne) ;
--   - commune obligatoire (référentiel communes) ;
--   - category+subcategory obligatoires et cohérentes (sous-catégorie de la
--     catégorie, catégorie de la bonne famille) ;
--   - exchange_prefs : sous-ensemble NON VIDE de goods/services/money/open ;
--   - catégorie 'forbidden' → création refusée ; 'sensitive' → marquée.
--   - url_slug généré (slug titre + suffixe), UNIQUE.
--   - location = centre de la commune si fournie (adresse exacte NON stockée).
--
-- Contraintes exprimables en SQL (défense en profondeur, miroir du service) :
--   - value_min >= 0 ;
--   - value_max IS NULL OR value_max >= value_min ;
--   - cohérence value_kind : 'fixed' => value_max NULL ; 'range' => value_max
--     NON NULL (donc >= value_min via la contrainte précédente) ;
--   - exchange_prefs non vide (array_length >= 1).
-- ============================================================================
CREATE TABLE IF NOT EXISTS listings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES users(id),
  listing_type     text NOT NULL CHECK (listing_type IN ('good', 'service')),
  title            text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description      text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 4000),
  category_slug    text NOT NULL REFERENCES listing_categories(slug),
  subcategory_slug text NOT NULL REFERENCES listing_subcategories(slug),
  value_kind       text NOT NULL CHECK (value_kind IN ('fixed', 'range')),
  value_min        integer NOT NULL CHECK (value_min >= 0),
  value_max        integer CHECK (value_max IS NULL OR value_max >= value_min),
  currency         text NOT NULL DEFAULT 'EUR',
  city             text NOT NULL,
  location         geometry(Point, 4326),
  exchange_prefs   text[] NOT NULL,
  external_links   jsonb NOT NULL DEFAULT '[]',
  url_slug         text NOT NULL UNIQUE,
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  -- Cohérence value_kind <-> value_max : fixed => pas de max ; range => max.
  CONSTRAINT listings_value_kind_max_ck CHECK (
    (value_kind = 'fixed' AND value_max IS NULL) OR
    (value_kind = 'range' AND value_max IS NOT NULL)
  ),
  -- exchange_prefs : au moins une préférence (sous-ensemble non vide).
  CONSTRAINT listings_exchange_prefs_nonempty_ck CHECK (
    array_length(exchange_prefs, 1) >= 1
  )
);

CREATE INDEX IF NOT EXISTS listings_owner_id_idx ON listings (owner_id);
CREATE INDEX IF NOT EXISTS listings_category_slug_idx ON listings (category_slug);
CREATE INDEX IF NOT EXISTS listings_status_idx ON listings (status);
CREATE INDEX IF NOT EXISTS listings_created_at_idx ON listings (created_at DESC);
-- Index spatial partiel : seulement les annonces géolocalisées.
CREATE INDEX IF NOT EXISTS listings_location_gist_idx
  ON listings USING GIST (location)
  WHERE location IS NOT NULL;

COMMENT ON TABLE listings IS
  'Annonces Dealplace (biens et services). Adresse exacte JAMAIS stockée : city = commune, location = centre de commune (optionnel). Règles métier au service (photo obligatoire pour good, catégorie forbidden refusée, etc.).';
COMMENT ON COLUMN listings.exchange_prefs IS
  'Sous-ensemble non vide de {goods, services, money, open} : ce que le propriétaire accepte en échange.';
COMMENT ON COLUMN listings.external_links IS
  'Tableau JSON de liens externes [{label, url}] (ex. lien boutique, réseau social).';

-- ============================================================================
-- 5. listing_media — médias attachés à une annonce (images).
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  media_type    text NOT NULL CHECK (media_type IN ('image', 'video')),
  url           text NOT NULL,
  thumbnail_url text,
  width         int,
  height        int,
  position      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_media_listing_id_idx
  ON listing_media (listing_id);

COMMENT ON TABLE listing_media IS
  'Médias attachés aux annonces Dealplace, ordonnés par position. Photo obligatoire pour les biens (règle service).';

-- ============================================================================
-- 6. listing_tag_map — association N-N annonces <-> tags.
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_tag_map (
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tag_slug   text NOT NULL REFERENCES listing_tags(slug),
  PRIMARY KEY (listing_id, tag_slug)
);

CREATE INDEX IF NOT EXISTS listing_tag_map_tag_slug_idx
  ON listing_tag_map (tag_slug);

COMMENT ON TABLE listing_tag_map IS
  'Association annonces <-> tags transversaux.';

-- ----------------------------------------------------------------------------
-- Triggers updated_at (fonction set_updated_at() définie par 0001).
-- Recréés proprement pour rester rejouables (DROP IF EXISTS puis CREATE).
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS listing_categories_set_updated_at ON listing_categories;
CREATE TRIGGER listing_categories_set_updated_at
  BEFORE UPDATE ON listing_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS listing_subcategories_set_updated_at ON listing_subcategories;
CREATE TRIGGER listing_subcategories_set_updated_at
  BEFORE UPDATE ON listing_subcategories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS listing_tags_set_updated_at ON listing_tags;
CREATE TRIGGER listing_tags_set_updated_at
  BEFORE UPDATE ON listing_tags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS listings_set_updated_at ON listings;
CREATE TRIGGER listings_set_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

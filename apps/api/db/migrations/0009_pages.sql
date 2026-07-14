-- ============================================================================
-- ENDIREK — Lot 3 — Migration 0009 : pages restaurants & entreprises
-- ============================================================================
-- Les pages professionnelles (PRD §12) : pages possédées par des utilisateurs
-- (plusieurs pages par compte), de type 'restaurant' ou 'business'.
--
-- Conception (décisions D69-D76) :
--   - une page est ACTIVE dès sa création (« validation légère ») ; le badge
--     'verified' est accordé/retiré au backoffice ; statuts miroir des
--     annonces (active / hidden / deleted, soft-delete) — D69 ;
--   - le statut d'ouverture (ouvert / fermé / en congés) est DÉRIVÉ à la
--     lecture depuis page_hours + vacation_until (heure Réunion UTC+4),
--     jamais stocké — D70 ;
--   - restaurant : bibliothèque de PLATS (prix en CENTIMES — les euros
--     entiers des annonces ne suffisent pas pour 12,50 €), MENUS programmés
--     par DATE, documents PDF « Nos cartes » — D71 ;
--   - offres et événements pour les deux types de page — D72 ;
--   - les pages deviennent ÉMETTRICES de publications : la FK posts.page_id
--     (anticipée en 0001 sans contrainte) est activée ; posts.map_visible_from
--     permet aux posts d'événement de n'apparaître sur la carte qu'à J-3 ;
--     trois types de posts RÉSERVÉS AUX PAGES (post_types.page_only) — D73 ;
--   - abonnés de page (page_follows) — compteur calculé à la lecture — D74 ;
--   - conversations : la cible devient annonce OU page (exactement une) — D75 ;
--   - signalement de page : reports.target_type accepte 'page' — D76.
--
-- REJOUABLE : CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- contraintes et triggers recréés proprement (DROP ... IF EXISTS puis ADD),
-- INSERT de référence en ON CONFLICT DO NOTHING.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. pages — l'identité professionnelle.
-- ============================================================================
CREATE TABLE IF NOT EXISTS pages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES users(id),
  page_type        text NOT NULL CHECK (page_type IN ('restaurant', 'business')),
  name             text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  -- Identifiant public unique (URL web partageable, comme les posts/annonces).
  url_slug         text NOT NULL UNIQUE,
  bio              text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 500),
  avatar_url       text,
  cover_url        text,
  -- Commune du référentiel La Réunion ; l'adresse exacte n'est jamais stockée
  -- (location = centre de la commune, comme les annonces — D54).
  city             text NOT NULL,
  location         geometry(Point, 4326),
  phone            text CHECK (phone IS NULL OR char_length(phone) <= 30),
  -- Chips libres du mockup 08 (« Créole », « Sur place »...) — 5 max au service.
  attributes       text[] NOT NULL DEFAULT '{}',
  -- Congés : prioritaire sur les horaires tant que la date n'est pas passée.
  vacation_until   timestamptz,
  vacation_message text CHECK (vacation_message IS NULL OR char_length(vacation_message) <= 200),
  -- Badge ✓ du mockup — accordé au backoffice (validation légère a posteriori).
  verified         boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS pages_owner_id_idx ON pages (owner_id);
CREATE INDEX IF NOT EXISTS pages_created_at_idx ON pages (created_at DESC);

COMMENT ON TABLE pages IS
  'Pages professionnelles (Lot 3 — D69) : restaurant ou entreprise, possédée par un utilisateur (plusieurs pages par compte). Statuts miroir des annonces ; verified = badge accordé au backoffice.';
COMMENT ON COLUMN pages.vacation_until IS
  'En congés jusqu''à cette date (D70) — prioritaire sur les horaires pour le statut dérivé ouvert/fermé/congés.';

-- ============================================================================
-- 2. page_hours — plages d'ouverture hebdomadaires (0..n par jour).
--    weekday : 0 = lundi ... 6 = dimanche. Minutes depuis minuit, heure de
--    La Réunion (UTC+4 fixe). Pas de plage à cheval sur minuit (opens < closes).
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_hours (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id       uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  weekday       int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_minute  int NOT NULL CHECK (opens_minute BETWEEN 0 AND 1439),
  closes_minute int NOT NULL CHECK (closes_minute BETWEEN 1 AND 1440),
  position      int NOT NULL DEFAULT 0,
  CONSTRAINT page_hours_opens_before_closes_ck CHECK (opens_minute < closes_minute)
);

CREATE INDEX IF NOT EXISTS page_hours_page_id_idx ON page_hours (page_id);

COMMENT ON TABLE page_hours IS
  'Plages d''ouverture hebdomadaires d''une page (D70) : weekday 0=lundi..6=dimanche, minutes locales Réunion. Remplacées en bloc par PUT /pages/:id/hours.';

-- ============================================================================
-- 3. page_documents — « Nos cartes » (PDF uploadés, restaurant uniquement).
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  label           text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  url             text NOT NULL,
  file_size_bytes int NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
  position        int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_documents_page_id_idx ON page_documents (page_id);

COMMENT ON TABLE page_documents IS
  'Section « Nos cartes » d''un restaurant (D71) : documents PDF uploadés via /media/upload-document (URL ouvrable + téléchargeable). 5 max par page (règle service).';

-- ============================================================================
-- 4. dishes — plats prédéfinis d'un restaurant (bibliothèque).
--    Prix en CENTIMES d'euro (12,50 € = 1250) — au moins un des deux prix.
-- ============================================================================
CREATE TABLE IF NOT EXISTS dishes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id              uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name                 text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description          text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  image_url            text,
  price_takeaway_cents int CHECK (price_takeaway_cents IS NULL OR price_takeaway_cents >= 0),
  price_dinein_cents   int CHECK (price_dinein_cents IS NULL OR price_dinein_cents >= 0),
  position             int NOT NULL DEFAULT 0,
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dishes_price_present_ck
    CHECK (price_takeaway_cents IS NOT NULL OR price_dinein_cents IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS dishes_page_id_idx ON dishes (page_id);

COMMENT ON TABLE dishes IS
  'Plats prédéfinis d''une page restaurant (D71) : image, description, prix distincts à emporter / sur place en CENTIMES. Suppression douce (status) qui retire le plat des menus programmés.';

-- ============================================================================
-- 5. page_menus + page_menu_items — menus programmés PAR DATE.
--    Un menu par (page, date) ; items = plats ordonnés de la bibliothèque.
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_menus (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id    uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  menu_date  date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT page_menus_page_date_key UNIQUE (page_id, menu_date)
);

CREATE INDEX IF NOT EXISTS page_menus_page_date_idx ON page_menus (page_id, menu_date);

CREATE TABLE IF NOT EXISTS page_menu_items (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id  uuid NOT NULL REFERENCES page_menus(id) ON DELETE CASCADE,
  dish_id  uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  CONSTRAINT page_menu_items_menu_dish_key UNIQUE (menu_id, dish_id)
);

CREATE INDEX IF NOT EXISTS page_menu_items_menu_id_idx ON page_menu_items (menu_id);
CREATE INDEX IF NOT EXISTS page_menu_items_dish_id_idx ON page_menu_items (dish_id);

COMMENT ON TABLE page_menus IS
  'Menus du jour programmés par DATE (D71) — « programmer ses menus du jour pour toute la semaine » (PRD §12). PUT /pages/:id/menus/:date remplace la liste ([] = supprime).';

-- ============================================================================
-- 6. page_offers — offres mises en avant sur la page.
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_offers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  image_url   text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT page_offers_period_ck
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS page_offers_page_id_idx ON page_offers (page_id);

COMMENT ON TABLE page_offers IS
  'Offres d''une page (D72) : période optionnelle (isCurrent dérivé à la lecture). Publiables dans le feed/carte via le type de post « offer » (D73).';

-- ============================================================================
-- 7. page_events — événements de la page.
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  image_url   text,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT page_events_period_ck CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS page_events_page_id_idx ON page_events (page_id);
CREATE INDEX IF NOT EXISTS page_events_starts_at_idx ON page_events (starts_at);

COMMENT ON TABLE page_events IS
  'Événements d''une page (D72) : fin effective = ends_at ?? starts_at + 6 h (timing dérivé). Publiables sur la carte de J-3 au terme via le type « event » (D73).';

-- ============================================================================
-- 8. page_follows — abonnés d'une page (D74).
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_follows (
  page_id    uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page_id, user_id)
);

CREATE INDEX IF NOT EXISTS page_follows_user_id_idx ON page_follows (user_id);

COMMENT ON TABLE page_follows IS
  'Abonnements aux pages (D74) : compteur d''abonnés calculé à la lecture (comptes actifs), bonus feed pour les posts des pages suivies.';

-- ============================================================================
-- 9. posts — activation de l'ancrage page (D73).
--    La FK page_id, anticipée SANS contrainte en 0001, est posée maintenant ;
--    map_visible_from permet aux posts d'événement d'apparaître sur la carte
--    à J-3 seulement (NULL = visible dès la création, comportement Lot 1).
-- ============================================================================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS map_visible_from timestamptz;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_page_id_fkey;
ALTER TABLE posts ADD CONSTRAINT posts_page_id_fkey
  FOREIGN KEY (page_id) REFERENCES pages(id);

CREATE INDEX IF NOT EXISTS posts_page_id_idx ON posts (page_id);

COMMENT ON COLUMN posts.page_id IS
  'Post publié AU NOM d''une page (Lot 3 — D73). NULL = post d''utilisateur. author_id reste le compte propriétaire qui a publié.';
COMMENT ON COLUMN posts.map_visible_from IS
  'Début de visibilité carte (D73) : NULL = visible dès la création ; posé à J-3 pour les posts d''événement.';

-- ============================================================================
-- 10. post_types — types réservés aux pages (D73).
--     page_only = true : refusé au composer utilisateur, absent de
--     GET /posts/types ; la durée carte est calculée au SERVICE (23 h 00
--     Réunion pour menu/offer, fin d'événement pour event) — la colonne
--     default_map_duration_minutes reste NULL pour ces types.
-- ============================================================================
ALTER TABLE post_types ADD COLUMN IF NOT EXISTS page_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN post_types.page_only IS
  'Type réservé aux pages professionnelles (Lot 3 — D73) : publiable uniquement via POST /pages/:id/posts, masqué du composer utilisateur.';

INSERT INTO post_types
  (slug, label_fr, icon, color, requires_location_for_map, shows_on_map, default_map_duration_minutes, position, page_only)
VALUES
  ('menu',  'Menu du jour',  'restaurant', '#0EA5A4', false, true, NULL, 6, true),
  ('offer', 'Offre du jour', 'tag',        '#D97706', false, true, NULL, 7, true),
  ('event', 'Événement',     'calendar',   '#DB2777', false, true, NULL, 8, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 11. conversations — la cible devient annonce OU page (D75).
--     listing_id perd son NOT NULL ; exactement UNE des deux cibles est posée.
--     L'unicité (annonce, initiateur) de 0006 reste ; l'unicité (page,
--     initiateur) est portée par un index UNIQUE partiel.
-- ============================================================================
ALTER TABLE conversations ALTER COLUMN listing_id DROP NOT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS page_id uuid REFERENCES pages(id);

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_subject_ck;
ALTER TABLE conversations ADD CONSTRAINT conversations_subject_ck
  CHECK ((listing_id IS NULL) <> (page_id IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS conversations_page_initiator_key
  ON conversations (page_id, initiator_id) WHERE page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_page_id_idx ON conversations (page_id);

COMMENT ON COLUMN conversations.page_id IS
  'Fil lié à une PAGE (Lot 3 — D75, bouton « Message » de la page) : exactement une cible parmi listing_id / page_id. owner_id = propriétaire de la page à la création.';

-- ============================================================================
-- 12. reports.target_type — la cible 'page' devient signalable (D76).
--     Même mécanique que l'extension 'listing' de 0008.
-- ============================================================================
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('post', 'comment', 'user', 'listing', 'page'));

COMMENT ON COLUMN reports.target_type IS
  'Cible polymorphe du signalement : post, comment, user, listing, page (Lot 3 — D76). Pas de FK (intégrité au niveau service).';

-- ----------------------------------------------------------------------------
-- Triggers updated_at (fonction set_updated_at() définie par 0001).
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS pages_set_updated_at ON pages;
CREATE TRIGGER pages_set_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS dishes_set_updated_at ON dishes;
CREATE TRIGGER dishes_set_updated_at
  BEFORE UPDATE ON dishes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS page_menus_set_updated_at ON page_menus;
CREATE TRIGGER page_menus_set_updated_at
  BEFORE UPDATE ON page_menus
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS page_offers_set_updated_at ON page_offers;
CREATE TRIGGER page_offers_set_updated_at
  BEFORE UPDATE ON page_offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS page_events_set_updated_at ON page_events;
CREATE TRIGGER page_events_set_updated_at
  BEFORE UPDATE ON page_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- ============================================================================
-- ENDIREK — Lot 1 — Migration 0002 : données de référence
-- ============================================================================
-- AVERTISSEMENT : comme 0001, ce fichier n'a pas encore été exécuté contre
-- un vrai PostGIS (Docker absent sur la machine de dev). Le mock TypeScript
-- embarque ces mêmes lignes de référence en attendant.
--
-- Rejouable : les INSERT utilisent ON CONFLICT DO NOTHING, donc relancer le
-- fichier ne duplique rien et n'écrase pas les ajustements faits ensuite
-- depuis le backoffice (libellés, icônes, couleurs, durées).
--
-- Fichier à enregistrer/exécuter en UTF-8 (emojis dans reaction_types).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Types de publication du Lot 1 (icônes et couleurs provisoires, ajustables
-- depuis le backoffice sans migration).
-- ----------------------------------------------------------------------------
INSERT INTO post_types
  (slug, label_fr, icon, color, requires_location_for_map, shows_on_map, default_map_duration_minutes, position)
VALUES
  ('free',     'Publication libre', 'pencil',  '#1173D4', false, false, NULL, 1),
  ('weather',  'Point météo',       'cloud',   '#3B82F6', true,  true,  120,  2),
  ('traffic',  'Point trafic',      'car',     '#F97316', true,  true,  120,  3),
  ('danger',   'Accident / danger', 'warning', '#EF4444', true,  true,  120,  4),
  ('question', 'Question / aide',   'help',    '#8B5CF6', false, false, NULL, 5)
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Palette de réactions du Lot 1.
-- ----------------------------------------------------------------------------
INSERT INTO reaction_types (emoji, label_fr, position)
VALUES
  ('👍', 'J''aime',  1),
  ('❤️', 'J''adore', 2),
  ('😂', 'Haha',     3),
  ('😮', 'Wouah',    4),
  ('😢', 'Triste',   5),
  ('😡', 'Grr',      6)
ON CONFLICT (emoji) DO NOTHING;

COMMIT;

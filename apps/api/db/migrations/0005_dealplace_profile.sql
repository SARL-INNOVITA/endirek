-- ============================================================================
-- ENDIREK — Lot 2 — CP2.2 — Migration 0005 : profil Dealplace
-- ============================================================================
-- Le CP2.2 (périmètre arbitré le 2026-07-11, décision D59 — SANS avis, ils
-- arrivent avec les deals au CP2.4) étend le PROFIL UTILISATEUR d'un champ
-- Dealplace : « Ce que je recherche » (texte libre affiché sur le volet
-- Profil Dealplace — mockup 05).
--
-- EXTENSION de la table users du Lot 1 (pas de table dédiée : décision du
-- TODO Lot 2 §1.3 « réutiliser le profil users, extension pas duplication »).
-- Nullable : non renseigné par défaut ; 500 caractères max, garanti au
-- SERVICE (aligné sur bio — pas de CHECK pour rester cohérent avec bio).
--
-- REJOUABLE : ADD COLUMN IF NOT EXISTS — ré-application sans erreur sur une
-- base déjà migrée.
-- ============================================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dealplace_seeking text;

COMMENT ON COLUMN users.dealplace_seeking IS
  'Volet Profil Dealplace (CP2.2) : « Ce que je recherche » — texte libre public (500 caractères max, garanti au service), NULL = non renseigné.';

COMMIT;

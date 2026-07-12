-- ============================================================================
-- ENDIREK — Lot 2 — CP2.5 — Migration 0008 : modération avancée Dealplace
-- ============================================================================
-- Trois extensions de modération (décisions D65-D67) :
--
-- 1. SIGNALEMENT D'ANNONCE côté utilisateur (D65) : la cible polymorphe des
--    signalements accepte désormais 'listing' (le CHECK de 0001 est étendu).
--    Même cycle de vie que les posts : file admin, traitement, notification
--    report_handled au signaleur.
--
-- 2. MODÉRATION DES MESSAGES (D67) : les messages de conversation gagnent un
--    statut 'active'/'hidden' (masquage doux par le backoffice — miroir des
--    commentaires, sans 'deleted' : D63 exclut la suppression de message).
--    Un message masqué RESTE dans le fil (pagination et non-lus inchangés),
--    son corps est remplacé côté service pour les participants.
--
-- 3. ARBITRAGE DES LITIGES (D66) : l'état 'disputed' n'est plus terminal —
--    un modérateur TRANCHE (cancelled : annulé / completed : conclu, ouvre
--    les avis / resumed : reprise, le deal redevient actif). AUCUN nouveau
--    statut de deal : l'issue est tracée par les colonnes dispute_resolved_*
--    (miroir du pattern reports.handled_by/handled_at/resolution_note).
--
-- REJOUABLE : ADD COLUMN IF NOT EXISTS, contraintes recréées proprement
-- (DROP CONSTRAINT IF EXISTS puis ADD — même esprit que les triggers).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. reports.target_type — la cible 'listing' devient signalable (D65).
--    Le CHECK inline de 0001 a été auto-nommé reports_target_type_check.
-- ============================================================================
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('post', 'comment', 'user', 'listing'));

COMMENT ON COLUMN reports.target_type IS
  'Cible polymorphe du signalement : post, comment, user, listing (CP2.5 — D65). Pas de FK (intégrité au niveau service).';

-- ============================================================================
-- 2. messages.status — masquage doux par la modération (D67).
--    'active' (défaut) ou 'hidden' — pas de 'deleted' (D63 : les messages ne
--    sont ni éditables ni supprimables). Un message masqué reste compté dans
--    les non-lus et dans la pagination ; seul son CORPS est remplacé pour les
--    participants (« Message masqué par la modération. »).
-- ============================================================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_status_check
  CHECK (status IN ('active', 'hidden'));

COMMENT ON COLUMN messages.status IS
  'Modération backoffice (CP2.5 — D67) : active (visible) ou hidden (corps masqué aux participants, message conservé dans le fil).';

-- ============================================================================
-- 3. deals — traçabilité de l'arbitrage d'un litige (D66).
--    QUI a tranché, QUAND, l'ISSUE et la note de décision (montrée aux deux
--    parties). Le statut du deal reprend une valeur EXISTANTE du CHECK de
--    0007 (cancelled / completed / active) — aucun nouveau statut.
-- ============================================================================
ALTER TABLE deals ADD COLUMN IF NOT EXISTS dispute_resolved_by uuid REFERENCES users(id);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamptz;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS dispute_resolution text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS dispute_resolution_note text;

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_dispute_resolution_check;
ALTER TABLE deals ADD CONSTRAINT deals_dispute_resolution_check
  CHECK (dispute_resolution IS NULL
         OR dispute_resolution IN ('cancelled', 'completed', 'resumed'));

COMMENT ON COLUMN deals.dispute_resolved_by IS
  'Arbitrage (CP2.5 — D66) : modérateur qui a tranché le litige (NULL = litige non arbitré).';
COMMENT ON COLUMN deals.dispute_resolution IS
  'Issue de l''arbitrage : cancelled (deal annulé), completed (deal conclu — ouvre les avis), resumed (reprise — le deal redevient actif). NULL tant que le litige n''est pas tranché.';
COMMENT ON COLUMN deals.dispute_resolution_note IS
  'Note de décision du modérateur, montrée aux DEUX parties (obligatoire à l''arbitrage).';

COMMIT;

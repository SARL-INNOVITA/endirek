-- ============================================================================
-- ENDIREK — Lot 2 — CP2.4 — Migration 0007 : deals contractuels + avis
-- ============================================================================
-- Le cœur du Dealplace (décision D64, mockups 05/07) : un DEAL est un contrat
-- d'échange entre deux utilisateurs autour d'une annonce, composé d'ÉLÉMENTS
-- fournis par chaque partie, chacun décomposé en SOUS-ÉLÉMENTS validables
-- (le FOURNISSEUR « honore », la CONTREPARTIE « valide » — le deal n'avance
-- que si les deux parties valident). Les AJUSTEMENTS tracent la négociation
-- en cours de deal (add/modify/remove d'éléments, appliqués à l'acceptation),
-- les NOTES alimentent le « Suivi du deal », et les AVIS (3 critères du
-- mockup 05) ne sont possibles que sur un deal CONCLU.
--
-- Machine à états (statuts du deal) :
--   proposed  → active (accepté par le destinataire) | declined | cancelled
--               (retiré par le proposeur avant accord)
--   active    → completed (AUTOMATIQUE : tous les sous-éléments validés)
--             → cancelled (annulation amiable EN DEUX TEMPS :
--               cancellation_requested_by puis confirmation de l'autre)
--             → disputed (unilatéral — état terminal au CP2.4, l'arbitrage
--               (IA/backoffice) est un chantier ultérieur)
-- Le stepper 5 étapes du mockup 07 (Discussion → Accord → En cours →
-- Validations → Conclu) est DÉRIVÉ côté client de status + de l'état des
-- sous-éléments — il n'est pas stocké.
--
-- REJOUABLE : CREATE TABLE/INDEX IF NOT EXISTS, séquence protégée, triggers
-- recréés proprement.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. deals — le contrat d'échange.
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS deals_deal_number_seq;

CREATE TABLE IF NOT EXISTS deals (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Numéro lisible « Deal 345 » (mockup 07) — séquence, jamais réutilisé.
  deal_number               int NOT NULL UNIQUE
                            DEFAULT nextval('deals_deal_number_seq'),
  listing_id                uuid NOT NULL REFERENCES listings(id),
  -- Fil de conversation lié (mockup : « Conversation liée ») — créé avec le
  -- deal si absent (message automatique du proposeur, D63 : pas de fil vide).
  conversation_id           uuid REFERENCES conversations(id),
  proposer_id               uuid NOT NULL REFERENCES users(id),
  recipient_id              uuid NOT NULL REFERENCES users(id),
  status                    text NOT NULL DEFAULT 'proposed'
                            CHECK (status IN ('proposed', 'active', 'completed',
                                              'declined', 'cancelled', 'disputed')),
  -- Échéance indicative (mockup : « Non définie » possible).
  due_date                  timestamptz,
  -- Annulation amiable en deux temps : qui l'a demandée (NULL = personne).
  cancellation_requested_by uuid REFERENCES users(id),
  -- Litige : qui l'a déclaré + motif (état terminal au CP2.4).
  disputed_by               uuid REFERENCES users(id),
  dispute_reason            text,
  accepted_at               timestamptz,
  completed_at              timestamptz,
  closed_at                 timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deals_distinct_parties_ck CHECK (proposer_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS deals_proposer_id_idx ON deals (proposer_id);
CREATE INDEX IF NOT EXISTS deals_recipient_id_idx ON deals (recipient_id);
CREATE INDEX IF NOT EXISTS deals_listing_id_idx ON deals (listing_id);
CREATE INDEX IF NOT EXISTS deals_status_idx ON deals (status);
CREATE INDEX IF NOT EXISTS deals_created_at_idx ON deals (created_at DESC);

COMMENT ON TABLE deals IS
  'Deals contractuels (CP2.4 — D64) : contrat d''échange lié à une annonce entre proposer et recipient. Machine à états proposed/active/completed/declined/cancelled/disputed ; conclusion AUTOMATIQUE quand tous les sous-éléments sont validés.';

-- ============================================================================
-- 2. deal_items — ce que CHAQUE partie fournit.
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  -- Le FOURNISSEUR de l'élément (l'une des deux parties du deal).
  provider_id uuid NOT NULL REFERENCES users(id),
  kind        text NOT NULL CHECK (kind IN ('service', 'good', 'money')),
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  -- Valeur estimée en euros entiers (mockup : « Valeur estimée : 800 € »).
  value       int NOT NULL CHECK (value >= 0),
  position    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_items_deal_id_idx ON deal_items (deal_id);

COMMENT ON TABLE deal_items IS
  'Éléments d''un deal (« Ce que j''offre » / « Ce que mon deal-partner offre ») — badge d''état DÉRIVÉ des sous-éléments, jamais stocké.';

-- ============================================================================
-- 3. deal_item_steps — sous-éléments validables (l'unité de validation).
--
-- CHAQUE élément a AU MOINS un step (créé automatiquement avec le titre de
-- l'élément si la proposition n'en fournit pas) : un seul chemin de
-- validation. Le FOURNISSEUR pose honored_at ; la CONTREPARTIE pose
-- validated_at (uniquement si honoré). Ni l'un ni l'autre ne se retirent.
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_item_steps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid NOT NULL REFERENCES deal_items(id) ON DELETE CASCADE,
  label        text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  position     int NOT NULL DEFAULT 0,
  honored_at   timestamptz,
  validated_at timestamptz,
  -- Un step ne peut pas être validé sans avoir été honoré.
  CONSTRAINT deal_item_steps_validated_after_honored_ck
    CHECK (validated_at IS NULL OR honored_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS deal_item_steps_item_id_idx
  ON deal_item_steps (item_id);

COMMENT ON TABLE deal_item_steps IS
  'Sous-éléments validables d''un élément de deal : honored_at posé par le fournisseur, validated_at par la contrepartie (le deal se conclut quand TOUT est validé).';

-- ============================================================================
-- 4. deal_adjustments — négociation en cours de deal (mockup : « Ajustements
-- proposés »). Appliqués AUTOMATIQUEMENT à l'acceptation (add/modify/remove
-- d'éléments — payload jsonb structuré), refusés sinon. Ne concernent que la
-- phase 'active' (en 'proposed', le proposeur édite librement sa proposition).
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_adjustments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL REFERENCES users(id),
  kind        text NOT NULL CHECK (kind IN ('add', 'modify', 'remove')),
  -- Élément visé (modify/remove) — SET NULL si l'élément disparaît ensuite.
  item_id     uuid REFERENCES deal_items(id) ON DELETE SET NULL,
  -- add : élément complet { providerId, kind, title, description, value,
  -- steps[] } ; modify : champs modifiés { title?, description?, value?,
  -- kind? } ; remove : {}.
  payload     jsonb NOT NULL DEFAULT '{}',
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'rejected')),
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_adjustments_deal_id_idx
  ON deal_adjustments (deal_id);

COMMENT ON TABLE deal_adjustments IS
  'Ajustements proposés en cours de deal (add/modify/remove d''un élément) — la CONTREPARTIE accepte (application transactionnelle du payload) ou refuse.';

-- ============================================================================
-- 5. deal_notes — « Suivi du deal » (timeline de notes des participants).
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES users(id),
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_notes_deal_id_idx ON deal_notes (deal_id);

COMMENT ON TABLE deal_notes IS
  'Notes de suivi d''un deal (timeline « Suivi du deal » du mockup 07) — notes utilisateur uniquement, les jalons d''état sont dérivés.';

-- ============================================================================
-- 6. deal_reviews — avis détaillés (mockup 05, décision D59 : liés à un deal
-- CONCLU). Trois critères 1-5 ; la note globale = moyenne CALCULÉE À LA
-- LECTURE (jamais stockée). Un avis par (deal, évaluateur), non modifiable.
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  reviewer_id       uuid NOT NULL REFERENCES users(id),
  reviewee_id       uuid NOT NULL REFERENCES users(id),
  -- Critères du mockup 05 : Honnêteté et fiabilité / Conformité à la
  -- description / Amabilité et courtoisie.
  rating_honesty    int NOT NULL CHECK (rating_honesty BETWEEN 1 AND 5),
  rating_conformity int NOT NULL CHECK (rating_conformity BETWEEN 1 AND 5),
  rating_kindness   int NOT NULL CHECK (rating_kindness BETWEEN 1 AND 5),
  comment           text CHECK (comment IS NULL OR char_length(comment) <= 500),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_reviews_reviewer_per_deal_key UNIQUE (deal_id, reviewer_id),
  CONSTRAINT deal_reviews_distinct_parties_ck CHECK (reviewer_id <> reviewee_id)
);

CREATE INDEX IF NOT EXISTS deal_reviews_reviewee_id_idx
  ON deal_reviews (reviewee_id);

COMMENT ON TABLE deal_reviews IS
  'Avis détaillés (CP2.4 — D59/D64) : un avis par partie sur un deal CONCLU. Note globale = moyenne des 3 critères, calculée à la lecture.';

-- ----------------------------------------------------------------------------
-- Trigger updated_at (fonction set_updated_at() définie par 0001).
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS deals_set_updated_at ON deals;
CREATE TRIGGER deals_set_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

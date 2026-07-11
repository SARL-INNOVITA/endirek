-- ============================================================================
-- ENDIREK — Lot 2 — CP2.3 — Migration 0006 : conversations 1-to-1
-- ============================================================================
-- Messagerie privée temps réel entre utilisateurs, LIÉE À UNE ANNONCE au
-- CP2.3 (point d'entrée unique : « Contacter » depuis le détail d'une
-- annonce). Les deals (CP2.4) étendront ce modèle.
--
-- Conception (décision D63) :
--   - une conversation = (annonce, initiateur) UNIQUE — l'initiateur est
--     celui qui contacte, owner_id est le propriétaire de l'annonce au
--     moment de la création (dénormalisé : l'annonce ne change jamais de
--     propriétaire au Lot 2) ;
--   - lecture par participant : initiator_last_read_at / owner_last_read_at
--     (un message est « non lu » s'il vient de l'AUTRE participant et est
--     postérieur à mon last_read_at) ;
--   - last_message_at dénormalisé À L'ÉCRITURE du message (tri des listes) —
--     exception assumée à la règle « compteurs à la lecture » : c'est un
--     horodatage posé dans la MÊME transaction que l'INSERT du message, pas
--     un agrégat recalculable divergent ;
--   - messages TEXTE uniquement au CP2.3 (1 à 2000 caractères), pas de
--     pièces jointes (adapter média réutilisable plus tard) ;
--   - pas de suppression de conversation/message au CP2.3.
--
-- REJOUABLE : CREATE TABLE/INDEX IF NOT EXISTS, triggers recréés proprement.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. conversations — un fil privé 1-to-1 par (annonce, initiateur).
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id              uuid NOT NULL REFERENCES listings(id),
  initiator_id            uuid NOT NULL REFERENCES users(id),
  owner_id                uuid NOT NULL REFERENCES users(id),
  initiator_last_read_at  timestamptz,
  owner_last_read_at      timestamptz,
  -- Posé à chaque message (même transaction) — tri antéchronologique des
  -- listes de conversations. NULL tant qu'aucun message (état transitoire :
  -- la création passe toujours par un premier message).
  last_message_at         timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  -- On ne converse pas avec soi-même (sa propre annonce → 400 au service).
  CONSTRAINT conversations_distinct_participants_ck CHECK (initiator_id <> owner_id),
  -- Une seule conversation par annonce et par demandeur.
  CONSTRAINT conversations_listing_initiator_key UNIQUE (listing_id, initiator_id)
);

CREATE INDEX IF NOT EXISTS conversations_initiator_id_idx
  ON conversations (initiator_id);
CREATE INDEX IF NOT EXISTS conversations_owner_id_idx
  ON conversations (owner_id);
CREATE INDEX IF NOT EXISTS conversations_last_message_at_idx
  ON conversations (last_message_at DESC);

COMMENT ON TABLE conversations IS
  'Messagerie privée 1-to-1 (CP2.3), liée à une annonce : une conversation par (listing, initiateur). owner_id = propriétaire de l''annonce. Lecture par participant via *_last_read_at.';

-- ============================================================================
-- 2. messages — messages texte d'une conversation.
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES users(id),
  body            text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at DESC);

COMMENT ON TABLE messages IS
  'Messages TEXTE (1-2000 caractères) des conversations Dealplace — pas de pièces jointes au CP2.3.';

-- ----------------------------------------------------------------------------
-- Trigger updated_at (fonction set_updated_at() définie par 0001).
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS conversations_set_updated_at ON conversations;
CREATE TRIGGER conversations_set_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

/**
 * Seed Lot 2 — CP2.3 : conversations 1-to-1 de démonstration.
 *
 * 2 conversations liées à des annonces du seed (6 messages au total),
 * pensées pour la démo :
 *
 * 1. Valérie (n°4) contacte Kévin (n°11) sur son « panier péi » (annonce
 *    n°4) — 4 messages ; le DERNIER (de Kévin) n'est PAS ENCORE LU par
 *    Valérie → son badge messagerie affiche 1 conversation non lue au boot.
 * 2. David (n°13) contacte Valérie (n°4) sur son canapé (annonce n°1) —
 *    2 messages, tout est lu des deux côtés.
 *
 * Reconstruits À CHAQUE appel (dates relatives minutesAgo recalculées,
 * objets neufs). `lastMessageAt` = date du dernier message de chaque fil
 * (dénormalisé à l'écriture — décision D63) ; les jalons de lecture
 * `*LastReadAt` sont posés ENTRE les messages pour produire l'état non-lu
 * décrit ci-dessus.
 */

import { Conversation, Message } from '../domain/entities';
import { minutesAgo, seedUuid } from './seed-utils';

/** Spécification déclarative d'un message seed. */
interface MessageSpec {
  n: number;
  conversationN: number;
  /** Numéro d'utilisateur seed de l'émetteur. */
  senderN: number;
  body: string;
  /** Ancienneté d'envoi en minutes (createdAt = minutesAgo(n)). */
  ageMinutes: number;
}

/** Spécification déclarative d'une conversation seed. */
interface ConversationSpec {
  n: number;
  /** Numéro d'annonce seed (listings.seed.ts). */
  listingN: number;
  /** Numéro d'utilisateur seed du demandeur (≠ propriétaire de l'annonce). */
  initiatorN: number;
  /** Propriétaire de l'annonce (dénormalisé — DOIT égaler son ownerN). */
  ownerN: number;
  /** Ancienneté de création en minutes (= premier message). */
  ageMinutes: number;
  /** Jalon de lecture du demandeur, en minutes (null = jamais lu). */
  initiatorReadAgeMinutes: number | null;
  /** Jalon de lecture du propriétaire, en minutes (null = jamais lu). */
  ownerReadAgeMinutes: number | null;
}

const CONVERSATION_SPECS: ConversationSpec[] = [
  {
    // Valérie → Kévin, sur le panier péi (annonce n°4, owner n°11).
    n: 1,
    listingN: 4,
    initiatorN: 4,
    ownerN: 11,
    ageMinutes: 300,
    // Valérie a lu jusqu'au message de Kévin d'il y a 240 min : le dernier
    // message (Kévin, il y a 120 min) reste NON LU pour elle.
    initiatorReadAgeMinutes: 200,
    // Kévin a tout lu (jalon postérieur au dernier message de Valérie).
    ownerReadAgeMinutes: 130,
  },
  {
    // David → Valérie, sur le canapé (annonce n°1, owner n°4). Tout est lu.
    n: 2,
    listingN: 1,
    initiatorN: 13,
    ownerN: 4,
    ageMinutes: 90,
    initiatorReadAgeMinutes: 30,
    ownerReadAgeMinutes: 30,
  },
];

const MESSAGE_SPECS: MessageSpec[] = [
  // Conversation 1 — Valérie ↔ Kévin (panier péi).
  {
    n: 1,
    conversationN: 1,
    senderN: 4,
    body:
      'Bonjour Kévin ! Votre panier péi m’intéresse — le miel est bien de '
      + 'la récolte de cette année ?',
    ageMinutes: 300,
  },
  {
    n: 2,
    conversationN: 1,
    senderN: 11,
    body:
      'Bonjour Valérie ! Oui, récolte de juin, mis en pot la semaine '
      + 'dernière. Les lentilles viennent de la parcelle familiale.',
    ageMinutes: 240,
  },
  {
    n: 3,
    conversationN: 1,
    senderN: 4,
    body:
      'Parfait ! Je passe à Cilaos samedi matin, on peut se retrouver au '
      + 'marché ?',
    ageMinutes: 180,
  },
  {
    n: 4,
    conversationN: 1,
    senderN: 11,
    body:
      'Ça marche pour samedi, 9 h devant l’église. Je vous mets un pot de '
      + 'confiture goyavier en bonus !',
    ageMinutes: 120,
  },
  // Conversation 2 — David ↔ Valérie (canapé).
  {
    n: 5,
    conversationN: 2,
    senderN: 13,
    body:
      'Bonjour ! Le canapé est toujours disponible ? Je peux proposer des '
      + 'cours de soutien en échange d’une partie du prix.',
    ageMinutes: 90,
  },
  {
    n: 6,
    conversationN: 2,
    senderN: 4,
    body:
      'Bonjour David, oui toujours dispo ! Le troc partiel m’intéresse, '
      + 'mes marmailles ont besoin d’aide en maths. On en discute ?',
    ageMinutes: 45,
  },
];

/** Les 2 conversations de démonstration — reconstruites à chaque appel. */
export function buildSeedConversations(): Conversation[] {
  return CONVERSATION_SPECS.map((spec) => {
    const createdAt = minutesAgo(spec.ageMinutes);
    // Dernier message du fil = plus petit ageMinutes de ses messages.
    const lastAge = Math.min(
      ...MESSAGE_SPECS.filter((m) => m.conversationN === spec.n).map(
        (m) => m.ageMinutes,
      ),
    );
    return {
      id: seedUuid('conversation', spec.n),
      listingId: seedUuid('listing', spec.listingN),
      initiatorId: seedUuid('user', spec.initiatorN),
      ownerId: seedUuid('user', spec.ownerN),
      initiatorLastReadAt:
        spec.initiatorReadAgeMinutes === null
          ? null
          : minutesAgo(spec.initiatorReadAgeMinutes),
      ownerLastReadAt:
        spec.ownerReadAgeMinutes === null
          ? null
          : minutesAgo(spec.ownerReadAgeMinutes),
      lastMessageAt: minutesAgo(lastAge),
      createdAt,
      updatedAt: createdAt,
    };
  });
}

/** Les 6 messages de démonstration — reconstruits à chaque appel. */
export function buildSeedMessages(): Message[] {
  return MESSAGE_SPECS.map((spec) => ({
    id: seedUuid('message', spec.n),
    conversationId: seedUuid('conversation', spec.conversationN),
    senderId: seedUuid('user', spec.senderN),
    body: spec.body,
    createdAt: minutesAgo(spec.ageMinutes),
  }));
}

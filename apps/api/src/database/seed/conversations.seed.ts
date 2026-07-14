/**
 * Seed Lot 2 — CP2.3/CP2.5 (+ Lot 3) : conversations 1-to-1 de démonstration.
 *
 * 4 conversations (11 messages au total) : 3 liées à des annonces du seed,
 * 1 liée à une PAGE (Lot 3 — D75), pensées pour la démo :
 *
 * 1. Valérie (n°4) contacte Kévin (n°11) sur son « panier péi » (annonce
 *    n°4) — 4 messages ; le DERNIER (de Kévin) n'est PAS ENCORE LU par
 *    Valérie → son badge messagerie affiche 1 conversation non lue au boot.
 * 2. David (n°13) contacte Valérie (n°4) sur son canapé (annonce n°1) —
 *    2 messages, tout est lu des deux côtés.
 * 3. Didier (n°5) contacte Sully (n°7) sur l'initiation surf (annonce n°7,
 *    fil du deal seed n°3 EN LITIGE) — 3 messages dont le DERNIER est MASQUÉ
 *    par la modération (CP2.5, D67) : les participants voient « Message
 *    masqué par la modération. », le backoffice voit le corps réel.
 * 4. Laurence (n°10) écrit à la PAGE restaurant « Bon Goût » (page n°1,
 *    propriétaire David n°13) via le bouton « Message » — 2 messages, tout
 *    est lu (Lot 3 — D75 : fil lié à une page, même mécanique de lecture).
 *
 * Reconstruits À CHAQUE appel (dates relatives minutesAgo recalculées,
 * objets neufs). `lastMessageAt` = date du dernier message de chaque fil
 * (dénormalisé à l'écriture — décision D63) ; les jalons de lecture
 * `*LastReadAt` sont posés ENTRE les messages pour produire l'état non-lu
 * décrit ci-dessus.
 */

import { Conversation, Message, MessageStatus } from '../domain/entities';
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
  /** Modération (CP2.5 — D67) : absent = 'active'. */
  status?: MessageStatus;
}

/** Spécification déclarative d'une conversation seed — exactement UNE cible
 * parmi listingN / pageN (D75). */
interface ConversationSpec {
  n: number;
  /** Numéro d'annonce seed (listings.seed.ts) — absent si fil de page. */
  listingN?: number;
  /** Numéro de page seed (pages.seed.ts) — absent si fil d'annonce (Lot 3). */
  pageN?: number;
  /** Numéro d'utilisateur seed du demandeur (≠ propriétaire de la cible). */
  initiatorN: number;
  /** Propriétaire de la cible (dénormalisé — DOIT égaler son ownerN). */
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
  {
    // Didier → Sully, sur l'initiation surf (annonce n°7, owner n°7) — le
    // fil du deal seed n°3 EN LITIGE (CP2.5). Tout est lu des deux côtés
    // (le badge de démo reste celui de Valérie, conversation n°1).
    n: 3,
    listingN: 7,
    initiatorN: 5,
    ownerN: 7,
    ageMinutes: 5760,
    initiatorReadAgeMinutes: 2800,
    ownerReadAgeMinutes: 2800,
  },
  {
    // Laurence → page « Bon Goût » (page n°1, propriétaire David n°13) —
    // fil de PAGE (Lot 3, D75). Tout est lu des deux côtés.
    n: 4,
    pageN: 1,
    initiatorN: 10,
    ownerN: 13,
    ageMinutes: 400,
    initiatorReadAgeMinutes: 300,
    ownerReadAgeMinutes: 300,
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
  // Conversation 3 — Didier ↔ Sully (initiation surf, deal en litige).
  {
    n: 7,
    conversationN: 3,
    senderN: 5,
    body:
      'Bonjour Sully ! Votre initiation surf m’intéresse — je vous propose '
      + 'la révision complète de votre VTT en échange.',
    ageMinutes: 5760,
  },
  {
    n: 8,
    conversationN: 3,
    senderN: 7,
    body:
      'Bonjour Didier, ça me va ! Je vous propose deux créneaux, samedi ou '
      + 'dimanche matin, à Saint-Leu.',
    ageMinutes: 5700,
  },
  {
    n: 9,
    conversationN: 3,
    senderN: 5,
    body:
      'Trois annulations de suite, c’est du grand n’importe quoi — vous '
      + 'êtes une arnaqueuse, rendez-moi mon temps !',
    ageMinutes: 2900,
    // Masqué par la modération (démo CP2.5) : les participants voient le
    // placeholder, le backoffice voit ce corps réel.
    status: 'hidden',
  },
  // Conversation 4 — Laurence ↔ page « Bon Goût » (Lot 3 — D75).
  {
    n: 10,
    conversationN: 4,
    senderN: 10,
    body:
      'Bonjour ! Proposez-vous des plats végétariens au menu cette '
      + 'semaine ? Et peut-on réserver pour 6 personnes vendredi midi ?',
    ageMinutes: 400,
  },
  {
    n: 11,
    conversationN: 4,
    senderN: 13,
    body:
      'Bonjour Laurence ! Oui, le bowl végétarien est au menu presque tous '
      + 'les jours. Pour vendredi midi 6 personnes, pas de souci — passez '
      + 'vers 12 h, on vous garde la grande table.',
    ageMinutes: 350,
  },
];

/** Les 4 conversations de démonstration — reconstruites à chaque appel. */
export function buildSeedConversations(): Conversation[] {
  return CONVERSATION_SPECS.map((spec) => {
    if ((spec.listingN === undefined) === (spec.pageN === undefined)) {
      throw new Error(
        `Seed conversations : la conversation n°${spec.n} doit cibler une annonce OU une page (exactement une).`,
      );
    }
    const createdAt = minutesAgo(spec.ageMinutes);
    // Dernier message du fil = plus petit ageMinutes de ses messages.
    const lastAge = Math.min(
      ...MESSAGE_SPECS.filter((m) => m.conversationN === spec.n).map(
        (m) => m.ageMinutes,
      ),
    );
    return {
      id: seedUuid('conversation', spec.n),
      listingId:
        spec.listingN === undefined ? null : seedUuid('listing', spec.listingN),
      pageId: spec.pageN === undefined ? null : seedUuid('page', spec.pageN),
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

/** Les 11 messages de démonstration — reconstruits à chaque appel. */
export function buildSeedMessages(): Message[] {
  return MESSAGE_SPECS.map((spec) => ({
    id: seedUuid('message', spec.n),
    conversationId: seedUuid('conversation', spec.conversationN),
    senderId: seedUuid('user', spec.senderN),
    body: spec.body,
    status: spec.status ?? 'active',
    createdAt: minutesAgo(spec.ageMinutes),
  }));
}

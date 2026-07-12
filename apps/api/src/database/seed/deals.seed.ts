/**
 * Seed Lot 2 — CP2.4/CP2.5 : deals contractuels + avis de démonstration.
 *
 * 3 deals pensés pour la démo (mockups 05/07 + backoffice CP2.5) :
 *
 * 1. Deal n°1 — ACTIF, Valérie (n°4) ⇄ Kévin (n°11), lié à leur conversation
 *    seed sur le « panier péi » (annonce n°4) : Kévin fournit le panier
 *    (2 sous-éléments, 1 honoré) et une sortie guidée (non entamée) ; Valérie
 *    fournit un coup de main sur le site web (2 sous-éléments, 1 honoré ET
 *    validé). + 1 ajustement PENDING proposé par Kévin et 1 note de suivi —
 *    la page de deal montre tous ses états au premier boot.
 *
 * 2. Deal n°2 — CONCLU, David (n°13) ⇄ Valérie (n°4), lié au canapé (annonce
 *    n°1, conversation seed n°2) : tout honoré/validé + AVIS CROISÉS →
 *    alimente le profil Dealplace (« 1 deal réalisé », note globale, dernier
 *    avis) des deux comptes.
 *
 * 3. Deal n°3 — EN LITIGE (CP2.5, D66), Didier (n°5) ⇄ Sully (n°7), lié à
 *    l'initiation surf (annonce n°7, conversation seed n°3) : Didier a honoré
 *    sa part (révision du VTT, validée) mais la 2ᵉ séance de surf a été
 *    annulée à répétition → litige déclaré par Didier, NON ARBITRÉ → la file
 *    « Litiges » du backoffice a un cas à trancher au premier boot.
 *
 * Reconstruits À CHAQUE appel (dates relatives recalculées, objets neufs).
 * Les numéros de deal (1, 2, 3) sont FIXES — les séquences des drivers sont
 * resynchronisées après le seed (prochain numéro : 4).
 */

import {
  Deal,
  DealAdjustment,
  DealItem,
  DealItemStep,
  DealNote,
  DealReview,
} from '../domain/entities';
import { daysAgo, minutesAgo, seedUuid } from './seed-utils';

/** Les 2 deals de démonstration. */
export function buildSeedDeals(): Deal[] {
  return [
    {
      // Valérie propose à Kévin (échange autour du panier péi).
      id: seedUuid('deal', 1),
      dealNumber: 1,
      listingId: seedUuid('listing', 4),
      conversationId: seedUuid('conversation', 1),
      proposerId: seedUuid('user', 4),
      recipientId: seedUuid('user', 11),
      status: 'active',
      dueDate: null,
      cancellationRequestedBy: null,
      disputedBy: null,
      disputeReason: null,
      disputeResolvedBy: null,
      disputeResolvedAt: null,
      disputeResolution: null,
      disputeResolutionNote: null,
      acceptedAt: minutesAgo(100),
      completedAt: null,
      closedAt: null,
      createdAt: minutesAgo(110),
      updatedAt: minutesAgo(30),
    },
    {
      // David ⇄ Valérie autour du canapé — CONCLU il y a 3 jours.
      id: seedUuid('deal', 2),
      dealNumber: 2,
      listingId: seedUuid('listing', 1),
      conversationId: seedUuid('conversation', 2),
      proposerId: seedUuid('user', 13),
      recipientId: seedUuid('user', 4),
      status: 'completed',
      dueDate: null,
      cancellationRequestedBy: null,
      disputedBy: null,
      disputeReason: null,
      disputeResolvedBy: null,
      disputeResolvedAt: null,
      disputeResolution: null,
      disputeResolutionNote: null,
      acceptedAt: daysAgo(5),
      completedAt: daysAgo(3),
      closedAt: null,
      createdAt: daysAgo(6),
      updatedAt: daysAgo(3),
    },
    {
      // Didier ⇄ Sully autour de l'initiation surf — EN LITIGE, non arbitré
      // (CP2.5 : cas à trancher dans la file « Litiges » du backoffice).
      id: seedUuid('deal', 3),
      dealNumber: 3,
      listingId: seedUuid('listing', 7),
      conversationId: seedUuid('conversation', 3),
      proposerId: seedUuid('user', 5),
      recipientId: seedUuid('user', 7),
      status: 'disputed',
      dueDate: null,
      cancellationRequestedBy: null,
      disputedBy: seedUuid('user', 5),
      disputeReason:
        'La deuxième séance de surf a été annulée trois fois au dernier '
        + 'moment, sans nouvelle proposition de créneau, alors que la '
        + 'révision du VTT est faite et validée depuis le début.',
      disputeResolvedBy: null,
      disputeResolvedAt: null,
      disputeResolution: null,
      disputeResolutionNote: null,
      acceptedAt: minutesAgo(5600),
      completedAt: null,
      closedAt: minutesAgo(2880),
      createdAt: minutesAgo(5650),
      updatedAt: minutesAgo(2880),
    },
  ];
}

/** Éléments des 2 deals (positions 0..n par deal). */
export function buildSeedDealItems(): DealItem[] {
  return [
    // Deal 1 — ce que KÉVIN (destinataire) fournit.
    {
      id: seedUuid('deal-item', 1),
      dealId: seedUuid('deal', 1),
      providerId: seedUuid('user', 11),
      kind: 'good',
      title: 'Panier péi complet (miel + lentilles + confiture)',
      description: 'Le panier de l’annonce, avec un pot de confiture goyavier en bonus.',
      value: 25,
      position: 0,
      createdAt: minutesAgo(110),
    },
    {
      id: seedUuid('deal-item', 2),
      dealId: seedUuid('deal', 1),
      providerId: seedUuid('user', 11),
      kind: 'service',
      title: 'Sortie guidée dans le cirque (demi-journée)',
      description: 'Sentier des Porteurs, départ marché de Cilaos.',
      value: 40,
      position: 1,
      createdAt: minutesAgo(110),
    },
    // Deal 1 — ce que VALÉRIE (proposeuse) fournit.
    {
      id: seedUuid('deal-item', 3),
      dealId: seedUuid('deal', 1),
      providerId: seedUuid('user', 4),
      kind: 'service',
      title: 'Mise à jour du site de guide de Kévin',
      description: 'Refonte de la page tarifs + galerie photos.',
      value: 60,
      position: 2,
      createdAt: minutesAgo(110),
    },
    // Deal 2 — ce que DAVID fournit.
    {
      id: seedUuid('deal-item', 4),
      dealId: seedUuid('deal', 2),
      providerId: seedUuid('user', 13),
      kind: 'service',
      title: 'Cours de soutien en maths (4 séances)',
      description: 'Pour les marmailles de Valérie, niveau collège.',
      value: 80,
      position: 0,
      createdAt: daysAgo(6),
    },
    {
      id: seedUuid('deal-item', 5),
      dealId: seedUuid('deal', 2),
      providerId: seedUuid('user', 13),
      kind: 'money',
      title: 'Complément en espèces',
      description: '',
      value: 170,
      position: 1,
      createdAt: daysAgo(6),
    },
    // Deal 2 — ce que VALÉRIE fournit.
    {
      id: seedUuid('deal-item', 6),
      dealId: seedUuid('deal', 2),
      providerId: seedUuid('user', 4),
      kind: 'good',
      title: 'Canapé d’angle convertible',
      description: 'Le canapé de l’annonce, livré à Saint-Denis.',
      value: 250,
      position: 2,
      createdAt: daysAgo(6),
    },
    // Deal 3 (litige) — ce que SULLY (destinataire) fournit.
    {
      id: seedUuid('deal-item', 7),
      dealId: seedUuid('deal', 3),
      providerId: seedUuid('user', 7),
      kind: 'service',
      title: 'Initiation surf — 2 séances à Saint-Leu',
      description: 'Matériel fourni, créneaux du week-end.',
      value: 60,
      position: 0,
      createdAt: minutesAgo(5650),
    },
    // Deal 3 — ce que DIDIER (proposeur) fournit.
    {
      id: seedUuid('deal-item', 8),
      dealId: seedUuid('deal', 3),
      providerId: seedUuid('user', 5),
      kind: 'service',
      title: 'Révision complète du VTT',
      description: 'Freins, transmission, roulements — atelier à domicile.',
      value: 50,
      position: 1,
      createdAt: minutesAgo(5650),
    },
  ];
}

/** Sous-éléments : deal 1 = états mélangés (démo badges), deal 2 = tout validé. */
export function buildSeedDealItemSteps(): DealItemStep[] {
  return [
    // Item 1 (panier péi) : 1er step honoré (pas validé), 2e en attente.
    {
      id: seedUuid('deal-step', 1),
      itemId: seedUuid('deal-item', 1),
      label: 'Panier préparé et mis de côté',
      position: 0,
      honoredAt: minutesAgo(40),
      validatedAt: null,
    },
    {
      id: seedUuid('deal-step', 2),
      itemId: seedUuid('deal-item', 1),
      label: 'Remise en main propre au marché',
      position: 1,
      honoredAt: null,
      validatedAt: null,
    },
    // Item 2 (sortie guidée) : rien d'entamé (« À fournir »).
    {
      id: seedUuid('deal-step', 3),
      itemId: seedUuid('deal-item', 2),
      label: 'Date convenue et sortie effectuée',
      position: 0,
      honoredAt: null,
      validatedAt: null,
    },
    // Item 3 (site web) : 1er step honoré ET validé, 2e honoré en attente.
    {
      id: seedUuid('deal-step', 4),
      itemId: seedUuid('deal-item', 3),
      label: 'Page tarifs refondue',
      position: 0,
      honoredAt: minutesAgo(90),
      validatedAt: minutesAgo(60),
    },
    {
      id: seedUuid('deal-step', 5),
      itemId: seedUuid('deal-item', 3),
      label: 'Galerie photos en ligne',
      position: 1,
      honoredAt: minutesAgo(35),
      validatedAt: null,
    },
    // Deal 2 : tous les steps honorés + validés (deal conclu).
    {
      id: seedUuid('deal-step', 6),
      itemId: seedUuid('deal-item', 4),
      label: '4 séances effectuées',
      position: 0,
      honoredAt: daysAgo(4),
      validatedAt: daysAgo(3),
    },
    {
      id: seedUuid('deal-step', 7),
      itemId: seedUuid('deal-item', 5),
      label: 'Complément remis',
      position: 0,
      honoredAt: daysAgo(4),
      validatedAt: daysAgo(3),
    },
    {
      id: seedUuid('deal-step', 8),
      itemId: seedUuid('deal-item', 6),
      label: 'Canapé livré et monté',
      position: 0,
      honoredAt: daysAgo(4),
      validatedAt: daysAgo(3),
    },
    // Deal 3 (litige) : séance 1 validée, séance 2 jamais honorée (le nœud
    // du litige) ; la part de Didier est honorée ET validée.
    {
      id: seedUuid('deal-step', 9),
      itemId: seedUuid('deal-item', 7),
      label: 'Séance 1 effectuée',
      position: 0,
      honoredAt: minutesAgo(4300),
      validatedAt: minutesAgo(4200),
    },
    {
      id: seedUuid('deal-step', 10),
      itemId: seedUuid('deal-item', 7),
      label: 'Séance 2 effectuée',
      position: 1,
      honoredAt: null,
      validatedAt: null,
    },
    {
      id: seedUuid('deal-step', 11),
      itemId: seedUuid('deal-item', 8),
      label: 'VTT révisé et restitué',
      position: 0,
      honoredAt: minutesAgo(5000),
      validatedAt: minutesAgo(4900),
    },
  ];
}

/** 1 ajustement PENDING sur le deal actif (démo de la décision à prendre). */
export function buildSeedDealAdjustments(): DealAdjustment[] {
  return [
    {
      id: seedUuid('deal-adjustment', 1),
      dealId: seedUuid('deal', 1),
      proposedBy: seedUuid('user', 11),
      kind: 'add',
      itemId: null,
      payload: {
        providerId: seedUuid('user', 11),
        kind: 'good',
        title: 'Pot de miel supplémentaire',
        description: 'Si le deal est conclu avant la fin du mois.',
        value: 8,
        steps: ['Pot ajouté au panier'],
      },
      description:
        'J’ajoute un pot de miel supplémentaire si on conclut avant la fin du mois.',
      status: 'pending',
      decidedAt: null,
      createdAt: minutesAgo(45),
    },
  ];
}

/** 1 note de suivi sur le deal actif (timeline « Suivi du deal »). */
export function buildSeedDealNotes(): DealNote[] {
  return [
    {
      id: seedUuid('deal-note', 1),
      dealId: seedUuid('deal', 1),
      authorId: seedUuid('user', 4),
      body:
        'La page tarifs est en ligne — dites-moi si la mise en page vous va '
        + 'avant que j’attaque la galerie.',
      createdAt: minutesAgo(85),
    },
  ];
}

/** Avis croisés du deal CONCLU (alimente les profils Dealplace). */
export function buildSeedDealReviews(): DealReview[] {
  return [
    {
      // Valérie évalue David.
      id: seedUuid('deal-review', 1),
      dealId: seedUuid('deal', 2),
      reviewerId: seedUuid('user', 4),
      revieweeId: seedUuid('user', 13),
      ratingHonesty: 5,
      ratingConformity: 5,
      ratingKindness: 4,
      comment:
        'Cours sérieux et réguliers, mes marmailles ont bien progressé. Je recommande !',
      createdAt: daysAgo(3),
    },
    {
      // David évalue Valérie.
      id: seedUuid('deal-review', 2),
      dealId: seedUuid('deal', 2),
      reviewerId: seedUuid('user', 13),
      revieweeId: seedUuid('user', 4),
      ratingHonesty: 5,
      ratingConformity: 4,
      ratingKindness: 5,
      comment: 'Canapé conforme aux photos, échange très sympa.',
      createdAt: daysAgo(3),
    },
  ];
}

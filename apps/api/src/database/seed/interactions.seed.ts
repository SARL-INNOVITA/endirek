/**
 * Seed interactions — commentaires, réactions, collections, signalements
 * et notifications de démonstration.
 *
 * Garanties de cohérence (vérifiées à la CONSTRUCTION, erreur claire sinon) :
 * - toute réponse (depth 1) pointe vers un commentaire depth 0 du MÊME post
 *   et lui est postérieure (option A stricte : jamais de niveau 2) ;
 * - une seule réaction par (utilisateur, cible) — unicité contrôlée par Set ;
 * - commentaires et réactions toujours POSTÉRIEURS à leur cible (les
 *   anciennetés des posts viennent de posts.seed.ts, jamais dupliquées) ;
 * - le signalement 'action_taken' cible le post 'hidden' du seed posts.
 */

import { Notification, Reaction, Report, SavedCollection, SavedPost } from '../domain/entities';
import { SeedComment } from './index';
import { POST_COUNT, postAgeMinutes, postAuthorN } from './posts.seed';
import { userSignupDaysAgo } from './users.seed';
import { daysAgo, minutesAgo, seedUuid } from './seed-utils';

// ────────────────────────────────────────────────────────────────────────────
// Commentaires — 60 au total : 45 de niveau 0 et 15 réponses de niveau 1.
// ────────────────────────────────────────────────────────────────────────────

/** Spécification déclarative d'un commentaire seed. */
interface CommentSpec {
  n: number;
  postN: number;
  authorN: number;
  /** Ancienneté en minutes — doit être < à celle du post (et du parent). */
  ageMinutes: number;
  body: string;
  /** Numéro du commentaire parent (depth 0 du même post) → réponse depth 1. */
  parentN?: number;
}

const COMMENT_SPECS: CommentSpec[] = [
  // P1 — pluie sur Salazie
  { n: 1, postN: 1, authorN: 6, ageMinutes: 25, body: 'Pareil sur Saint-Benoît, ça tombe sans arrêt.' },
  { n: 2, postN: 1, authorN: 4, ageMinutes: 22, body: 'Des photos des cascades si tu peux, ça doit être magnifique !' },
  { n: 3, postN: 1, authorN: 12, ageMinutes: 18, body: 'Mi mets ça en ligne tout à l’heure 😉', parentN: 2 },
  { n: 4, postN: 1, authorN: 2, ageMinutes: 15, body: 'Prudence sur la route de Hell-Bourg, merci pour l’info.' },
  // P4 — houle à Saint-Leu
  { n: 5, postN: 4, authorN: 4, ageMinutes: 80, body: 'Les vagues étaient énormes depuis la route, impressionnant !' },
  { n: 6, postN: 4, authorN: 10, ageMinutes: 70, body: 'Tu y retournes demain ? Les prévisions annoncent encore plus gros.' },
  { n: 7, postN: 4, authorN: 7, ageMinutes: 60, body: 'Oui si le vent reste faible, rendez-vous au spot 🤙', parentN: 6 },
  { n: 8, postN: 4, authorN: 14, ageMinutes: 40, body: 'Restez prudents quand même, la dernière fois il y a eu des blessés.' },
  // P8 — ciel menaçant sur le Sud
  { n: 9, postN: 8, authorN: 8, ageMinutes: 65, body: 'Ça a commencé à tomber sur Saint-Louis, rentre le linge !' },
  { n: 10, postN: 8, authorN: 3, ageMinutes: 55, body: 'Sur le Tampon on est déjà sous l’eau 😅' },
  // P10 — Route du Littoral basculée
  { n: 11, postN: 10, authorN: 13, ageMinutes: 4, body: 'Merci pour l’info, je pars plus tôt du travail du coup.' },
  { n: 12, postN: 10, authorN: 10, ageMinutes: 3, body: 'C’était déjà bien chargé au Port il y a dix minutes.' },
  { n: 13, postN: 10, authorN: 9, ageMinutes: 2, body: 'Bien vu, mi lé dedans là 😩 Courage à tout le monde.', parentN: 11 },
  // P11 — bouchon entrée ouest
  { n: 14, postN: 11, authorN: 9, ageMinutes: 20, body: 'Je confirme, 40 minutes entre le tunnel et le Barachois.' },
  { n: 15, postN: 11, authorN: 1, ageMinutes: 15, body: 'Pensez à la radio trafic pour suivre l’évolution en direct.' },
  { n: 16, postN: 11, authorN: 13, ageMinutes: 10, body: 'Finalement ça se débloque un peu côté Grande Chaloupe.', parentN: 14 },
  // P16 — bouchon au Ouaki
  { n: 17, postN: 16, authorN: 3, ageMinutes: 60, body: 'Comme chaque soir... vivement les travaux d’élargissement.' },
  { n: 18, postN: 16, authorN: 14, ageMinutes: 50, body: 'Mi passe par la côte, y roule mieux 😄' },
  { n: 19, postN: 16, authorN: 8, ageMinutes: 45, body: 'Bien vu, par la route des Avirons ça passe encore.', parentN: 18 },
  // P17 — grève des transporteurs
  { n: 20, postN: 17, authorN: 9, ageMinutes: 580, body: 'Merci pour l’info, télétravail pour moi demain.' },
  { n: 21, postN: 17, authorN: 3, ageMinutes: 560, body: 'Les bus seront déviés aussi ? Quelqu’un sait ?' },
  { n: 22, postN: 17, authorN: 1, ageMinutes: 540, body: 'On publiera la liste des barrages dès qu’elle sera confirmée.', parentN: 21 },
  { n: 23, postN: 17, authorN: 4, ageMinutes: 500, body: 'Covoiturage prévu avec les voisins, on s’organise !' },
  // P18 — radier submergé
  { n: 24, postN: 18, authorN: 5, ageMinutes: 30, body: 'Surtout pas de passage, l’eau monte vite avec ce temps !' },
  { n: 25, postN: 18, authorN: 2, ageMinutes: 25, body: 'Signalé aussi à la mairie, merci pour l’alerte.' },
  { n: 26, postN: 18, authorN: 6, ageMinutes: 20, body: 'L’eau commence à redescendre, mais restez prudents.' },
  // P19 — chute de pierres à Salazie
  { n: 27, postN: 19, authorN: 11, ageMinutes: 45, body: 'Pareil côté Cilaos la semaine dernière, prudence à tous.' },
  { n: 28, postN: 19, authorN: 2, ageMinutes: 40, body: 'Merci pour le signalement, c’est remonté aux services de la route.' },
  // P20 — baignade drapeau rouge
  { n: 29, postN: 20, authorN: 4, ageMinutes: 100, body: 'On a annulé la sortie snorkeling du coup, tant pis.' },
  { n: 30, postN: 20, authorN: 7, ageMinutes: 90, body: 'Bonne décision, la mer est vraiment mauvaise aujourd’hui.', parentN: 29 },
  // c31 : commentaire limite — cible du signalement 'open' sur commentaire.
  { n: 31, postN: 20, authorN: 15, ageMinutes: 80, body: 'Encore des gens qui se baignent n’importe où, faut vraiment être bête pour ignorer le drapeau...' },
  // P21 — accident RN3
  { n: 32, postN: 21, authorN: 8, ageMinutes: 380, body: 'Des nouvelles des blessés ? J’espère rien de grave 🙏' },
  { n: 33, postN: 21, authorN: 3, ageMinutes: 360, body: 'Plus de peur que de mal d’après les pompiers.', parentN: 32 },
  { n: 34, postN: 21, authorN: 2, ageMinutes: 340, body: 'La circulation est revenue à la normale, c’est dégagé.' },
  // P24 — marché forain de Saint-Pierre
  { n: 35, postN: 24, authorN: 2, ageMinutes: 650, body: 'Les ananas Victoria en ce moment, un régal 🍍' },
  { n: 36, postN: 24, authorN: 8, ageMinutes: 600, body: 'J’y serai à 7 h, avant la foule !' },
  // P26 — coupure d'eau au Tampon
  { n: 37, postN: 26, authorN: 3, ageMinutes: 330, body: 'Merci pour l’info, on remplit les bouteilles ce soir.' },
  { n: 38, postN: 26, authorN: 1, ageMinutes: 300, body: 'La mairie annonce un retour à la normale vers 16 h.' },
  // P30 — Voile de la Mariée
  { n: 39, postN: 30, authorN: 4, ageMinutes: 1800, body: 'Magnifique ! On y va dimanche avec les enfants.' },
  { n: 40, postN: 30, authorN: 13, ageMinutes: 1700, body: 'Les photos sont superbes, ça donne envie de monter à Salazie.' },
  { n: 41, postN: 30, authorN: 12, ageMinutes: 1600, body: 'Passez au gîte boire un café si vous montez 😉', parentN: 39 },
  // P31 — camion-bar au Port
  { n: 42, postN: 31, authorN: 9, ageMinutes: 2100, body: 'Testé hier midi, le sarcives lé bon même !' },
  { n: 43, postN: 31, authorN: 13, ageMinutes: 2000, body: 'Ils font des barquettes végétariennes aussi ?' },
  { n: 44, postN: 31, authorN: 10, ageMinutes: 1900, body: 'Oui, carri ti-jacques le vendredi 😋', parentN: 43 },
  // P35 — la route de Cilaos est-elle ouverte ?
  { n: 45, postN: 35, authorN: 11, ageMinutes: 55, body: 'Oui c’est rouvert, passage alterné au niveau de l’éboulis.' },
  { n: 46, postN: 35, authorN: 8, ageMinutes: 45, body: 'Super, merci ! On part à 7 h du coup.', parentN: 45 },
  { n: 47, postN: 35, authorN: 2, ageMinutes: 35, body: 'Prudence dans les lacets, la route reste humide.' },
  // P36 — covoiturage Saint-Pierre → Saint-Denis
  { n: 48, postN: 36, authorN: 8, ageMinutes: 450, body: 'Je fais le trajet le lundi, je t’envoie un message !' },
  { n: 49, postN: 36, authorN: 14, ageMinutes: 430, body: 'Génial, merci beaucoup 🙏', parentN: 48 },
  { n: 50, postN: 36, authorN: 3, ageMinutes: 400, body: 'Pensez aussi au car de 5 h 50, il est direct.' },
  // P38 — où voir les baleines ?
  { n: 51, postN: 38, authorN: 7, ageMinutes: 1300, body: 'Vues ce matin depuis les Colimaçons, deux souffles au large !' },
  { n: 52, postN: 38, authorN: 14, ageMinutes: 1250, body: 'Au Cap la Houssaye samedi, un saut énorme 🐋' },
  { n: 53, postN: 38, authorN: 4, ageMinutes: 1200, body: 'Merci ! On tente le Cap la Houssaye ce week-end alors.', parentN: 52 },
  { n: 54, postN: 38, authorN: 15, ageMinutes: 1100, body: 'Pensez à garder vos distances si vous sortez en bateau.' },
  // P39 — eau rétablie à Saint-André ?
  { n: 55, postN: 39, authorN: 6, ageMinutes: 230, body: 'Rétabli du côté de Bras des Chevrettes depuis une heure.' },
  { n: 56, postN: 39, authorN: 1, ageMinutes: 200, body: 'La mairie annonce un retour complet dans la soirée.' },
  { n: 57, postN: 39, authorN: 5, ageMinutes: 180, body: 'Merci, c’est revenu chez moi aussi 👍', parentN: 55 },
  // P42 — meilleurs bouchons gratinés
  { n: 58, postN: 42, authorN: 14, ageMinutes: 4200, body: 'Team rue du Maréchal Leclerc, sans hésiter 😄' },
  { n: 59, postN: 42, authorN: 9, ageMinutes: 4100, body: 'Le petit snack du Chaudron, valeur sûre depuis vingt ans.' },
  { n: 60, postN: 42, authorN: 13, ageMinutes: 4000, body: 'Faudra organiser un test à l’aveugle 😂', parentN: 58 },
];

function commentSpecByN(n: number): CommentSpec {
  const spec = COMMENT_SPECS.find((s) => s.n === n);
  if (!spec) {
    throw new Error(`Seed interactions : commentaire n°${n} inconnu.`);
  }
  return spec;
}

/** Les 60 commentaires de démonstration (45 niveau 0 + 15 réponses) —
 * reconstruits À CHAQUE appel : dates relatives (minutesAgo) recalculées,
 * objets neufs (aucun partage entre deux instanciations du seed). */
export function buildSeedComments(): SeedComment[] {
  return COMMENT_SPECS.map((spec) => {
    if (spec.ageMinutes >= postAgeMinutes(spec.postN)) {
      throw new Error(
        `Seed interactions : le commentaire n°${spec.n} serait antérieur à son post n°${spec.postN}.`,
      );
    }
    let parentCommentId: string | null = null;
    if (spec.parentN !== undefined) {
      const parent = commentSpecByN(spec.parentN);
      // Option A stricte : une réponse pointe UNIQUEMENT vers un commentaire
      // de niveau 0 (le parent ne doit donc pas être lui-même une réponse)
      // et du même post ; elle lui est forcément postérieure.
      if (parent.parentN !== undefined) {
        throw new Error(
          `Seed interactions : le commentaire n°${spec.n} répond à une réponse (n°${spec.parentN}) — interdit (option A).`,
        );
      }
      if (parent.postN !== spec.postN) {
        throw new Error(
          `Seed interactions : le commentaire n°${spec.n} répond à un commentaire d'un autre post.`,
        );
      }
      if (spec.ageMinutes >= parent.ageMinutes) {
        throw new Error(
          `Seed interactions : la réponse n°${spec.n} serait antérieure à son parent n°${spec.parentN}.`,
        );
      }
      parentCommentId = seedUuid('comment', spec.parentN);
    }
    const createdAt = minutesAgo(spec.ageMinutes);
    return {
      id: seedUuid('comment', spec.n),
      postId: seedUuid('post', spec.postN),
      authorId: seedUuid('user', spec.authorN),
      parentCommentId,
      depth: (spec.parentN === undefined ? 0 : 1) as 0 | 1,
      body: spec.body,
      status: 'active' as const,
      createdAt,
      updatedAt: createdAt,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Réactions — ~155, générées DÉTERMINISTIQUEMENT (mêmes données à chaque
// boot). Une réaction max par (utilisateur, cible), jamais sur son propre
// contenu, toujours postérieure à la cible.
// ────────────────────────────────────────────────────────────────────────────

const USER_COUNT = 15;

/** Palette pondérée (👍 et ❤️ plus fréquents), parmi les 6 emojis de
 * reaction_types — l'index est dérivé du numéro de cible (déterministe). */
const EMOJI_PATTERN = ['👍', '❤️', '😂', '👍', '😮', '❤️', '👍', '😢', '❤️', '😡', '👍', '😮'];

/** ~155 réactions de démonstration (125 sur posts + 30 sur commentaires) —
 * reconstruites à chaque appel (dates relatives recalculées, objets neufs). */
export function buildSeedReactions(): Reaction[] {
  const reactions: Reaction[] = [];
  const seen = new Set<string>();
  let reactionN = 1;

  const push = (
    userN: number,
    targetType: 'post' | 'comment',
    targetN: number,
    emoji: string,
    ageMinutes: number,
  ): void => {
    const userId = seedUuid('user', userN);
    const targetId =
      targetType === 'post' ? seedUuid('post', targetN) : seedUuid('comment', targetN);
    const key = `${userId}|${targetType}|${targetId}`;
    if (seen.has(key)) {
      throw new Error(
        `Seed interactions : réaction en doublon (user n°${userN} → ${targetType} n°${targetN}).`,
      );
    }
    seen.add(key);
    reactions.push({
      id: seedUuid('reaction', reactionN++),
      userId,
      targetType,
      targetId,
      emoji,
      createdAt: minutesAgo(ageMinutes),
    });
  };

  // 1 à 5 réactions par post (125 au total), utilisateurs et emojis dérivés
  // du numéro de post — les pas (k*3 modulo 15) garantissent des utilisateurs
  // distincts pour un même post.
  for (let n = 1; n <= POST_COUNT; n++) {
    const authorN = postAuthorN(n);
    const postAge = postAgeMinutes(n);
    const count = (n % 5) + 1;
    for (let k = 0; k < count; k++) {
      let userN = ((n * 7 + k * 3) % USER_COUNT) + 1;
      if (userN === authorN) {
        // Décalage de +1 : jamais de réaction sur son propre post, sans
        // collision possible avec les autres pas (multiples de 3).
        userN = ((n * 7 + k * 3 + 1) % USER_COUNT) + 1;
      }
      push(
        userN,
        'post',
        n,
        EMOJI_PATTERN[(n + k * 5) % EMOJI_PATTERN.length],
        Math.max(1, postAge - 2 - k * 7),
      );
    }
  }

  // Une réaction sur un commentaire sur deux (30 au total).
  for (const spec of COMMENT_SPECS) {
    if (spec.n % 2 !== 0) {
      continue;
    }
    let userN = ((spec.n * 11) % USER_COUNT) + 1;
    if (userN === spec.authorN) {
      userN = ((spec.n * 11 + 1) % USER_COUNT) + 1;
    }
    push(
      userN,
      'comment',
      spec.n,
      EMOJI_PATTERN[(spec.n * 3) % EMOJI_PATTERN.length],
      Math.max(1, spec.ageMinutes - 1),
    );
  }

  return reactions;
}

// ────────────────────────────────────────────────────────────────────────────
// Collections enregistrées — une collection « Général » (par défaut) par
// utilisateur, créée à l'inscription, + une dizaine de posts sauvegardés.
// ────────────────────────────────────────────────────────────────────────────

/** 15 collections « Général » (une par utilisateur, comme à l'inscription) —
 * reconstruites à chaque appel (dates relatives recalculées, objets neufs). */
export function buildSeedSavedCollections(): SavedCollection[] {
  const collections: SavedCollection[] = [];
  for (let n = 1; n <= USER_COUNT; n++) {
    collections.push({
      id: seedUuid('collection', n),
      ownerId: seedUuid('user', n),
      name: 'Général',
      isDefault: true,
      createdAt: daysAgo(userSignupDaysAgo(n)),
    });
  }
  return collections;
}

/** Sauvegardes : (n° utilisateur → n° post), toujours postérieures au post. */
const SAVED_POST_SPECS: Array<[userN: number, postN: number, ageMinutes: number]> = [
  [4, 30, 1700], // Valérie garde la cascade pour la sortie de dimanche
  [9, 17, 550], // Thierry garde l'annonce de grève
  [13, 42, 4000], // David garde le débat bouchons gratinés
  [8, 36, 400], // Nadia garde la demande de covoiturage
  [3, 26, 300], // Jean-Yves garde l'avis de coupure d'eau
  [2, 18, 20], // Marie garde l'alerte radier
  [14, 24, 600], // Chloé garde l'annonce du marché forain
  [7, 20, 80], // Sully garde l'alerte baignade
  [11, 35, 50], // Kévin garde la question sur la RN5
  [15, 38, 1000], // Marcel garde la question baleines
];

/** 10 posts sauvegardés dans les collections « Général » — reconstruits à
 * chaque appel (dates relatives recalculées, objets neufs). */
export function buildSeedSavedPosts(): SavedPost[] {
  const seen = new Set<string>();
  return SAVED_POST_SPECS.map(([userN, postN, ageMinutes]) => {
    const key = `${userN}|${postN}`;
    if (seen.has(key)) {
      throw new Error(`Seed interactions : sauvegarde en doublon (${key}).`);
    }
    seen.add(key);
    if (ageMinutes >= postAgeMinutes(postN)) {
      throw new Error(
        `Seed interactions : la sauvegarde du post n°${postN} lui serait antérieure.`,
      );
    }
    return {
      collectionId: seedUuid('collection', userN),
      postId: seedUuid('post', postN),
      createdAt: minutesAgo(ageMinutes),
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Signalements — 3 ouverts (1 post, 1 commentaire, 1 annonce — CP2.5, D65),
// 1 traité (le post masqué du seed posts), 1 rejeté. handled_by = la
// modératrice (utilisateur n°2).
// ────────────────────────────────────────────────────────────────────────────

/** 5 signalements de démonstration (3 open, 1 action_taken, 1 dismissed) —
 * reconstruits à chaque appel (dates relatives recalculées, objets neufs). */
export function buildSeedReports(): Report[] {
  return [
    // Ouvert, sur un post : rumeur de grève contestée (en attente de revue).
    {
      id: seedUuid('report', 1),
      reporterId: seedUuid('user', 5),
      targetType: 'post',
      targetId: seedUuid('post', 17),
      reasonCode: 'false_info',
      message:
        'Je n’ai vu aucune annonce officielle de cette grève, ça ressemble à une rumeur.',
      status: 'open',
      handledBy: null,
      handledAt: null,
      resolutionNote: null,
      createdAt: minutesAgo(500),
    },
    // Ouvert, sur un commentaire : le commentaire méprisant n°31.
    {
      id: seedUuid('report', 2),
      reporterId: seedUuid('user', 4),
      targetType: 'comment',
      targetId: seedUuid('comment', 31),
      reasonCode: 'hateful',
      message: 'Commentaire méprisant envers les baigneurs.',
      status: 'open',
      handledBy: null,
      handledAt: null,
      resolutionNote: null,
      createdAt: minutesAgo(70),
    },
    // Traité : correspond au post n°34 (status 'hidden' dans posts.seed.ts).
    {
      id: seedUuid('report', 3),
      reporterId: seedUuid('user', 13),
      targetType: 'post',
      targetId: seedUuid('post', 34),
      reasonCode: 'spam',
      message: 'Arnaque évidente, lien frauduleux proposé en message privé.',
      status: 'action_taken',
      handledBy: seedUuid('user', 2),
      handledAt: minutesAgo(700),
      resolutionNote:
        'Publication masquée : lien frauduleux confirmé. Auteur averti par message.',
      createdAt: minutesAgo(760),
    },
    // Rejeté : simple désaccord météo sur le post n°6, aucune infraction.
    {
      id: seedUuid('report', 4),
      reporterId: seedUuid('user', 7),
      targetType: 'post',
      targetId: seedUuid('post', 6),
      reasonCode: 'false_info',
      message: 'Il pleuvait à Saint-Denis à cette heure-là, info douteuse.',
      status: 'dismissed',
      handledBy: seedUuid('user', 2),
      handledAt: minutesAgo(150),
      resolutionNote: 'Simple désaccord météo, aucune infraction aux règles.',
      createdAt: minutesAgo(220),
    },
    // Ouvert, sur une ANNONCE (CP2.5 — D65) : le scooter de Thierry (n°8),
    // signalé par Valérie — la file « Annonces » du backoffice a un cas.
    {
      id: seedUuid('report', 5),
      reporterId: seedUuid('user', 4),
      targetType: 'listing',
      targetId: seedUuid('listing', 8),
      reasonCode: 'other',
      message:
        'Le prix est anormalement bas et le vendeur refuse toute rencontre '
        + 'en personne — possible arnaque.',
      status: 'open',
      handledBy: null,
      handledAt: null,
      resolutionNote: null,
      createdAt: minutesAgo(95),
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Notifications — 12 pour 5 destinataires, chacune cohérente avec une donnée
// réelle du seed (commentaire, réponse, réaction générée, signalement...).
// Les payloads référencent les ids par seedUuid, jamais des ids inventés.
// ────────────────────────────────────────────────────────────────────────────

/** 12 notifications de démonstration (5 destinataires, 5 types couverts) —
 * reconstruites à chaque appel (dates relatives recalculées, objets neufs). */
export function buildSeedNotifications(): Notification[] {
  return [
    // ── Florence (n°12), autrice des posts Salazie ──
    {
      // Marie (n°2) a commenté « Gros la pluie sur Salazie » (commentaire n°4).
      id: seedUuid('notif', 1),
      userId: seedUuid('user', 12),
      type: 'comment',
      payload: {
        postId: seedUuid('post', 1),
        commentId: seedUuid('comment', 4),
        actorId: seedUuid('user', 2),
        excerpt: 'Prudence sur la route de Hell-Bourg, merci pour l’info.',
      },
      readAt: null,
      createdAt: minutesAgo(15),
    },
    {
      // Réaction générée : l'Équipe (n°1) a réagi 👍 au post n°30 (Voile de la Mariée).
      id: seedUuid('notif', 2),
      userId: seedUuid('user', 12),
      type: 'reaction',
      payload: {
        postId: seedUuid('post', 30),
        actorId: seedUuid('user', 1),
        emoji: '👍',
      },
      readAt: minutesAgo(1500),
      createdAt: minutesAgo(1898),
    },
    // ── David (n°13), auteur des posts Saint-Denis ──
    {
      // Thierry (n°9) a commenté le bouchon entrée ouest (commentaire n°14).
      id: seedUuid('notif', 3),
      userId: seedUuid('user', 13),
      type: 'comment',
      payload: {
        postId: seedUuid('post', 11),
        commentId: seedUuid('comment', 14),
        actorId: seedUuid('user', 9),
        excerpt: 'Je confirme, 40 minutes entre le tunnel et le Barachois.',
      },
      readAt: null,
      createdAt: minutesAgo(20),
    },
    {
      // Thierry (n°9) a répondu (n°13) au commentaire n°11 de David sur le post n°10.
      id: seedUuid('notif', 4),
      userId: seedUuid('user', 13),
      type: 'reply',
      payload: {
        postId: seedUuid('post', 10),
        commentId: seedUuid('comment', 13),
        parentCommentId: seedUuid('comment', 11),
        actorId: seedUuid('user', 9),
      },
      readAt: null,
      createdAt: minutesAgo(2),
    },
    {
      // Réaction générée : Laurence (n°10) a réagi 👍 au post n°42 (bouchons gratinés).
      id: seedUuid('notif', 5),
      userId: seedUuid('user', 13),
      type: 'reaction',
      payload: {
        postId: seedUuid('post', 42),
        actorId: seedUuid('user', 10),
        emoji: '👍',
      },
      readAt: minutesAgo(4000),
      createdAt: minutesAgo(4318),
    },
    {
      // Son signalement du post frauduleux (n°34) a été traité par la modération.
      id: seedUuid('notif', 6),
      userId: seedUuid('user', 13),
      type: 'report_handled',
      payload: {
        reportId: seedUuid('report', 3),
        targetType: 'post',
        targetId: seedUuid('post', 34),
        status: 'action_taken',
      },
      readAt: minutesAgo(650),
      createdAt: minutesAgo(700),
    },
    // ── Chloé (n°14), autrice du covoiturage et du marché forain ──
    {
      // Nadia (n°8) a commenté la demande de covoiturage (commentaire n°48).
      id: seedUuid('notif', 7),
      userId: seedUuid('user', 14),
      type: 'comment',
      payload: {
        postId: seedUuid('post', 36),
        commentId: seedUuid('comment', 48),
        actorId: seedUuid('user', 8),
        excerpt: 'Je fais le trajet le lundi, je t’envoie un message !',
      },
      readAt: minutesAgo(420),
      createdAt: minutesAgo(450),
    },
    {
      // David (n°13) a répondu (n°60) à son commentaire n°58 sur le post n°42.
      id: seedUuid('notif', 8),
      userId: seedUuid('user', 14),
      type: 'reply',
      payload: {
        postId: seedUuid('post', 42),
        commentId: seedUuid('comment', 60),
        parentCommentId: seedUuid('comment', 58),
        actorId: seedUuid('user', 13),
      },
      readAt: minutesAgo(3900),
      createdAt: minutesAgo(4000),
    },
    {
      // Marie (n°2) a commenté le marché forain (commentaire n°35).
      id: seedUuid('notif', 9),
      userId: seedUuid('user', 14),
      type: 'comment',
      payload: {
        postId: seedUuid('post', 24),
        commentId: seedUuid('comment', 35),
        actorId: seedUuid('user', 2),
        excerpt: 'Les ananas Victoria en ce moment, un régal 🍍',
      },
      readAt: minutesAgo(600),
      createdAt: minutesAgo(650),
    },
    // ── Sully (n°7), auteur du post houle ──
    {
      // Valérie (n°4) a commenté la houle à Saint-Leu (commentaire n°5).
      id: seedUuid('notif', 10),
      userId: seedUuid('user', 7),
      type: 'comment',
      payload: {
        postId: seedUuid('post', 4),
        commentId: seedUuid('comment', 5),
        actorId: seedUuid('user', 4),
        excerpt: 'Les vagues étaient énormes depuis la route, impressionnant !',
      },
      readAt: null,
      createdAt: minutesAgo(80),
    },
    {
      // Réaction générée : Chloé (n°14) a réagi 😮 au post n°4 (houle).
      id: seedUuid('notif', 11),
      userId: seedUuid('user', 7),
      type: 'reaction',
      payload: {
        postId: seedUuid('post', 4),
        actorId: seedUuid('user', 14),
        emoji: '😮',
      },
      readAt: minutesAgo(60),
      createdAt: minutesAgo(88),
    },
    // ── Marcel (n°15), auteur du post masqué ──
    {
      // Message système : sa publication a été masquée par la modération.
      id: seedUuid('notif', 12),
      userId: seedUuid('user', 15),
      type: 'system',
      payload: {
        postId: seedUuid('post', 34),
        message:
          'Votre publication « Gagnez de l’argent facilement 💰 » a été masquée par la modération : contenu frauduleux signalé et confirmé.',
      },
      readAt: null,
      createdAt: minutesAgo(695),
    },
  ];
}

/**
 * Seed de démonstration La Réunion — DONNÉES DÉCLARATIVES UNIQUEMENT.
 *
 * Principe : le seed décrit les entités (qui suit qui, quels posts, quelles
 * réactions...) mais JAMAIS les compteurs dénormalisés (followersCount,
 * reactionCount, commentCount, saveCount...). C'est MockDatabaseService qui
 * les RECALCULE après chargement — source unique de cohérence : impossible
 * d'avoir un compteur seed désynchronisé de ses données.
 *
 * Les types Seed* retirent donc ces compteurs des entités du domaine.
 * Utiliser les helpers de `seed-utils.ts` (seedUuid, minutesAgo, pointNear)
 * et le référentiel `communes.ts` pour des données réalistes et reproductibles.
 */

import {
  Camera,
  Comment,
  Follow,
  Notification,
  Post,
  PostMedia,
  Reaction,
  Report,
  SavedCollection,
  SavedPost,
  User,
} from '../domain/entities';

// ────────────────────────────────────────────────────────────────────────────
// Types déclaratifs (entités sans leurs compteurs dénormalisés)
// ────────────────────────────────────────────────────────────────────────────

/** Utilisateur seed — followersCount/followingCount recalculés depuis `follows`. */
export type SeedUser = Omit<User, 'followersCount' | 'followingCount'>;

/** Post seed — reactionCount/commentCount/saveCount recalculés ; shareCount
 * optionnel (pas de table source au Lot 1, défaut 0). */
export type SeedPost = Omit<
  Post,
  'reactionCount' | 'commentCount' | 'shareCount' | 'saveCount'
> & { shareCount?: number };

/** Commentaire seed — reactionCount recalculé depuis `reactions`. */
export type SeedComment = Omit<Comment, 'reactionCount'>;

/** Jeu de données complet chargé par MockDatabaseService au démarrage.
 * NB : post_types et reaction_types (tables de référence) ne passent PAS par
 * le seed — le mock embarque les mêmes lignes que la migration SQL 0002. */
export interface SeedData {
  users: SeedUser[];
  follows: Follow[];
  posts: SeedPost[];
  postMedia: PostMedia[];
  comments: SeedComment[];
  reactions: Reaction[];
  savedCollections: SavedCollection[];
  savedPosts: SavedPost[];
  cameras: Camera[];
  reports: Report[];
  notifications: Notification[];
}

// ────────────────────────────────────────────────────────────────────────────
// Construction du seed
// ────────────────────────────────────────────────────────────────────────────

import { buildSeedCameras } from './cameras.seed';
import {
  buildSeedComments,
  buildSeedNotifications,
  buildSeedReactions,
  buildSeedReports,
  buildSeedSavedCollections,
  buildSeedSavedPosts,
} from './interactions.seed';
import { buildSeedPostMedia, buildSeedPosts } from './posts.seed';
import { buildSeedFollows, buildSeedUsers } from './users.seed';

/**
 * Construit le jeu de données de démonstration La Réunion.
 *
 * CHAQUE appel réexécute les constructeurs buildSeedX() des fichiers seed :
 * les dates relatives (minutesAgo, daysAgo) sont recalculées à ce moment-là
 * et les objets produits sont NEUFS — deux instanciations dans un même
 * process ne partagent ni timestamps périmés ni objets imbriqués. Les ids
 * restent identiques d'un appel à l'autre (seedUuid est déterministe), donc
 * les références croisées entre fichiers seed restent cohérentes.
 *
 * Appelé au démarrage uniquement si `database.mockSeed` est vrai
 * (DB_MOCK_SEED=true).
 *
 * Contenu : 15 utilisateurs réunionnais fictifs + ~30 follows (users.seed),
 * 42 posts sur les 12 communes + 12 médias (posts.seed), 60 commentaires,
 * ~155 réactions, collections + sauvegardes, 4 signalements et
 * 12 notifications (interactions.seed), 12 caméras météo/trafic
 * (cameras.seed). Toutes les références croisées passent par seedUuid —
 * chaque fichier vérifie sa propre cohérence à la construction.
 */
export function buildSeed(): SeedData {
  return {
    users: buildSeedUsers(),
    follows: buildSeedFollows(),
    posts: buildSeedPosts(),
    postMedia: buildSeedPostMedia(),
    comments: buildSeedComments(),
    reactions: buildSeedReactions(),
    savedCollections: buildSeedSavedCollections(),
    savedPosts: buildSeedSavedPosts(),
    cameras: buildSeedCameras(),
    reports: buildSeedReports(),
    notifications: buildSeedNotifications(),
  };
}

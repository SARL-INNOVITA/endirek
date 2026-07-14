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
  Conversation,
  Deal,
  DealAdjustment,
  DealItem,
  DealItemStep,
  DealNote,
  DealReview,
  Dish,
  Follow,
  Listing,
  ListingMedia,
  Message,
  Notification,
  Page,
  PageDocument,
  PageEvent,
  PageFollow,
  PageHour,
  PageMenu,
  PageMenuItem,
  PageOffer,
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

/** Association annonce <-> tag du seed Dealplace (miroir de listing_tag_map). */
export interface SeedListingTagMap {
  listingId: string;
  tagSlug: string;
}

/** Jeu de données complet chargé par MockDatabaseService au démarrage.
 * NB : les tables de référence (post_types, reaction_types, ainsi que la
 * taxonomie Dealplace listing_categories/subcategories/tags) ne passent PAS
 * par le seed — le mock embarque les mêmes lignes que les migrations SQL
 * (0002 pour le Lot 1, 0004 pour le Dealplace). */
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
  // Dealplace (Lot 2 — CP2.1).
  listings: Listing[];
  listingMedia: ListingMedia[];
  listingTagMap: SeedListingTagMap[];
  // Conversations 1-to-1 (Lot 2 — CP2.3).
  conversations: Conversation[];
  messages: Message[];
  // Deals contractuels + avis (Lot 2 — CP2.4).
  deals: Deal[];
  dealItems: DealItem[];
  dealItemSteps: DealItemStep[];
  dealAdjustments: DealAdjustment[];
  dealNotes: DealNote[];
  dealReviews: DealReview[];
  // Pages restaurants & entreprises (Lot 3).
  pages: Page[];
  pageHours: PageHour[];
  pageDocuments: PageDocument[];
  dishes: Dish[];
  pageMenus: PageMenu[];
  pageMenuItems: PageMenuItem[];
  pageOffers: PageOffer[];
  pageEvents: PageEvent[];
  pageFollows: PageFollow[];
}

// ────────────────────────────────────────────────────────────────────────────
// Construction du seed
// ────────────────────────────────────────────────────────────────────────────

import { buildSeedCameras } from './cameras.seed';
import {
  buildSeedConversations,
  buildSeedMessages,
} from './conversations.seed';
import {
  buildSeedDealAdjustments,
  buildSeedDealItems,
  buildSeedDealItemSteps,
  buildSeedDealNotes,
  buildSeedDealReviews,
  buildSeedDeals,
} from './deals.seed';
import {
  buildSeedComments,
  buildSeedNotifications,
  buildSeedReactions,
  buildSeedReports,
  buildSeedSavedCollections,
  buildSeedSavedPosts,
} from './interactions.seed';
import {
  buildSeedListingMedia,
  buildSeedListings,
  buildSeedListingTagMap,
} from './listings.seed';
import {
  buildSeedDishes,
  buildSeedPageDocuments,
  buildSeedPageEvents,
  buildSeedPageFollows,
  buildSeedPageHours,
  buildSeedPageMenuItems,
  buildSeedPageMenus,
  buildSeedPageOffers,
  buildSeedPagePostMedia,
  buildSeedPagePosts,
  buildSeedPages,
} from './pages.seed';
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
 * 42 posts utilisateur sur les 12 communes + 4 posts DE PAGE + 14 médias
 * (posts.seed + pages.seed), 60 commentaires, ~155 réactions, collections +
 * sauvegardes, 6 signalements (dont 1 sur une annonce — CP2.5 — et 1 sur
 * une page — Lot 3) et 12 notifications (interactions.seed), 12 caméras
 * météo/trafic (cameras.seed), 8 annonces Dealplace + médias + tags
 * (listings.seed), 4 conversations + 11 messages dont 1 masqué et 1 fil de
 * page (conversations.seed), 3 deals (1 actif, 1 conclu avec avis croisés,
 * 1 en litige non arbitré — deals.seed), 2 pages professionnelles
 * (1 restaurant vérifié complet + 1 entreprise) avec horaires, plats, menus
 * de la semaine glissante, cartes PDF, offres, événements et abonnés
 * (pages.seed).
 * Toutes les références croisées passent par seedUuid — chaque fichier
 * vérifie sa propre cohérence à la construction.
 */
export function buildSeed(): SeedData {
  return {
    users: buildSeedUsers(),
    follows: buildSeedFollows(),
    // Posts utilisateur (n°1-42) + posts de page (n°43-46 — Lot 3, D73).
    posts: [...buildSeedPosts(), ...buildSeedPagePosts()],
    postMedia: [...buildSeedPostMedia(), ...buildSeedPagePostMedia()],
    comments: buildSeedComments(),
    reactions: buildSeedReactions(),
    savedCollections: buildSeedSavedCollections(),
    savedPosts: buildSeedSavedPosts(),
    cameras: buildSeedCameras(),
    reports: buildSeedReports(),
    notifications: buildSeedNotifications(),
    listings: buildSeedListings(),
    listingMedia: buildSeedListingMedia(),
    listingTagMap: buildSeedListingTagMap(),
    conversations: buildSeedConversations(),
    messages: buildSeedMessages(),
    deals: buildSeedDeals(),
    dealItems: buildSeedDealItems(),
    dealItemSteps: buildSeedDealItemSteps(),
    dealAdjustments: buildSeedDealAdjustments(),
    dealNotes: buildSeedDealNotes(),
    dealReviews: buildSeedDealReviews(),
    pages: buildSeedPages(),
    pageHours: buildSeedPageHours(),
    pageDocuments: buildSeedPageDocuments(),
    dishes: buildSeedDishes(),
    pageMenus: buildSeedPageMenus(),
    pageMenuItems: buildSeedPageMenuItems(),
    pageOffers: buildSeedPageOffers(),
    pageEvents: buildSeedPageEvents(),
    pageFollows: buildSeedPageFollows(),
  };
}

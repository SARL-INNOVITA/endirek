/**
 * MockDatabaseService — « base de données » en mémoire du driver mock.
 *
 * Rôles :
 * - héberger les stores (une Map ou un tableau par table du schéma SQL) ;
 * - embarquer les données de référence (post_types, reaction_types), miroir
 *   exact de la migration db/migrations/0002_reference_data.sql ;
 * - charger le seed de démonstration au démarrage si `database.mockSeed` ;
 * - RECALCULER les compteurs dénormalisés depuis les données (source unique
 *   de cohérence — le seed ne déclare jamais un compteur) ;
 * - tenir `updatedAt` à jour en code (équivalent du trigger set_updated_at()).
 *
 * Les repositories mock (mock-repositories.ts) travaillent au-dessus de ces
 * stores ; aucun autre code ne doit toucher aux Map directement.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseConfig } from '../../config/configuration';
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
  ListingCategory,
  ListingMedia,
  ListingSubcategory,
  ListingTag,
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
  PostType,
  Reaction,
  ReactionType,
  Report,
  SavedCollection,
  SavedPost,
  User,
} from '../domain/entities';
import { buildSeed, SeedData, SeedListingTagMap } from '../seed';
import {
  LISTING_CATEGORY_ROWS,
  LISTING_SUBCATEGORY_ROWS,
  LISTING_TAG_ROWS,
} from './dealplace-reference';

// ────────────────────────────────────────────────────────────────────────────
// Données de référence — MIROIR EXACT de db/migrations/0002_reference_data.sql.
// Pilotables ensuite depuis le backoffice (PostTypesRepository.update) ;
// icônes et couleurs provisoires.
// ────────────────────────────────────────────────────────────────────────────

type PostTypeRow = Omit<PostType, 'createdAt' | 'updatedAt'>;

const POST_TYPE_ROWS: PostTypeRow[] = [
  {
    slug: 'free',
    labelFr: 'Publication libre',
    icon: 'pencil',
    color: '#1173D4',
    requiresLocationForMap: false,
    showsOnMap: false,
    defaultMapDurationMinutes: null,
    pageOnly: false,
    isActive: true,
    position: 1,
  },
  {
    slug: 'weather',
    labelFr: 'Point météo',
    icon: 'cloud',
    color: '#3B82F6',
    requiresLocationForMap: true,
    showsOnMap: true,
    defaultMapDurationMinutes: 120,
    pageOnly: false,
    isActive: true,
    position: 2,
  },
  {
    slug: 'traffic',
    labelFr: 'Point trafic',
    icon: 'car',
    color: '#F97316',
    requiresLocationForMap: true,
    showsOnMap: true,
    defaultMapDurationMinutes: 120,
    pageOnly: false,
    isActive: true,
    position: 3,
  },
  {
    slug: 'danger',
    labelFr: 'Accident / danger',
    icon: 'warning',
    color: '#EF4444',
    requiresLocationForMap: true,
    showsOnMap: true,
    defaultMapDurationMinutes: 120,
    pageOnly: false,
    isActive: true,
    position: 4,
  },
  {
    slug: 'question',
    labelFr: 'Question / aide',
    icon: 'help',
    color: '#8B5CF6',
    requiresLocationForMap: false,
    showsOnMap: false,
    defaultMapDurationMinutes: null,
    pageOnly: false,
    isActive: true,
    position: 5,
  },
  // Types RÉSERVÉS AUX PAGES (Lot 3 — D73, miroir de 0009_pages.sql) :
  // la durée carte est calculée au SERVICE (23 h Réunion / fin d'événement),
  // d'où defaultMapDurationMinutes null malgré showsOnMap true.
  {
    slug: 'menu',
    labelFr: 'Menu du jour',
    icon: 'restaurant',
    color: '#0EA5A4',
    requiresLocationForMap: false,
    showsOnMap: true,
    defaultMapDurationMinutes: null,
    pageOnly: true,
    isActive: true,
    position: 6,
  },
  {
    slug: 'offer',
    labelFr: 'Offre du jour',
    icon: 'tag',
    color: '#D97706',
    requiresLocationForMap: false,
    showsOnMap: true,
    defaultMapDurationMinutes: null,
    pageOnly: true,
    isActive: true,
    position: 7,
  },
  {
    slug: 'event',
    labelFr: 'Événement',
    icon: 'calendar',
    color: '#DB2777',
    requiresLocationForMap: false,
    showsOnMap: true,
    defaultMapDurationMinutes: null,
    pageOnly: true,
    isActive: true,
    position: 8,
  },
];

const REACTION_TYPE_ROWS: ReactionType[] = [
  { emoji: '👍', labelFr: "J'aime", position: 1, isActive: true },
  { emoji: '❤️', labelFr: "J'adore", position: 2, isActive: true },
  { emoji: '😂', labelFr: 'Haha', position: 3, isActive: true },
  { emoji: '😮', labelFr: 'Wouah', position: 4, isActive: true },
  { emoji: '😢', labelFr: 'Triste', position: 5, isActive: true },
  { emoji: '😡', labelFr: 'Grr', position: 6, isActive: true },
];

@Injectable()
export class MockDatabaseService implements OnModuleInit {
  private readonly logger = new Logger('MockDatabase');

  // ── Stores en mémoire (une structure par table du schéma) ────────────────
  readonly users = new Map<string, User>();
  readonly follows: Follow[] = [];
  readonly postTypes = new Map<string, PostType>();
  readonly reactionTypes = new Map<string, ReactionType>();
  readonly posts = new Map<string, Post>();
  readonly postMedia = new Map<string, PostMedia>();
  readonly comments = new Map<string, Comment>();
  readonly reactions = new Map<string, Reaction>();
  readonly savedCollections = new Map<string, SavedCollection>();
  readonly savedPosts: SavedPost[] = [];
  readonly cameras = new Map<string, Camera>();
  readonly reports = new Map<string, Report>();
  readonly notifications = new Map<string, Notification>();

  // ── Dealplace (Lot 2 — CP2.1) ────────────────────────────────────────────
  readonly listingCategories = new Map<string, ListingCategory>();
  readonly listingSubcategories = new Map<string, ListingSubcategory>();
  readonly listingTags = new Map<string, ListingTag>();
  readonly listings = new Map<string, Listing>();
  readonly listingMedia = new Map<string, ListingMedia>();
  // Conversations 1-to-1 (Lot 2 — CP2.3).
  readonly conversations = new Map<string, Conversation>();
  readonly messages = new Map<string, Message>();
  // Deals contractuels + avis (Lot 2 — CP2.4).
  readonly deals = new Map<string, Deal>();
  readonly dealItems = new Map<string, DealItem>();
  readonly dealItemSteps = new Map<string, DealItemStep>();
  readonly dealAdjustments = new Map<string, DealAdjustment>();
  readonly dealNotes = new Map<string, DealNote>();
  readonly dealReviews = new Map<string, DealReview>();
  /** Association N-N annonce <-> tag (miroir de listing_tag_map). */
  readonly listingTagMap: SeedListingTagMap[] = [];

  // ── Pages restaurants & entreprises (Lot 3) ──────────────────────────────
  readonly pages = new Map<string, Page>();
  readonly pageHours = new Map<string, PageHour>();
  readonly pageDocuments = new Map<string, PageDocument>();
  readonly dishes = new Map<string, Dish>();
  readonly pageMenus = new Map<string, PageMenu>();
  readonly pageMenuItems = new Map<string, PageMenuItem>();
  readonly pageOffers = new Map<string, PageOffer>();
  readonly pageEvents = new Map<string, PageEvent>();
  /** Abonnements aux pages (PK composite — miroir de page_follows). */
  readonly pageFollows: PageFollow[] = [];

  /** Séquence en mémoire — équivalent de `camera_number ... AS IDENTITY`. */
  private cameraNumberSequence = 1;

  /** Séquence en mémoire — équivalent de `deals_deal_number_seq` (CP2.4). */
  private dealNumberSequence = 1;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.loadReferenceData();

    const database = this.configService.get<DatabaseConfig>('database');
    if (database?.mockSeed) {
      this.loadSeed(buildSeed());
    }

    this.recomputeAllCounters();
    this.syncCameraSequence();
    this.syncDealNumberSequence();
    this.logBootSummary();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers partagés avec les repositories mock
  // ──────────────────────────────────────────────────────────────────────────

  /** Équivalent code du trigger SQL set_updated_at(). */
  touch(row: { updatedAt: Date }): void {
    row.updatedAt = new Date();
  }

  /** Prochain numéro de caméra (auto-incrément, affiché « #23 »). */
  nextCameraNumber(): number {
    return this.cameraNumberSequence++;
  }

  /** Prochain numéro de deal (auto-incrément, affiché « Deal 345 »). */
  nextDealNumber(): number {
    return this.dealNumberSequence++;
  }

  /**
   * Recalcule followersCount/followingCount d'un utilisateur depuis `follows`.
   *
   * Modèle de cohérence (miroir des listes GET /users/:id/followers|following,
   * qui ne servent que les comptes ACTIFS) :
   * - followersCount = nombre de comptes ACTIFS qui suivent `userId` ;
   * - followingCount = nombre de comptes ACTIFS que `userId` suit.
   * Les compteurs dénormalisés valent donc TOUJOURS la longueur des listes
   * publiques : aucun compte 'deleted'/'suspended' n'est sur-compté. On ne
   * touche jamais aux lignes de `follows` (trace conservée pour l'export RGPD
   * et l'audit), seulement à ces compteurs.
   */
  recomputeUserFollowCounts(userId: string): void {
    const user = this.users.get(userId);
    if (!user) {
      return;
    }
    user.followersCount = this.follows.filter(
      (f) => f.followedId === userId && this.isActiveUser(f.followerId),
    ).length;
    user.followingCount = this.follows.filter(
      (f) => f.followerId === userId && this.isActiveUser(f.followedId),
    ).length;
  }

  /** Vrai si l'utilisateur existe et est de statut 'active' (contrepartie
   * comptabilisée dans les compteurs follow et les listes publiques). */
  private isActiveUser(userId: string): boolean {
    return this.users.get(userId)?.status === 'active';
  }

  /** Recalcule les compteurs dénormalisés d'un post depuis les données.
   * commentCount ne compte que les commentaires 'active' (miroir de ce que
   * le service maintiendra côté SQL) ; shareCount n'a pas de table source
   * au Lot 1 et n'est donc jamais recalculé. */
  recomputePostCounters(postId: string): void {
    const post = this.posts.get(postId);
    if (!post) {
      return;
    }
    let reactionCount = 0;
    for (const reaction of this.reactions.values()) {
      if (reaction.targetType === 'post' && reaction.targetId === postId) {
        reactionCount++;
      }
    }
    let commentCount = 0;
    for (const comment of this.comments.values()) {
      if (comment.postId === postId && comment.status === 'active') {
        commentCount++;
      }
    }
    post.reactionCount = reactionCount;
    post.commentCount = commentCount;
    post.saveCount = this.savedPosts.filter((s) => s.postId === postId).length;
  }

  /** Recalcule reactionCount d'un commentaire depuis `reactions`. */
  recomputeCommentCounters(commentId: string): void {
    const comment = this.comments.get(commentId);
    if (!comment) {
      return;
    }
    let reactionCount = 0;
    for (const reaction of this.reactions.values()) {
      if (
        reaction.targetType === 'comment' &&
        reaction.targetId === commentId
      ) {
        reactionCount++;
      }
    }
    comment.reactionCount = reactionCount;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Chargement au démarrage
  // ──────────────────────────────────────────────────────────────────────────

  /** Charge post_types et reaction_types — toujours présents, seed ou pas
   * (les repositories en dépendent, comme les FK côté SQL). */
  private loadReferenceData(): void {
    const now = new Date();
    for (const row of POST_TYPE_ROWS) {
      this.postTypes.set(row.slug, { ...row, createdAt: now, updatedAt: now });
    }
    for (const row of REACTION_TYPE_ROWS) {
      this.reactionTypes.set(row.emoji, { ...row });
    }
    // Taxonomie Dealplace — miroir de db/migrations/0004_dealplace_reference.sql
    // (dealplace-reference.ts). Toujours présente, seed ou pas : les
    // repositories en dépendent (comme les FK côté SQL).
    for (const row of LISTING_CATEGORY_ROWS) {
      this.listingCategories.set(row.slug, {
        ...row,
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const row of LISTING_SUBCATEGORY_ROWS) {
      this.listingSubcategories.set(row.slug, {
        ...row,
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const row of LISTING_TAG_ROWS) {
      this.listingTags.set(row.slug, {
        ...row,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /** Charge le seed déclaratif dans les stores. Les compteurs dénormalisés
   * sont posés à 0 ici puis RECALCULÉS par recomputeAllCounters() — le seed
   * ne fait jamais foi sur un compteur. */
  private loadSeed(seed: SeedData): void {
    for (const user of seed.users) {
      this.users.set(user.id, {
        ...user,
        followersCount: 0,
        followingCount: 0,
      });
    }
    this.follows.push(...seed.follows.map((f) => ({ ...f })));
    for (const post of seed.posts) {
      this.posts.set(post.id, {
        ...post,
        reactionCount: 0,
        commentCount: 0,
        shareCount: post.shareCount ?? 0,
        saveCount: 0,
      });
    }
    for (const media of seed.postMedia) {
      this.postMedia.set(media.id, { ...media });
    }
    for (const comment of seed.comments) {
      this.comments.set(comment.id, { ...comment, reactionCount: 0 });
    }
    for (const reaction of seed.reactions) {
      this.reactions.set(reaction.id, { ...reaction });
    }
    for (const collection of seed.savedCollections) {
      this.savedCollections.set(collection.id, { ...collection });
    }
    this.savedPosts.push(...seed.savedPosts.map((s) => ({ ...s })));
    for (const camera of seed.cameras) {
      this.cameras.set(camera.id, { ...camera });
    }
    for (const report of seed.reports) {
      this.reports.set(report.id, { ...report });
    }
    for (const notification of seed.notifications) {
      this.notifications.set(notification.id, { ...notification });
    }
    // Dealplace : annonces + médias + associations tags. Les annonces seed sont
    // des entités complètes (pas de compteur dénormalisé au CP2.1). Les liens
    // vers catégories/sous-catégories/tags pointent vers la taxonomie de
    // référence chargée par loadReferenceData().
    for (const listing of seed.listings) {
      this.listings.set(listing.id, { ...listing });
    }
    for (const media of seed.listingMedia) {
      this.listingMedia.set(media.id, { ...media });
    }
    this.listingTagMap.push(...seed.listingTagMap.map((m) => ({ ...m })));
    // Pages restaurants & entreprises (Lot 3) : identité + horaires +
    // documents + plats + menus + offres + événements + abonnés. Le compteur
    // d'abonnés est TOUJOURS calculé à la lecture — rien à recalculer ici.
    for (const page of seed.pages) {
      this.pages.set(page.id, { ...page, attributes: [...page.attributes] });
    }
    for (const hour of seed.pageHours) {
      this.pageHours.set(hour.id, { ...hour });
    }
    for (const document of seed.pageDocuments) {
      this.pageDocuments.set(document.id, { ...document });
    }
    for (const dish of seed.dishes) {
      this.dishes.set(dish.id, { ...dish });
    }
    for (const menu of seed.pageMenus) {
      this.pageMenus.set(menu.id, { ...menu });
    }
    for (const item of seed.pageMenuItems) {
      this.pageMenuItems.set(item.id, { ...item });
    }
    for (const offer of seed.pageOffers) {
      this.pageOffers.set(offer.id, { ...offer });
    }
    for (const event of seed.pageEvents) {
      this.pageEvents.set(event.id, { ...event });
    }
    this.pageFollows.push(...seed.pageFollows.map((f) => ({ ...f })));
    // Conversations 1-to-1 (CP2.3) : fils + messages (les jalons de lecture et
    // lastMessageAt sont déclarés par le seed — pas de compteur à recalculer,
    // les non-lus sont TOUJOURS calculés à la lecture).
    for (const conversation of seed.conversations) {
      this.conversations.set(conversation.id, { ...conversation });
    }
    for (const message of seed.messages) {
      this.messages.set(message.id, { ...message });
    }
    // Deals contractuels + avis (CP2.4) : les badges/stepper/notes globales
    // sont TOUJOURS dérivés à la lecture — le seed ne déclare que les données.
    for (const deal of seed.deals) {
      this.deals.set(deal.id, { ...deal });
    }
    for (const item of seed.dealItems) {
      this.dealItems.set(item.id, { ...item });
    }
    for (const step of seed.dealItemSteps) {
      this.dealItemSteps.set(step.id, { ...step });
    }
    for (const adjustment of seed.dealAdjustments) {
      this.dealAdjustments.set(adjustment.id, {
        ...adjustment,
        payload: structuredClone(adjustment.payload),
      });
    }
    for (const note of seed.dealNotes) {
      this.dealNotes.set(note.id, { ...note });
    }
    for (const review of seed.dealReviews) {
      this.dealReviews.set(review.id, { ...review });
    }
  }

  /** Recalcule TOUS les compteurs dénormalisés depuis les données chargées. */
  private recomputeAllCounters(): void {
    for (const userId of this.users.keys()) {
      this.recomputeUserFollowCounts(userId);
    }
    for (const postId of this.posts.keys()) {
      this.recomputePostCounters(postId);
    }
    for (const commentId of this.comments.keys()) {
      this.recomputeCommentCounters(commentId);
    }
  }

  /** Positionne la séquence caméra APRÈS le plus grand numéro seedé
   * (les créations runtime continuent la numérotation sans collision). */
  private syncCameraSequence(): void {
    let max = 0;
    for (const camera of this.cameras.values()) {
      if (camera.cameraNumber > max) {
        max = camera.cameraNumber;
      }
    }
    this.cameraNumberSequence = max + 1;
  }

  /** Positionne la séquence de numéro de deal APRÈS le plus grand numéro
   * seedé (miroir de syncCameraSequence — CP2.4). */
  private syncDealNumberSequence(): void {
    let max = 0;
    for (const deal of this.deals.values()) {
      if (deal.dealNumber > max) {
        max = deal.dealNumber;
      }
    }
    this.dealNumberSequence = max + 1;
  }

  private logBootSummary(): void {
    const now = new Date();
    let visibleOnMap = 0;
    for (const post of this.posts.values()) {
      if (
        post.location !== null &&
        post.status === 'active' &&
        post.mapExpiresAt !== null &&
        post.mapExpiresAt.getTime() > now.getTime() &&
        (post.mapVisibleFrom === null ||
          post.mapVisibleFrom.getTime() <= now.getTime())
      ) {
        visibleOnMap++;
      }
    }
    this.logger.log(
      `Mock DB prête : ${this.users.size} utilisateurs, ` +
        `${this.follows.length} follows, ` +
        `${this.posts.size} posts (dont ${visibleOnMap} visibles carte), ` +
        `${this.comments.size} commentaires, ` +
        `${this.reactions.size} réactions, ` +
        `${this.cameras.size} caméras, ` +
        `${this.reports.size} signalements, ` +
        `${this.notifications.size} notifications, ` +
        `${this.listings.size} annonces Dealplace ` +
        `(${this.listingCategories.size} catégories, ` +
        `${this.listingSubcategories.size} sous-catégories, ` +
        `${this.listingTags.size} tags), ` +
        `${this.conversations.size} conversations ` +
        `(${this.messages.size} messages), ` +
        `${this.deals.size} deals (${this.dealReviews.size} avis), ` +
        `${this.pages.size} pages (${this.dishes.size} plats, ` +
        `${this.pageMenus.size} menus, ${this.pageOffers.size} offres, ` +
        `${this.pageEvents.size} événements, ` +
        `${this.pageFollows.length} abonnés)`,
    );
  }
}

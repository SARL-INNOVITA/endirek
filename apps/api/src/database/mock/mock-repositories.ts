/**
 * Implémentations EN MÉMOIRE des repositories (driver mock) au-dessus des
 * stores de MockDatabaseService.
 *
 * Principes :
 * - même contrat que le futur driver postgres (repositories/interfaces.ts) :
 *   le code métier ne verra aucune différence à la bascule DB_DRIVER=postgres ;
 * - les contraintes SQL (FK, UNIQUE, CHECK) sont reproduites en code avec des
 *   erreurs claires en français ;
 * - les compteurs dénormalisés sont maintenus à jour après chaque mutation en
 *   RECOMPTANT depuis les données (même logique que le recalcul au boot :
 *   une seule source de cohérence, pas d'arithmétique fragile) ;
 * - toutes les méthodes retournent des Promises (contrat asynchrone identique
 *   au driver postgres), même si le travail est synchrone ici ;
 * - les entités RENDUES au code appelant sont des COPIES profondes
 *   (structuredClone) des objets du store : comme avec un driver SQL, muter
 *   le résultat d'une lecture ne modifie jamais la « base ». Les mutations
 *   internes (patchs, recalcul de compteurs) travaillent, elles, directement
 *   sur les objets du store.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BoundingBox,
  Camera,
  CameraStatus,
  Comment,
  CommentStatus,
  Conversation,
  Deal,
  DealAdjustment,
  DealItem,
  DealItemStep,
  DealNote,
  DealReview,
  Dish,
  Listing,
  ListingCategory,
  ListingMedia,
  ListingStatus,
  ListingSubcategory,
  ListingTag,
  Message,
  MessageStatus,
  Notification,
  Page,
  PageContentStatus,
  PageDocument,
  PageEvent,
  PageHour,
  PageMenu,
  PageMenuItem,
  PageOffer,
  PageStatus,
  Post,
  PostMedia,
  PostStatus,
  PostType,
  Reaction,
  ReactionTargetType,
  ReactionType,
  Report,
  ReportTargetType,
  SavedCollection,
  User,
} from '../domain/entities';
import {
  AdminListCamerasParams,
  AdminListConversationsParams,
  AdminListDealsParams,
  AdminListListingsParams,
  AdminListPagesParams,
  AdminListPostsParams,
  CamerasRepository,
  CommentsRepository,
  ConversationsRepository,
  CreateCameraInput,
  CreateCommentInput,
  CreateConversationInput,
  CreateDealAdjustmentInput,
  CreateDealInput,
  CreateDealItemSpec,
  CreateDealReviewInput,
  CreateDishInput,
  CreateListingCategoryInput,
  CreateListingInput,
  CreateListingSubcategoryInput,
  CreateListingTagInput,
  CreateMessageInput,
  CreateNotificationInput,
  CreatePageDocumentInput,
  CreatePageEventInput,
  CreatePageInput,
  CreatePageOfferInput,
  CreatePostInput,
  CreateReportInput,
  CreateUserInput,
  DealReviewAggregates,
  DealsRepository,
  HandleReportInput,
  ListAuthorPostsParams,
  ListCamerasParams,
  ListDealsParams,
  ListFeedParams,
  ListingsRepository,
  ListingTaxonomyRepository,
  ListMapMarkersParams,
  ListOwnerListingsParams,
  ListOwnerPagesParams,
  ListPublicListingsParams,
  ListReportsParams,
  ListUsersParams,
  NotificationsRepository,
  PagedResult,
  PageHourSpec,
  PageMenuWithDishes,
  PageParams,
  PagesRepository,
  PostsRepository,
  PostTypesRepository,
  ReactionsRepository,
  ReportsRepository,
  SavedRepository,
  UpdateCameraPatch,
  UpdateDealItemPatch,
  UpdateDealPatch,
  UpdateDishPatch,
  UpdateListingCategoryPatch,
  UpdateListingPatch,
  UpdateListingSubcategoryPatch,
  UpdateListingTagPatch,
  UpdatePageEventPatch,
  UpdatePageOfferPatch,
  UpdatePagePatch,
  UpdatePostPatch,
  UpdatePostTypePatch,
  UpdateUserPatch,
  UsersRepository,
} from '../repositories/interfaces';
import { UniqueViolationError } from '../repositories/errors';
import { isInBbox } from './geo';
import { MockDatabaseService } from './mock-database.service';

/** Nom de la collection de sauvegarde créée par défaut à l'inscription. */
const DEFAULT_COLLECTION_NAME = 'Général';

/**
 * Copie profonde d'une entité avant de la rendre au code appelant —
 * structuredClone (Node ≥ 22) préserve les Date et les objets imbriqués.
 * Les objets VIVANTS restent dans les stores : un service qui mute le
 * résultat d'une lecture ne peut pas contourner le contrat repository
 * (même comportement qu'une ligne matérialisée par un driver SQL).
 */
function clone<T>(entity: T): T {
  return structuredClone(entity);
}

/**
 * Applique un patch partiel sur une entité du store en IGNORANT les clés à
 * valeur `undefined` — sémantique SQL : une colonne absente de la clause SET
 * reste inchangée (un patch { email: undefined } ne doit jamais écraser une
 * colonne NOT NULL). `null` reste en revanche une valeur légitime
 * (remise à NULL d'une colonne nullable).
 */
function applyPatch<T extends object>(entity: T, patch: Partial<T>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      (entity as Record<string, unknown>)[key] = value;
    }
  }
}

/** Tri antéchronologique (created_at DESC) — le tri de référence des feeds. */
function byCreatedAtDesc(a: { createdAt: Date }, b: { createdAt: Date }): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

/** Tri chronologique (created_at ASC) — fils de commentaires. */
function byCreatedAtAsc(a: { createdAt: Date }, b: { createdAt: Date }): number {
  return a.createdAt.getTime() - b.createdAt.getTime();
}

// ────────────────────────────────────────────────────────────────────────────
// Utilisateurs & follows
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockUsersRepository implements UsersRepository {
  constructor(private readonly db: MockDatabaseService) {}

  findById(id: string): Promise<User | null> {
    return Promise.resolve(clone(this.db.users.get(id) ?? null));
  }

  findByIds(ids: string[]): Promise<User[]> {
    // Chargement par lot (auteurs d'une page de feed) : les ids inconnus
    // sont ignorés silencieusement — équivalent d'un WHERE id = ANY($1).
    const users: User[] = [];
    for (const id of new Set(ids)) {
      const user = this.db.users.get(id);
      if (user) {
        users.push(clone(user));
      }
    }
    return Promise.resolve(users);
  }

  findByEmail(email: string): Promise<User | null> {
    const needle = email.toLowerCase();
    for (const user of this.db.users.values()) {
      if (user.email.toLowerCase() === needle) {
        return Promise.resolve(clone(user));
      }
    }
    return Promise.resolve(null);
  }

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new Error(
        `Un compte existe déjà avec l'email « ${input.email} » (unicité insensible à la casse).`,
      );
    }
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? null,
      coverUrl: input.coverUrl ?? null,
      bio: input.bio ?? '',
      city: input.city ?? null,
      // « Ce que je recherche » (profil Dealplace — CP2.2) : jamais renseigné
      // à l'inscription, l'utilisateur le remplit depuis son profil.
      dealplaceSeeking: null,
      location: input.location ?? null,
      settings: input.settings ?? {},
      role: input.role ?? 'user',
      status: 'active',
      followersCount: 0,
      followingCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.db.users.set(user.id, user);
    return clone(user);
  }

  async update(id: string, patch: UpdateUserPatch): Promise<User> {
    const user = this.db.users.get(id);
    if (!user) {
      throw new Error(`Utilisateur introuvable : ${id}.`);
    }
    // Contrôle d'unicité UNIQUEMENT si l'email fait partie du patch
    // (undefined = colonne non modifiée, aucun contrôle à faire).
    if (patch.email !== undefined) {
      const other = await this.findByEmail(patch.email);
      if (other && other.id !== id) {
        throw new Error(
          `Un autre compte utilise déjà l'email « ${patch.email} ».`,
        );
      }
    }
    applyPatch(user, patch);
    this.db.touch(user);
    return clone(user);
  }

  softDelete(id: string): Promise<void> {
    const user = this.db.users.get(id);
    if (!user) {
      throw new Error(`Utilisateur introuvable : ${id}.`);
    }
    user.status = 'deleted';
    user.deletedAt = new Date();
    this.db.touch(user);
    // Les lignes de `follows` sont CONSERVÉES (trace pour l'export RGPD et
    // l'audit) ; seuls les compteurs dénormalisés changent. Comme `id` n'est
    // plus 'active', il ne doit plus être compté chez ses contreparties :
    // - chaque B que `id` suivait perd 1 follower actif → recompute B ;
    // - chaque C qui suivait `id` perd 1 following actif → recompute C ;
    // - `id` lui-même est recomputé (ses propres compteurs retombent à 0
    //   côté contreparties actives, cohérent avec l'anonymisation du compte).
    const counterparts = new Set<string>();
    for (const follow of this.db.follows) {
      if (follow.followerId === id) {
        counterparts.add(follow.followedId);
      }
      if (follow.followedId === id) {
        counterparts.add(follow.followerId);
      }
    }
    for (const counterpartId of counterparts) {
      this.db.recomputeUserFollowCounts(counterpartId);
    }
    this.db.recomputeUserFollowCounts(id);
    return Promise.resolve();
  }

  async follow(followerId: string, followedId: string): Promise<void> {
    if (followerId === followedId) {
      throw new Error(
        'Un utilisateur ne peut pas se suivre lui-même (CHECK follower_id <> followed_id).',
      );
    }
    if (!this.db.users.has(followerId) || !this.db.users.has(followedId)) {
      throw new Error('Follow impossible : utilisateur introuvable.');
    }
    // Défense en profondeur (le service protège déjà via 404) : on ne suit
    // pas un compte non actif — politique « on ne suit pas un compte
    // supprimé/suspendu ». Le seed n'emprunte PAS ce chemin (il insère les
    // follows directement dans le store), il n'est donc pas affecté.
    if (this.db.users.get(followedId)?.status !== 'active') {
      throw new Error(
        'Follow impossible : le compte cible n\'est pas actif (supprimé ou suspendu).',
      );
    }
    if (await this.isFollowing(followerId, followedId)) {
      return; // Idempotent : déjà suivi, rien à faire.
    }
    this.db.follows.push({ followerId, followedId, createdAt: new Date() });
    this.db.recomputeUserFollowCounts(followerId);
    this.db.recomputeUserFollowCounts(followedId);
  }

  unfollow(followerId: string, followedId: string): Promise<void> {
    const index = this.db.follows.findIndex(
      (f) => f.followerId === followerId && f.followedId === followedId,
    );
    if (index >= 0) {
      this.db.follows.splice(index, 1);
      this.db.recomputeUserFollowCounts(followerId);
      this.db.recomputeUserFollowCounts(followedId);
    }
    return Promise.resolve();
  }

  isFollowing(followerId: string, followedId: string): Promise<boolean> {
    return Promise.resolve(
      this.db.follows.some(
        (f) => f.followerId === followerId && f.followedId === followedId,
      ),
    );
  }

  listFollowedIds(userId: string): Promise<string[]> {
    return Promise.resolve(
      this.db.follows
        .filter((f) => f.followerId === userId)
        .map((f) => f.followedId),
    );
  }

  /**
   * Page d'utilisateurs à partir de liens de suivi triés du plus récent au
   * plus ancien. Seuls les comptes ACTIFS sont retenus (les comptes
   * supprimés/suspendus n'apparaissent pas dans les listes publiques) ;
   * `total` compte ces mêmes comptes actifs.
   */
  private pageFollowUsers(
    links: Array<{ userId: string; createdAt: Date }>,
    params: PageParams,
  ): PagedResult<User> {
    const activeUsers: User[] = [];
    for (const link of links.sort(byCreatedAtDesc)) {
      const user = this.db.users.get(link.userId);
      if (user && user.status === 'active') {
        activeUsers.push(user);
      }
    }
    return {
      items: activeUsers
        .slice(params.offset, params.offset + params.limit)
        .map((u) => clone(u)),
      total: activeUsers.length,
    };
  }

  listFollowers(
    userId: string,
    params: PageParams,
  ): Promise<PagedResult<User>> {
    return Promise.resolve(
      this.pageFollowUsers(
        this.db.follows
          .filter((f) => f.followedId === userId)
          .map((f) => ({ userId: f.followerId, createdAt: f.createdAt })),
        params,
      ),
    );
  }

  listFollowing(
    userId: string,
    params: PageParams,
  ): Promise<PagedResult<User>> {
    return Promise.resolve(
      this.pageFollowUsers(
        this.db.follows
          .filter((f) => f.followerId === userId)
          .map((f) => ({ userId: f.followedId, createdAt: f.createdAt })),
        params,
      ),
    );
  }

  list(params: ListUsersParams): Promise<PagedResult<User>> {
    let items = [...this.db.users.values()];
    if (params.status !== undefined) {
      items = items.filter((u) => u.status === params.status);
    }
    if (params.role !== undefined) {
      items = items.filter((u) => u.role === params.role);
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      const needle = params.search.trim().toLowerCase();
      items = items.filter(
        (u) =>
          u.displayName.toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle),
      );
    }
    items.sort(byCreatedAtDesc);
    const total = items.length;
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((u) => clone(u)),
      total,
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Types de publication
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockPostTypesRepository implements PostTypesRepository {
  constructor(private readonly db: MockDatabaseService) {}

  listAll(): Promise<PostType[]> {
    return Promise.resolve(
      [...this.db.postTypes.values()]
        .sort((a, b) => a.position - b.position || a.slug.localeCompare(b.slug))
        .map((t) => clone(t)),
    );
  }

  listActive(): Promise<PostType[]> {
    return Promise.resolve(
      [...this.db.postTypes.values()]
        .filter((t) => t.isActive)
        .sort((a, b) => a.position - b.position)
        .map((t) => clone(t)),
    );
  }

  findBySlug(slug: string): Promise<PostType | null> {
    return Promise.resolve(clone(this.db.postTypes.get(slug) ?? null));
  }

  update(slug: string, patch: UpdatePostTypePatch): Promise<PostType> {
    const postType = this.db.postTypes.get(slug);
    if (!postType) {
      throw new Error(`Type de publication introuvable : « ${slug} ».`);
    }
    applyPatch(postType, patch);
    this.db.touch(postType);
    return Promise.resolve(clone(postType));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Publications
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockPostsRepository implements PostsRepository {
  constructor(private readonly db: MockDatabaseService) {}

  findById(id: string): Promise<Post | null> {
    return Promise.resolve(clone(this.db.posts.get(id) ?? null));
  }

  findByUrlSlug(urlSlug: string): Promise<Post | null> {
    for (const post of this.db.posts.values()) {
      if (post.urlSlug === urlSlug) {
        return Promise.resolve(clone(post));
      }
    }
    return Promise.resolve(null);
  }

  async create(input: CreatePostInput): Promise<Post> {
    if (!this.db.users.has(input.authorId)) {
      throw new Error(`Auteur introuvable : ${input.authorId}.`);
    }
    if (!this.db.postTypes.has(input.typeSlug)) {
      throw new Error(
        `Type de publication inconnu : « ${input.typeSlug} » (FK post_types).`,
      );
    }
    if (await this.findByUrlSlug(input.urlSlug)) {
      throw new Error(
        `url_slug déjà utilisé : « ${input.urlSlug} » (contrainte UNIQUE).`,
      );
    }
    if (input.pageId != null && !this.db.pages.has(input.pageId)) {
      throw new Error(`Page introuvable : ${input.pageId} (FK pages).`);
    }
    const now = new Date();
    const post: Post = {
      id: randomUUID(),
      authorId: input.authorId,
      pageId: input.pageId ?? null, // Post publié au nom d'une page (Lot 3 — D73).
      typeSlug: input.typeSlug,
      title: input.title ?? null,
      body: input.body,
      location: input.location ?? null,
      city: input.city ?? null,
      visibility: 'public',
      status: 'active',
      urlSlug: input.urlSlug,
      mapExpiresAt: input.mapExpiresAt ?? null,
      mapVisibleFrom: input.mapVisibleFrom ?? null,
      reactionCount: 0,
      commentCount: 0,
      shareCount: 0,
      saveCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.db.posts.set(post.id, post);
    // Médias créés ATOMIQUEMENT avec le post (équivalent transaction SQL) —
    // position par défaut : l'index dans le tableau fourni.
    (input.media ?? []).forEach((spec, index) => {
      const media: PostMedia = {
        id: randomUUID(),
        postId: post.id,
        mediaType: spec.mediaType,
        url: spec.url,
        thumbnailUrl: spec.thumbnailUrl ?? null,
        width: spec.width ?? null,
        height: spec.height ?? null,
        position: spec.position ?? index,
        createdAt: now,
      };
      this.db.postMedia.set(media.id, media);
    });
    return clone(post);
  }

  update(id: string, patch: UpdatePostPatch): Promise<Post> {
    const post = this.db.posts.get(id);
    if (!post) {
      throw new Error(`Publication introuvable : ${id}.`);
    }
    applyPatch(post, patch);
    this.db.touch(post);
    return Promise.resolve(clone(post));
  }

  setStatus(id: string, status: PostStatus): Promise<Post> {
    const post = this.db.posts.get(id);
    if (!post) {
      throw new Error(`Publication introuvable : ${id}.`);
    }
    post.status = status;
    this.db.touch(post);
    return Promise.resolve(clone(post));
  }

  countByAuthor(authorId: string): Promise<number> {
    // Les posts de PAGE sont exclus du compteur de profil (Lot 3 — D73).
    let count = 0;
    for (const post of this.db.posts.values()) {
      if (
        post.authorId === authorId &&
        post.pageId === null &&
        post.status === 'active'
      ) {
        count++;
      }
    }
    return Promise.resolve(count);
  }

  countByPage(pageId: string): Promise<number> {
    let count = 0;
    for (const post of this.db.posts.values()) {
      if (post.pageId === pageId && post.status === 'active') {
        count++;
      }
    }
    return Promise.resolve(count);
  }

  listByAuthor(authorId: string): Promise<Post[]> {
    // Export RGPD : TOUS les posts de l'auteur, quel que soit leur statut
    // (le feed public, lui, passe par listFeed qui ne sert que les 'active').
    return Promise.resolve(
      [...this.db.posts.values()]
        .filter((p) => p.authorId === authorId)
        .sort(byCreatedAtDesc)
        .map((p) => clone(p)),
    );
  }

  listByAuthorPaged(
    authorId: string,
    params: ListAuthorPostsParams,
  ): Promise<PagedResult<Post>> {
    // Les posts de PAGE sont exclus des listes de profil (Lot 3 — D73) :
    // ils vivent sur GET /pages/:id/posts.
    const statuses = new Set(params.statuses);
    const items = [...this.db.posts.values()]
      .filter(
        (p) =>
          p.authorId === authorId &&
          p.pageId === null &&
          statuses.has(p.status),
      )
      .sort(byCreatedAtDesc);
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((p) => clone(p)),
      total: items.length,
    });
  }

  listByPagePaged(
    pageId: string,
    params: ListAuthorPostsParams,
  ): Promise<PagedResult<Post>> {
    // Publications d'une PAGE (Lot 3 — D73) — même sémantique que
    // listByAuthorPaged (statuts filtrés, antéchronologique, tie-break id).
    const statuses = new Set(params.statuses);
    const items = [...this.db.posts.values()]
      .filter((p) => p.pageId === pageId && statuses.has(p.status))
      .sort((a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id));
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((p) => clone(p)),
      total: items.length,
    });
  }

  listFeed(params: ListFeedParams): Promise<Post[]> {
    let items = [...this.db.posts.values()].filter(
      (p) => p.status === 'active',
    );
    if (params.beforeCreatedAt !== undefined) {
      const before = params.beforeCreatedAt.getTime();
      items = items.filter((p) => p.createdAt.getTime() < before);
    }
    if (params.typeSlugs !== undefined && params.typeSlugs.length > 0) {
      const slugs = new Set(params.typeSlugs);
      items = items.filter((p) => slugs.has(p.typeSlug));
    }
    if (params.authorIds !== undefined && params.authorIds.length > 0) {
      const authors = new Set(params.authorIds);
      items = items.filter((p) => authors.has(p.authorId));
    }
    items.sort(byCreatedAtDesc);
    return Promise.resolve(items.slice(0, params.limit).map((p) => clone(p)));
  }

  listActiveWindow(limit: number): Promise<Post[]> {
    // Fenêtre du scoring du feed : les N posts 'active' les plus récents,
    // tie-break sur l'id pour un ordre STABLE entre deux appels (le driver
    // postgres fera ORDER BY created_at DESC, id LIMIT n). Les posts d'une
    // page NON ACTIVE sont exclus (Lot 3 — D69 : page masquée = contenus
    // retirés du flux).
    const items = [...this.db.posts.values()]
      .filter((p) => p.status === 'active' && this.isPageVisible(p))
      .sort(
        (a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id),
      );
    return Promise.resolve(items.slice(0, limit).map((p) => clone(p)));
  }

  /** Vrai si le post n'est pas un post de page OU si sa page est 'active'
   * (feed/carte — Lot 3, D69). */
  private isPageVisible(post: Post): boolean {
    if (post.pageId === null) {
      return true;
    }
    return this.db.pages.get(post.pageId)?.status === 'active';
  }

  listMediaByPostIds(postIds: string[]): Promise<PostMedia[]> {
    // Lecture PAR LOT des médias d'une page de posts (évite les N+1) —
    // triés par position croissante (le regroupement par post revient à
    // l'appelant, comme avec un WHERE post_id = ANY($1) ORDER BY position).
    const wanted = new Set(postIds);
    return Promise.resolve(
      [...this.db.postMedia.values()]
        .filter((m) => wanted.has(m.postId))
        .sort((a, b) => a.position - b.position || byCreatedAtAsc(a, b))
        .map((m) => clone(m)),
    );
  }

  listAdmin(params: AdminListPostsParams): Promise<PagedResult<Post>> {
    // Liste BACKOFFICE : tous statuts par défaut (y compris 'deleted' —
    // audit), recherche insensible à la casse sur titre, corps et nom
    // affiché de l'auteur. Le driver postgres fera un JOIN users + ILIKE.
    let items = [...this.db.posts.values()];
    if (params.typeSlug !== undefined) {
      items = items.filter((p) => p.typeSlug === params.typeSlug);
    }
    if (params.status !== undefined) {
      items = items.filter((p) => p.status === params.status);
    }
    if (params.mapVisible !== undefined) {
      const now = Date.now();
      items = items.filter((p) => {
        const isVisible =
          p.status === 'active' &&
          p.location !== null &&
          p.mapExpiresAt !== null &&
          p.mapExpiresAt.getTime() > now;
        return params.mapVisible ? isVisible : !isVisible;
      });
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      const needle = params.search.trim().toLowerCase();
      items = items.filter((p) => {
        const authorName =
          this.db.users.get(p.authorId)?.displayName.toLowerCase() ?? '';
        return (
          (p.title ?? '').toLowerCase().includes(needle) ||
          p.body.toLowerCase().includes(needle) ||
          authorName.includes(needle)
        );
      });
    }
    // Antéchronologique, tie-break id : ordre STABLE entre deux pages.
    items.sort((a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id));
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((p) => clone(p)),
      total: items.length,
    });
  }

  listMapMarkers(params: ListMapMarkersParams): Promise<Post[]> {
    const nowMs = params.now.getTime();
    const categories =
      params.categories !== undefined && params.categories.length > 0
        ? new Set(params.categories)
        : null;

    const items = [...this.db.posts.values()].filter((p) => {
      if (p.status !== 'active' || p.location === null) {
        return false;
      }
      // Un post sans mapExpiresAt (ou expiré) n'apparaît plus sur la carte —
      // il reste néanmoins dans le feed (règle métier documentée).
      if (p.mapExpiresAt === null || p.mapExpiresAt.getTime() <= nowMs) {
        return false;
      }
      // Visibilité différée (Lot 3 — D73) : un post d'événement n'apparaît
      // sur la carte qu'à partir de mapVisibleFrom (J-3).
      if (p.mapVisibleFrom !== null && p.mapVisibleFrom.getTime() > nowMs) {
        return false;
      }
      // Page masquée/supprimée = contenus retirés de la carte (Lot 3 — D69).
      if (!this.isPageVisible(p)) {
        return false;
      }
      if (categories && !categories.has(p.typeSlug)) {
        return false;
      }
      // bbox absente : toute l'île (aucun filtre spatial).
      return params.bbox === undefined || isInBbox(p.location, params.bbox);
    });
    items.sort(byCreatedAtDesc);
    return Promise.resolve(items.map((p) => clone(p)));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Commentaires
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockCommentsRepository implements CommentsRepository {
  constructor(private readonly db: MockDatabaseService) {}

  findById(id: string): Promise<Comment | null> {
    return Promise.resolve(clone(this.db.comments.get(id) ?? null));
  }

  listByPost(postId: string): Promise<Comment[]> {
    return Promise.resolve(
      [...this.db.comments.values()]
        .filter((c) => c.postId === postId)
        .sort(byCreatedAtAsc)
        .map((c) => clone(c)),
    );
  }

  listByAuthor(authorId: string): Promise<Comment[]> {
    // Export RGPD : tous les commentaires de l'auteur, chronologiques.
    return Promise.resolve(
      [...this.db.comments.values()]
        .filter((c) => c.authorId === authorId)
        .sort(byCreatedAtAsc)
        .map((c) => clone(c)),
    );
  }

  create(input: CreateCommentInput): Promise<Comment> {
    const post = this.db.posts.get(input.postId);
    if (!post) {
      throw new Error(`Publication introuvable : ${input.postId}.`);
    }
    if (!this.db.users.has(input.authorId)) {
      throw new Error(`Auteur introuvable : ${input.authorId}.`);
    }

    let depth: 0 | 1 = 0;
    const parentCommentId = input.parentCommentId ?? null;
    if (parentCommentId !== null) {
      const parent = this.db.comments.get(parentCommentId);
      if (!parent) {
        throw new Error(`Commentaire parent introuvable : ${parentCommentId}.`);
      }
      if (parent.postId !== input.postId) {
        throw new Error(
          'Le commentaire parent appartient à une autre publication.',
        );
      }
      // Option A (décision produit validée) : depth 0 = commentaire principal,
      // depth 1 = réponse. On REFUSE toute réponse à une réponse au Lot 1.
      if (parent.parentCommentId !== null) {
        throw new Error(
          'Impossible de répondre à une réponse : la profondeur des commentaires ' +
            'est limitée à 1 au Lot 1 (option A — répondre au commentaire principal).',
        );
      }
      depth = 1;
    }

    const now = new Date();
    const comment: Comment = {
      id: randomUUID(),
      postId: input.postId,
      authorId: input.authorId,
      parentCommentId,
      depth,
      body: input.body,
      status: 'active',
      reactionCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.db.comments.set(comment.id, comment);
    this.db.recomputePostCounters(input.postId);
    return Promise.resolve(clone(comment));
  }

  setStatus(id: string, status: CommentStatus): Promise<Comment> {
    const comment = this.db.comments.get(id);
    if (!comment) {
      throw new Error(`Commentaire introuvable : ${id}.`);
    }
    comment.status = status;
    this.db.touch(comment);
    // commentCount du post = commentaires 'active' : on recompte.
    this.db.recomputePostCounters(comment.postId);
    return Promise.resolve(clone(comment));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Réactions
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockReactionsRepository implements ReactionsRepository {
  constructor(private readonly db: MockDatabaseService) {}

  listActiveTypes(): Promise<ReactionType[]> {
    // Palette pilotable par le backoffice (table reaction_types) : la
    // validation des emojis passe TOUJOURS par ici, jamais par une liste
    // en dur dans le code métier.
    return Promise.resolve(
      [...this.db.reactionTypes.values()]
        .filter((t) => t.isActive)
        .sort((a, b) => a.position - b.position)
        .map((t) => clone(t)),
    );
  }

  /** Répercute la mutation sur le compteur dénormalisé de la cible. */
  private refreshTargetCounters(
    targetType: ReactionTargetType,
    targetId: string,
  ): void {
    if (targetType === 'post') {
      this.db.recomputePostCounters(targetId);
    } else {
      this.db.recomputeCommentCounters(targetId);
    }
  }

  upsert(
    userId: string,
    targetType: ReactionTargetType,
    targetId: string,
    emoji: string,
  ): Promise<Reaction> {
    if (!this.db.users.has(userId)) {
      throw new Error(`Utilisateur introuvable : ${userId}.`);
    }
    if (!this.db.reactionTypes.has(emoji)) {
      throw new Error(
        `Réaction inconnue : « ${emoji} » (FK reaction_types — palette pilotée par le backoffice).`,
      );
    }

    // UNIQUE (user_id, target_type, target_id) : une seule réaction par cible,
    // changer d'emoji = update de la ligne existante.
    for (const reaction of this.db.reactions.values()) {
      if (
        reaction.userId === userId &&
        reaction.targetType === targetType &&
        reaction.targetId === targetId
      ) {
        reaction.emoji = emoji;
        return Promise.resolve(clone(reaction));
      }
    }

    const reaction: Reaction = {
      id: randomUUID(),
      userId,
      targetType,
      targetId,
      emoji,
      createdAt: new Date(),
    };
    this.db.reactions.set(reaction.id, reaction);
    this.refreshTargetCounters(targetType, targetId);
    return Promise.resolve(clone(reaction));
  }

  remove(
    userId: string,
    targetType: ReactionTargetType,
    targetId: string,
  ): Promise<void> {
    for (const [id, reaction] of this.db.reactions) {
      if (
        reaction.userId === userId &&
        reaction.targetType === targetType &&
        reaction.targetId === targetId
      ) {
        this.db.reactions.delete(id);
        this.refreshTargetCounters(targetType, targetId);
        break;
      }
    }
    return Promise.resolve();
  }

  listByTarget(
    targetType: ReactionTargetType,
    targetId: string,
  ): Promise<Reaction[]> {
    return Promise.resolve(
      [...this.db.reactions.values()]
        .filter(
          (r) => r.targetType === targetType && r.targetId === targetId,
        )
        .sort(byCreatedAtDesc)
        .map((r) => clone(r)),
    );
  }

  listByUser(userId: string): Promise<Reaction[]> {
    // Export RGPD : toutes les réactions émises par l'utilisateur.
    return Promise.resolve(
      [...this.db.reactions.values()]
        .filter((r) => r.userId === userId)
        .sort(byCreatedAtDesc)
        .map((r) => clone(r)),
    );
  }

  countsByEmoji(
    targetType: ReactionTargetType,
    targetId: string,
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const reaction of this.db.reactions.values()) {
      if (reaction.targetType === targetType && reaction.targetId === targetId) {
        counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1;
      }
    }
    return Promise.resolve(counts);
  }

  countsByEmojiForTargets(
    targetType: ReactionTargetType,
    targetIds: string[],
  ): Promise<Record<string, Record<string, number>>> {
    // Agrégat PAR LOT (reactionsTop d'une page de feed) : un seul parcours
    // du store — équivalent d'un GROUP BY target_id, emoji côté SQL.
    const wanted = new Set(targetIds);
    const result: Record<string, Record<string, number>> = {};
    for (const reaction of this.db.reactions.values()) {
      if (reaction.targetType !== targetType || !wanted.has(reaction.targetId)) {
        continue;
      }
      const counts = (result[reaction.targetId] ??= {});
      counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1;
    }
    return Promise.resolve(result);
  }

  findViewerReactions(
    userId: string,
    targetType: ReactionTargetType,
    targetIds: string[],
  ): Promise<Record<string, string>> {
    // Réactions du viewer PAR LOT (viewerReaction d'une page de feed).
    const wanted = new Set(targetIds);
    const result: Record<string, string> = {};
    for (const reaction of this.db.reactions.values()) {
      if (
        reaction.userId === userId &&
        reaction.targetType === targetType &&
        wanted.has(reaction.targetId)
      ) {
        result[reaction.targetId] = reaction.emoji;
      }
    }
    return Promise.resolve(result);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Sauvegardes
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockSavedRepository implements SavedRepository {
  constructor(private readonly db: MockDatabaseService) {}

  getOrCreateDefaultCollection(ownerId: string): Promise<SavedCollection> {
    if (!this.db.users.has(ownerId)) {
      throw new Error(`Utilisateur introuvable : ${ownerId}.`);
    }
    // Index UNIQUE partiel (owner_id) WHERE is_default : au plus une par user.
    for (const collection of this.db.savedCollections.values()) {
      if (collection.ownerId === ownerId && collection.isDefault) {
        return Promise.resolve(clone(collection));
      }
    }
    const collection: SavedCollection = {
      id: randomUUID(),
      ownerId,
      name: DEFAULT_COLLECTION_NAME,
      isDefault: true,
      createdAt: new Date(),
    };
    this.db.savedCollections.set(collection.id, collection);
    return Promise.resolve(clone(collection));
  }

  listCollections(ownerId: string): Promise<SavedCollection[]> {
    return Promise.resolve(
      [...this.db.savedCollections.values()]
        .filter((c) => c.ownerId === ownerId)
        // La collection par défaut d'abord, puis les autres par ancienneté.
        .sort((a, b) => {
          if (a.isDefault !== b.isDefault) {
            return a.isDefault ? -1 : 1;
          }
          return byCreatedAtAsc(a, b);
        })
        .map((c) => clone(c)),
    );
  }

  save(collectionId: string, postId: string): Promise<void> {
    if (!this.db.savedCollections.has(collectionId)) {
      throw new Error(`Collection introuvable : ${collectionId}.`);
    }
    if (!this.db.posts.has(postId)) {
      throw new Error(`Publication introuvable : ${postId}.`);
    }
    // PK (collection_id, post_id) : idempotent, pas de doublon.
    const exists = this.db.savedPosts.some(
      (s) => s.collectionId === collectionId && s.postId === postId,
    );
    if (!exists) {
      this.db.savedPosts.push({ collectionId, postId, createdAt: new Date() });
      this.db.recomputePostCounters(postId);
    }
    return Promise.resolve();
  }

  unsave(collectionId: string, postId: string): Promise<void> {
    const index = this.db.savedPosts.findIndex(
      (s) => s.collectionId === collectionId && s.postId === postId,
    );
    if (index >= 0) {
      this.db.savedPosts.splice(index, 1);
      this.db.recomputePostCounters(postId);
    }
    return Promise.resolve();
  }

  isSaved(userId: string, postId: string): Promise<boolean> {
    const collectionIds = this.ownedCollectionIds(userId);
    return Promise.resolve(
      this.db.savedPosts.some(
        (s) => s.postId === postId && collectionIds.has(s.collectionId),
      ),
    );
  }

  filterSavedPostIds(userId: string, postIds: string[]): Promise<string[]> {
    // Filtre PAR LOT (viewerSaved d'une page de feed) : parmi les postIds
    // demandés, ceux présents dans une collection de l'utilisateur.
    const collectionIds = this.ownedCollectionIds(userId);
    const wanted = new Set(postIds);
    const saved = new Set<string>();
    for (const entry of this.db.savedPosts) {
      if (wanted.has(entry.postId) && collectionIds.has(entry.collectionId)) {
        saved.add(entry.postId);
      }
    }
    return Promise.resolve([...saved]);
  }

  /** Ids des collections appartenant à un utilisateur. */
  private ownedCollectionIds(userId: string): Set<string> {
    const ids = new Set<string>();
    for (const collection of this.db.savedCollections.values()) {
      if (collection.ownerId === userId) {
        ids.add(collection.id);
      }
    }
    return ids;
  }

  listSavedPosts(collectionId: string): Promise<Post[]> {
    const posts: Post[] = [];
    const entries = this.db.savedPosts
      .filter((s) => s.collectionId === collectionId)
      .sort(byCreatedAtDesc); // Du plus récemment sauvegardé au plus ancien.
    for (const entry of entries) {
      const post = this.db.posts.get(entry.postId);
      if (post) {
        posts.push(clone(post));
      }
    }
    return Promise.resolve(posts);
  }

  listSavedPostsByUser(
    userId: string,
    params: PageParams,
  ): Promise<PagedResult<Post>> {
    // Enregistrements de TOUTES les collections de l'utilisateur (une seule
    // « Général » au Lot 1), du plus récemment enregistré au plus ancien.
    // Seuls les posts encore 'active' sont retenus : un post devenu
    // hidden/deleted disparaît de la liste ET de `total` (le lien
    // saved_posts, lui, est conservé). Dédoublonné par post au cas où un
    // même post serait enregistré dans plusieurs collections (lots futurs).
    const collectionIds = this.ownedCollectionIds(userId);
    const seen = new Set<string>();
    const posts: Post[] = [];
    const entries = this.db.savedPosts
      .filter((s) => collectionIds.has(s.collectionId))
      .sort(byCreatedAtDesc);
    for (const entry of entries) {
      if (seen.has(entry.postId)) {
        continue;
      }
      seen.add(entry.postId);
      const post = this.db.posts.get(entry.postId);
      if (post && post.status === 'active') {
        posts.push(post);
      }
    }
    return Promise.resolve({
      items: posts
        .slice(params.offset, params.offset + params.limit)
        .map((p) => clone(p)),
      total: posts.length,
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Caméras
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockCamerasRepository implements CamerasRepository {
  constructor(private readonly db: MockDatabaseService) {}

  list(params?: ListCamerasParams): Promise<Camera[]> {
    let items = [...this.db.cameras.values()];
    if (params?.category !== undefined) {
      items = items.filter((c) => c.category === params.category);
    }
    if (params?.status !== undefined) {
      items = items.filter((c) => c.status === params.status);
    }
    // Tri stable par numéro : l'ordre d'affichage « #1, #2, ... » de l'app.
    items.sort((a, b) => a.cameraNumber - b.cameraNumber);
    return Promise.resolve(items.map((c) => clone(c)));
  }

  listInBbox(bbox: BoundingBox): Promise<Camera[]> {
    return Promise.resolve(
      [...this.db.cameras.values()]
        .filter((c) => isInBbox(c.location, bbox))
        .sort((a, b) => a.cameraNumber - b.cameraNumber)
        .map((c) => clone(c)),
    );
  }

  findById(id: string): Promise<Camera | null> {
    return Promise.resolve(clone(this.db.cameras.get(id) ?? null));
  }

  create(input: CreateCameraInput): Promise<Camera> {
    const now = new Date();
    const camera: Camera = {
      id: randomUUID(),
      cameraNumber: this.db.nextCameraNumber(),
      name: input.name,
      streamType: input.streamType,
      url: input.url,
      category: input.category,
      description: input.description ?? '',
      location: input.location,
      cityName: input.cityName,
      districtName: input.districtName ?? null,
      status: input.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.db.cameras.set(camera.id, camera);
    return Promise.resolve(clone(camera));
  }

  update(id: string, patch: UpdateCameraPatch): Promise<Camera> {
    const camera = this.db.cameras.get(id);
    if (!camera) {
      throw new Error(`Caméra introuvable : ${id}.`);
    }
    applyPatch(camera, patch);
    this.db.touch(camera);
    return Promise.resolve(clone(camera));
  }

  setStatus(id: string, status: CameraStatus): Promise<Camera> {
    const camera = this.db.cameras.get(id);
    if (!camera) {
      throw new Error(`Caméra introuvable : ${id}.`);
    }
    camera.status = status;
    this.db.touch(camera);
    return Promise.resolve(clone(camera));
  }

  listAdmin(params: AdminListCamerasParams): Promise<PagedResult<Camera>> {
    // Liste BACKOFFICE : tous statuts par défaut, filtres catégorie/statut et
    // recherche insensible à la casse sur name/cityName/description. Le driver
    // postgres fera un ILIKE + LIMIT/OFFSET.
    let items = [...this.db.cameras.values()];
    if (params.category !== undefined) {
      items = items.filter((c) => c.category === params.category);
    }
    if (params.status !== undefined) {
      items = items.filter((c) => c.status === params.status);
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      const needle = params.search.trim().toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.cityName.toLowerCase().includes(needle) ||
          c.description.toLowerCase().includes(needle),
      );
    }
    // Tri stable par numéro : l'ordre d'affichage « #1, #2, ... » de l'app.
    items.sort((a, b) => a.cameraNumber - b.cameraNumber);
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((c) => clone(c)),
      total: items.length,
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Signalements
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockReportsRepository implements ReportsRepository {
  constructor(private readonly db: MockDatabaseService) {}

  async create(input: CreateReportInput): Promise<Report> {
    if (!this.db.users.has(input.reporterId)) {
      throw new Error(`Utilisateur introuvable : ${input.reporterId}.`);
    }
    // Miroir de la contrainte UNIQUE reports_reporter_target_unique : un
    // même utilisateur ne signale une cible qu'UNE seule fois. Erreur TYPÉE
    // (UniqueViolationError) : le service la traduit en 409 même quand deux
    // requêtes concurrentes passent toutes deux la vérification amont
    // existsByReporterAndTarget — le futur driver postgres lèvera le même
    // type depuis l'erreur native 23505.
    if (
      await this.existsByReporterAndTarget(
        input.reporterId,
        input.targetType,
        input.targetId,
      )
    ) {
      throw new UniqueViolationError(
        'reports_reporter_target_unique',
        'Signalement en doublon : cette cible a déjà été signalée par cet ' +
          'utilisateur (contrainte UNIQUE reports_reporter_target_unique).',
      );
    }
    const report: Report = {
      id: randomUUID(),
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reasonCode: input.reasonCode,
      message: input.message ?? '',
      status: 'open',
      handledBy: null,
      handledAt: null,
      resolutionNote: null,
      createdAt: new Date(),
    };
    this.db.reports.set(report.id, report);
    return clone(report);
  }

  existsByReporterAndTarget(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<boolean> {
    for (const report of this.db.reports.values()) {
      if (
        report.reporterId === reporterId &&
        report.targetType === targetType &&
        report.targetId === targetId
      ) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  list(params: ListReportsParams): Promise<PagedResult<Report>> {
    // File de modération backoffice : filtres statut / type de cible,
    // antéchronologique (tie-break id — ordre stable), paginée.
    let items = [...this.db.reports.values()];
    if (params.status !== undefined) {
      items = items.filter((r) => r.status === params.status);
    }
    if (params.targetType !== undefined) {
      items = items.filter((r) => r.targetType === params.targetType);
    }
    items.sort((a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id));
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((r) => clone(r)),
      total: items.length,
    });
  }

  listByTarget(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<Report[]> {
    // Signalements liés à UNE cible (détail backoffice d'un post).
    return Promise.resolve(
      [...this.db.reports.values()]
        .filter((r) => r.targetType === targetType && r.targetId === targetId)
        .sort(byCreatedAtDesc)
        .map((r) => clone(r)),
    );
  }

  countOpenByTargets(
    targetType: ReportTargetType,
    targetIds: string[],
  ): Promise<Record<string, number>> {
    // Comptage PAR LOT des signalements 'open' (openReportsCount d'une page
    // de la liste admin) — équivalent d'un GROUP BY target_id WHERE status
    // = 'open' côté SQL ; les cibles sans signalement ouvert sont absentes.
    const wanted = new Set(targetIds);
    const counts: Record<string, number> = {};
    for (const report of this.db.reports.values()) {
      if (
        report.status === 'open' &&
        report.targetType === targetType &&
        wanted.has(report.targetId)
      ) {
        counts[report.targetId] = (counts[report.targetId] ?? 0) + 1;
      }
    }
    return Promise.resolve(counts);
  }

  listByReporter(reporterId: string): Promise<Report[]> {
    // Export RGPD : signalements émis par l'utilisateur.
    return Promise.resolve(
      [...this.db.reports.values()]
        .filter((r) => r.reporterId === reporterId)
        .sort(byCreatedAtDesc)
        .map((r) => clone(r)),
    );
  }

  findById(id: string): Promise<Report | null> {
    return Promise.resolve(clone(this.db.reports.get(id) ?? null));
  }

  handle(id: string, input: HandleReportInput): Promise<Report> {
    const report = this.db.reports.get(id);
    if (!report) {
      throw new Error(`Signalement introuvable : ${id}.`);
    }
    if (!this.db.users.has(input.handledBy)) {
      throw new Error(`Modérateur introuvable : ${input.handledBy}.`);
    }
    report.status = input.status;
    report.handledBy = input.handledBy;
    report.handledAt = new Date();
    report.resolutionNote = input.resolutionNote ?? null;
    return Promise.resolve(clone(report));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Notifications
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockNotificationsRepository implements NotificationsRepository {
  constructor(private readonly db: MockDatabaseService) {}

  create(input: CreateNotificationInput): Promise<Notification> {
    if (!this.db.users.has(input.userId)) {
      throw new Error(`Utilisateur introuvable : ${input.userId}.`);
    }
    const notification: Notification = {
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      payload: input.payload ?? {},
      readAt: null,
      createdAt: new Date(),
    };
    this.db.notifications.set(notification.id, notification);
    return Promise.resolve(clone(notification));
  }

  findById(id: string): Promise<Notification | null> {
    return Promise.resolve(clone(this.db.notifications.get(id) ?? null));
  }

  listByUser(
    userId: string,
    params: { limit: number; offset: number },
  ): Promise<Notification[]> {
    const items = [...this.db.notifications.values()]
      .filter((n) => n.userId === userId)
      .sort(byCreatedAtDesc);
    return Promise.resolve(
      items
        .slice(params.offset, params.offset + params.limit)
        .map((n) => clone(n)),
    );
  }

  markRead(id: string): Promise<void> {
    const notification = this.db.notifications.get(id);
    if (notification && notification.readAt === null) {
      notification.readAt = new Date();
    }
    return Promise.resolve();
  }

  markAllRead(userId: string): Promise<void> {
    const now = new Date();
    for (const notification of this.db.notifications.values()) {
      if (notification.userId === userId && notification.readAt === null) {
        notification.readAt = now;
      }
    }
    return Promise.resolve();
  }

  unreadCount(userId: string): Promise<number> {
    let count = 0;
    for (const notification of this.db.notifications.values()) {
      if (notification.userId === userId && notification.readAt === null) {
        count++;
      }
    }
    return Promise.resolve(count);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Dealplace — Taxonomie (catégories / sous-catégories / tags)
// ────────────────────────────────────────────────────────────────────────────

/** Tri par position croissante puis slug (tie-break) — ordre d'affichage stable
 * de la taxonomie Dealplace (miroir ORDER BY position ASC, slug ASC). */
function byPositionThenSlug(
  a: { position: number; slug: string },
  b: { position: number; slug: string },
): number {
  return a.position - b.position || a.slug.localeCompare(b.slug);
}

@Injectable()
export class MockListingTaxonomyRepository
  implements ListingTaxonomyRepository
{
  constructor(private readonly db: MockDatabaseService) {}

  listCategories(activeOnly: boolean): Promise<ListingCategory[]> {
    return Promise.resolve(
      [...this.db.listingCategories.values()]
        .filter((c) => !activeOnly || c.isActive)
        .sort(byPositionThenSlug)
        .map((c) => clone(c)),
    );
  }

  listSubcategories(
    categorySlug: string,
    activeOnly: boolean,
  ): Promise<ListingSubcategory[]> {
    return Promise.resolve(
      [...this.db.listingSubcategories.values()]
        .filter(
          (s) =>
            s.categorySlug === categorySlug && (!activeOnly || s.isActive),
        )
        .sort(byPositionThenSlug)
        .map((s) => clone(s)),
    );
  }

  listTags(activeOnly: boolean): Promise<ListingTag[]> {
    return Promise.resolve(
      [...this.db.listingTags.values()]
        .filter((t) => !activeOnly || t.isActive)
        .sort((a, b) => a.slug.localeCompare(b.slug))
        .map((t) => clone(t)),
    );
  }

  findCategory(slug: string): Promise<ListingCategory | null> {
    return Promise.resolve(clone(this.db.listingCategories.get(slug) ?? null));
  }

  findSubcategory(slug: string): Promise<ListingSubcategory | null> {
    return Promise.resolve(
      clone(this.db.listingSubcategories.get(slug) ?? null),
    );
  }

  findTag(slug: string): Promise<ListingTag | null> {
    return Promise.resolve(clone(this.db.listingTags.get(slug) ?? null));
  }

  createCategory(
    input: CreateListingCategoryInput,
  ): Promise<ListingCategory> {
    if (this.db.listingCategories.has(input.slug)) {
      throw new Error(
        `Catégorie déjà existante : « ${input.slug} » (PK slug).`,
      );
    }
    const now = new Date();
    const category: ListingCategory = {
      slug: input.slug,
      family: input.family,
      labelFr: input.labelFr,
      position: input.position,
      moderationLevel: input.moderationLevel ?? 'standard',
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.db.listingCategories.set(category.slug, category);
    return Promise.resolve(clone(category));
  }

  updateCategory(
    slug: string,
    patch: UpdateListingCategoryPatch,
  ): Promise<ListingCategory> {
    const category = this.db.listingCategories.get(slug);
    if (!category) {
      throw new Error(`Catégorie introuvable : « ${slug} ».`);
    }
    applyPatch(category, patch);
    this.db.touch(category);
    return Promise.resolve(clone(category));
  }

  createSubcategory(
    input: CreateListingSubcategoryInput,
  ): Promise<ListingSubcategory> {
    if (this.db.listingSubcategories.has(input.slug)) {
      throw new Error(
        `Sous-catégorie déjà existante : « ${input.slug} » (PK slug).`,
      );
    }
    if (!this.db.listingCategories.has(input.categorySlug)) {
      throw new Error(
        `Catégorie inconnue : « ${input.categorySlug} » (FK listing_categories).`,
      );
    }
    const now = new Date();
    const subcategory: ListingSubcategory = {
      slug: input.slug,
      categorySlug: input.categorySlug,
      labelFr: input.labelFr,
      position: input.position,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.db.listingSubcategories.set(subcategory.slug, subcategory);
    return Promise.resolve(clone(subcategory));
  }

  updateSubcategory(
    slug: string,
    patch: UpdateListingSubcategoryPatch,
  ): Promise<ListingSubcategory> {
    const subcategory = this.db.listingSubcategories.get(slug);
    if (!subcategory) {
      throw new Error(`Sous-catégorie introuvable : « ${slug} ».`);
    }
    applyPatch(subcategory, patch);
    this.db.touch(subcategory);
    return Promise.resolve(clone(subcategory));
  }

  createTag(input: CreateListingTagInput): Promise<ListingTag> {
    if (this.db.listingTags.has(input.slug)) {
      throw new Error(`Tag déjà existant : « ${input.slug} » (PK slug).`);
    }
    const now = new Date();
    const tag: ListingTag = {
      slug: input.slug,
      labelFr: input.labelFr,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.db.listingTags.set(tag.slug, tag);
    return Promise.resolve(clone(tag));
  }

  updateTag(slug: string, patch: UpdateListingTagPatch): Promise<ListingTag> {
    const tag = this.db.listingTags.get(slug);
    if (!tag) {
      throw new Error(`Tag introuvable : « ${slug} ».`);
    }
    applyPatch(tag, patch);
    this.db.touch(tag);
    return Promise.resolve(clone(tag));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Dealplace — Annonces (listings)
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockListingsRepository implements ListingsRepository {
  constructor(private readonly db: MockDatabaseService) {}

  findById(id: string): Promise<Listing | null> {
    return Promise.resolve(clone(this.db.listings.get(id) ?? null));
  }

  findByIds(ids: string[]): Promise<Listing[]> {
    // Chargement par lot (cartes de conversations — CP2.3) : les ids inconnus
    // sont ignorés silencieusement — équivalent d'un WHERE id = ANY($1).
    const listings: Listing[] = [];
    for (const id of new Set(ids)) {
      const listing = this.db.listings.get(id);
      if (listing) {
        listings.push(clone(listing));
      }
    }
    return Promise.resolve(listings);
  }

  findByUrlSlug(urlSlug: string): Promise<Listing | null> {
    for (const listing of this.db.listings.values()) {
      if (listing.urlSlug === urlSlug) {
        return Promise.resolve(clone(listing));
      }
    }
    return Promise.resolve(null);
  }

  async create(input: CreateListingInput): Promise<Listing> {
    // FK / contraintes structurelles (les règles métier — photo obligatoire,
    // catégorie 'forbidden' refusée, commune du référentiel — vivent au SERVICE
    // en phase suivante ; ici on reproduit ce qui est garanti par le SCHÉMA).
    if (!this.db.users.has(input.ownerId)) {
      throw new Error(`Propriétaire introuvable : ${input.ownerId}.`);
    }
    const category = this.db.listingCategories.get(input.categorySlug);
    if (!category) {
      throw new Error(
        `Catégorie inconnue : « ${input.categorySlug} » (FK listing_categories).`,
      );
    }
    const subcategory = this.db.listingSubcategories.get(input.subcategorySlug);
    if (!subcategory) {
      throw new Error(
        `Sous-catégorie inconnue : « ${input.subcategorySlug} » (FK listing_subcategories).`,
      );
    }
    if (await this.findByUrlSlug(input.urlSlug)) {
      throw new Error(
        `url_slug déjà utilisé : « ${input.urlSlug} » (contrainte UNIQUE).`,
      );
    }
    // Cohérence value_kind / value_max (miroir de listings_value_kind_max_ck).
    if (input.valueMin < 0) {
      throw new Error('value_min doit être >= 0.');
    }
    if (input.valueKind === 'fixed' && input.valueMax != null) {
      throw new Error("value_kind='fixed' interdit une value_max.");
    }
    if (input.valueKind === 'range') {
      if (input.valueMax == null) {
        throw new Error("value_kind='range' exige une value_max.");
      }
      if (input.valueMax < input.valueMin) {
        throw new Error('value_max doit être >= value_min (fourchette).');
      }
    }
    // exchange_prefs non vide (miroir de listings_exchange_prefs_nonempty_ck).
    if (input.exchangePrefs.length === 0) {
      throw new Error(
        'exchange_prefs doit être un sous-ensemble non vide (goods/services/money/open).',
      );
    }
    // Tags : chacun doit exister (FK listing_tags). Dédoublonnés (PK composite).
    const tagSlugs = [...new Set(input.tagSlugs ?? [])];
    for (const tagSlug of tagSlugs) {
      if (!this.db.listingTags.has(tagSlug)) {
        throw new Error(
          `Tag inconnu : « ${tagSlug} » (FK listing_tags).`,
        );
      }
    }

    const now = new Date();
    const listing: Listing = {
      id: randomUUID(),
      ownerId: input.ownerId,
      listingType: input.listingType,
      title: input.title,
      description: input.description,
      categorySlug: input.categorySlug,
      subcategorySlug: input.subcategorySlug,
      valueKind: input.valueKind,
      valueMin: input.valueMin,
      valueMax: input.valueKind === 'range' ? (input.valueMax as number) : null,
      currency: input.currency ?? 'EUR',
      city: input.city,
      location: input.location ?? null,
      exchangePrefs: [...input.exchangePrefs],
      externalLinks: (input.externalLinks ?? []).map((l) => ({ ...l })),
      urlSlug: input.urlSlug,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.db.listings.set(listing.id, listing);
    // Médias créés ATOMIQUEMENT avec l'annonce (équivalent transaction SQL) —
    // position par défaut : l'index dans le tableau fourni.
    (input.media ?? []).forEach((spec, index) => {
      const media: ListingMedia = {
        id: randomUUID(),
        listingId: listing.id,
        mediaType: spec.mediaType,
        url: spec.url,
        thumbnailUrl: spec.thumbnailUrl ?? null,
        width: spec.width ?? null,
        height: spec.height ?? null,
        position: spec.position ?? index,
        createdAt: now,
      };
      this.db.listingMedia.set(media.id, media);
    });
    // Tags créés ATOMIQUEMENT (PK composite (listing_id, tag_slug)).
    for (const tagSlug of tagSlugs) {
      this.db.listingTagMap.push({ listingId: listing.id, tagSlug });
    }
    return clone(listing);
  }

  update(id: string, patch: UpdateListingPatch): Promise<Listing> {
    const listing = this.db.listings.get(id);
    if (!listing) {
      throw new Error(`Annonce introuvable : ${id}.`);
    }
    // Cohérence FK si la catégorie/sous-catégorie change.
    if (
      patch.categorySlug !== undefined &&
      !this.db.listingCategories.has(patch.categorySlug)
    ) {
      throw new Error(
        `Catégorie inconnue : « ${patch.categorySlug} » (FK listing_categories).`,
      );
    }
    if (
      patch.subcategorySlug !== undefined &&
      !this.db.listingSubcategories.has(patch.subcategorySlug)
    ) {
      throw new Error(
        `Sous-catégorie inconnue : « ${patch.subcategorySlug} » (FK listing_subcategories).`,
      );
    }
    applyPatch(listing, patch);
    // Cohérence value_kind / value_max après application du patch.
    if (listing.valueKind === 'fixed') {
      listing.valueMax = null;
    } else if (listing.valueMax == null || listing.valueMax < listing.valueMin) {
      throw new Error(
        "value_kind='range' exige value_max >= value_min après mise à jour.",
      );
    }
    if (listing.exchangePrefs.length === 0) {
      throw new Error('exchange_prefs doit rester non vide.');
    }
    this.db.touch(listing);
    return Promise.resolve(clone(listing));
  }

  setTags(id: string, tagSlugs: string[]): Promise<void> {
    if (!this.db.listings.has(id)) {
      throw new Error(`Annonce introuvable : ${id}.`);
    }
    const unique = [...new Set(tagSlugs)];
    for (const tagSlug of unique) {
      if (!this.db.listingTags.has(tagSlug)) {
        throw new Error(`Tag inconnu : « ${tagSlug} » (FK listing_tags).`);
      }
    }
    // Remplacement intégral : purge les liens existants (en place, l'array est
    // readonly par sa référence), réinsère (PK composite (listing_id, tag_slug)).
    for (let i = this.db.listingTagMap.length - 1; i >= 0; i--) {
      if (this.db.listingTagMap[i].listingId === id) {
        this.db.listingTagMap.splice(i, 1);
      }
    }
    for (const tagSlug of unique) {
      this.db.listingTagMap.push({ listingId: id, tagSlug });
    }
    return Promise.resolve();
  }

  setStatus(id: string, status: ListingStatus): Promise<Listing> {
    const listing = this.db.listings.get(id);
    if (!listing) {
      throw new Error(`Annonce introuvable : ${id}.`);
    }
    listing.status = status;
    // Soft-delete : on pose deleted_at (miroir de la colonne du même nom).
    listing.deletedAt = status === 'deleted' ? new Date() : null;
    this.db.touch(listing);
    return Promise.resolve(clone(listing));
  }

  /** Slugs de tags d'UNE annonce (triés) — utilisé par les filtres. */
  private tagSlugsOf(listingId: string): string[] {
    return this.db.listingTagMap
      .filter((m) => m.listingId === listingId)
      .map((m) => m.tagSlug)
      .sort((a, b) => a.localeCompare(b));
  }

  listPublic(
    params: ListPublicListingsParams,
  ): Promise<PagedResult<Listing>> {
    // Annuaire public : annonces 'active' uniquement.
    let items = [...this.db.listings.values()].filter(
      (l) => l.status === 'active',
    );
    if (params.family !== undefined) {
      items = items.filter((l) => l.listingType === params.family);
    }
    if (params.categorySlug !== undefined) {
      items = items.filter((l) => l.categorySlug === params.categorySlug);
    }
    if (params.subcategorySlug !== undefined) {
      items = items.filter((l) => l.subcategorySlug === params.subcategorySlug);
    }
    if (params.city !== undefined) {
      const needle = params.city.trim().toLowerCase();
      items = items.filter((l) => l.city.toLowerCase() === needle);
    }
    if (params.valueMin !== undefined) {
      // Borne basse : la valeur (min pour un prix fixe, min de la fourchette)
      // doit être >= au plancher demandé.
      items = items.filter((l) => l.valueMin >= (params.valueMin as number));
    }
    if (params.valueMax !== undefined) {
      // Borne haute : la valeur haute effective (valueMax si fourchette, sinon
      // valueMin) doit être <= au plafond demandé.
      items = items.filter(
        (l) => (l.valueMax ?? l.valueMin) <= (params.valueMax as number),
      );
    }
    if (params.tagSlugs !== undefined && params.tagSlugs.length > 0) {
      const wanted = params.tagSlugs;
      items = items.filter((l) => {
        const have = new Set(this.tagSlugsOf(l.id));
        return wanted.every((t) => have.has(t));
      });
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      const needle = params.search.trim().toLowerCase();
      items = items.filter(
        (l) =>
          l.title.toLowerCase().includes(needle) ||
          l.description.toLowerCase().includes(needle),
      );
    }
    // Antéchronologique, tie-break id : ordre STABLE entre deux pages.
    items.sort((a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id));
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((l) => clone(l)),
      total: items.length,
    });
  }

  listByOwner(
    ownerId: string,
    params: ListOwnerListingsParams,
  ): Promise<PagedResult<Listing>> {
    const statuses =
      params.statuses !== undefined ? new Set(params.statuses) : null;
    const items = [...this.db.listings.values()]
      .filter(
        (l) =>
          l.ownerId === ownerId &&
          (statuses === null || statuses.has(l.status)) &&
          // Filtre famille (sections Services / Biens du profil — CP2.2).
          (params.family === undefined || l.listingType === params.family),
      )
      .sort((a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id));
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((l) => clone(l)),
      total: items.length,
    });
  }

  listAdmin(params: AdminListListingsParams): Promise<PagedResult<Listing>> {
    // Liste BACKOFFICE : tous statuts par défaut (y compris 'deleted' — audit),
    // recherche insensible à la casse sur titre, description et nom du
    // propriétaire. Le driver postgres fera un JOIN users + ILIKE.
    let items = [...this.db.listings.values()];
    if (params.family !== undefined) {
      items = items.filter((l) => l.listingType === params.family);
    }
    if (params.categorySlug !== undefined) {
      items = items.filter((l) => l.categorySlug === params.categorySlug);
    }
    if (params.status !== undefined) {
      items = items.filter((l) => l.status === params.status);
    }
    if (params.flaggedOnly !== undefined) {
      // « Marquée » = catégorie de niveau sensitive/forbidden (champ dérivé de
      // la modération). flaggedOnly=true : seules ces annonces ; false : les
      // annonces de catégorie 'standard'.
      items = items.filter((l) => {
        const level =
          this.db.listingCategories.get(l.categorySlug)?.moderationLevel ??
          'standard';
        const flagged = level !== 'standard';
        return params.flaggedOnly ? flagged : !flagged;
      });
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      const needle = params.search.trim().toLowerCase();
      items = items.filter((l) => {
        const ownerName =
          this.db.users.get(l.ownerId)?.displayName.toLowerCase() ?? '';
        return (
          l.title.toLowerCase().includes(needle) ||
          l.description.toLowerCase().includes(needle) ||
          ownerName.includes(needle)
        );
      });
    }
    items.sort((a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id));
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((l) => clone(l)),
      total: items.length,
    });
  }

  listMediaByListingIds(listingIds: string[]): Promise<ListingMedia[]> {
    // Lecture PAR LOT des médias d'une page d'annuaire (évite les N+1) —
    // triés par position croissante (regroupement par annonce à l'appelant,
    // comme un WHERE listing_id = ANY($1) ORDER BY position).
    const wanted = new Set(listingIds);
    return Promise.resolve(
      [...this.db.listingMedia.values()]
        .filter((m) => wanted.has(m.listingId))
        .sort((a, b) => a.position - b.position || byCreatedAtAsc(a, b))
        .map((m) => clone(m)),
    );
  }

  listTagsByListingIds(
    listingIds: string[],
  ): Promise<Record<string, string[]>> {
    // Slugs de tags PAR LOT : { listingId → slugs[] } (slugs triés) ; les
    // annonces sans tag sont absentes du résultat.
    const wanted = new Set(listingIds);
    const result: Record<string, string[]> = {};
    for (const entry of this.db.listingTagMap) {
      if (!wanted.has(entry.listingId)) {
        continue;
      }
      (result[entry.listingId] ??= []).push(entry.tagSlug);
    }
    for (const listingId of Object.keys(result)) {
      result[listingId].sort((a, b) => a.localeCompare(b));
    }
    return Promise.resolve(result);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Conversations 1-to-1 (Lot 2 — CP2.3)
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockConversationsRepository implements ConversationsRepository {
  constructor(private readonly db: MockDatabaseService) {}

  findById(id: string): Promise<Conversation | null> {
    return Promise.resolve(clone(this.db.conversations.get(id) ?? null));
  }

  findByListingAndInitiator(
    listingId: string,
    initiatorId: string,
  ): Promise<Conversation | null> {
    for (const conversation of this.db.conversations.values()) {
      if (
        conversation.listingId === listingId &&
        conversation.initiatorId === initiatorId
      ) {
        return Promise.resolve(clone(conversation));
      }
    }
    return Promise.resolve(null);
  }

  findByPageAndInitiator(
    pageId: string,
    initiatorId: string,
  ): Promise<Conversation | null> {
    // Miroir de findByListingAndInitiator pour les fils de PAGE (Lot 3 — D75).
    for (const conversation of this.db.conversations.values()) {
      if (
        conversation.pageId === pageId &&
        conversation.initiatorId === initiatorId
      ) {
        return Promise.resolve(clone(conversation));
      }
    }
    return Promise.resolve(null);
  }

  async create(input: CreateConversationInput): Promise<Conversation> {
    // Contraintes structurelles (miroir du SCHÉMA — les règles métier vivent
    // au service) : exactement UNE cible annonce/page (CHECK — D75), FK
    // cible/participants, participants distincts (CHECK), unicité
    // (cible, initiateur).
    const listingId = input.listingId ?? null;
    const pageId = input.pageId ?? null;
    if ((listingId === null) === (pageId === null)) {
      throw new Error(
        'Une conversation exige exactement une cible : annonce OU page (CHECK).',
      );
    }
    if (listingId !== null && !this.db.listings.has(listingId)) {
      throw new Error(`Annonce introuvable : ${listingId} (FK listings).`);
    }
    if (pageId !== null && !this.db.pages.has(pageId)) {
      throw new Error(`Page introuvable : ${pageId} (FK pages).`);
    }
    if (!this.db.users.has(input.initiatorId)) {
      throw new Error(`Utilisateur introuvable : ${input.initiatorId}.`);
    }
    if (!this.db.users.has(input.ownerId)) {
      throw new Error(`Utilisateur introuvable : ${input.ownerId}.`);
    }
    if (input.initiatorId === input.ownerId) {
      throw new Error(
        'Une conversation exige deux participants distincts (CHECK).',
      );
    }
    if (
      listingId !== null &&
      (await this.findByListingAndInitiator(listingId, input.initiatorId))
    ) {
      throw new Error(
        'Conversation déjà existante pour cette annonce et ce demandeur (contrainte UNIQUE).',
      );
    }
    if (
      pageId !== null &&
      (await this.findByPageAndInitiator(pageId, input.initiatorId))
    ) {
      throw new Error(
        'Conversation déjà existante pour cette page et ce demandeur (contrainte UNIQUE).',
      );
    }
    const now = new Date();
    const conversation: Conversation = {
      id: randomUUID(),
      listingId,
      pageId,
      initiatorId: input.initiatorId,
      ownerId: input.ownerId,
      initiatorLastReadAt: null,
      ownerLastReadAt: null,
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.conversations.set(conversation.id, conversation);
    return clone(conversation);
  }

  listByParticipant(
    userId: string,
    params: PageParams,
  ): Promise<PagedResult<Conversation>> {
    // Tri par ACTIVITÉ décroissante : lastMessageAt, sinon createdAt
    // (conversation toute neuve) — tie-break id, ordre STABLE entre pages.
    const items = [...this.db.conversations.values()]
      .filter((c) => c.initiatorId === userId || c.ownerId === userId)
      .sort((a, b) => {
        const activityA = (a.lastMessageAt ?? a.createdAt).getTime();
        const activityB = (b.lastMessageAt ?? b.createdAt).getTime();
        return activityB - activityA || a.id.localeCompare(b.id);
      });
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((c) => clone(c)),
      total: items.length,
    });
  }

  countUnreadConversations(userId: string): Promise<number> {
    let count = 0;
    for (const conversation of this.db.conversations.values()) {
      if (
        conversation.initiatorId !== userId &&
        conversation.ownerId !== userId
      ) {
        continue;
      }
      if (this.hasUnread(conversation, userId)) {
        count++;
      }
    }
    return Promise.resolve(count);
  }

  unreadCountsByConversationIds(
    conversationIds: string[],
    userId: string,
  ): Promise<Record<string, number>> {
    // Non-lus PAR conversation, EN UN APPEL (page de cartes — anti N+1) ;
    // les conversations sans non-lu sont ABSENTES du résultat.
    const wanted = new Set(conversationIds);
    const result: Record<string, number> = {};
    for (const message of this.db.messages.values()) {
      if (!wanted.has(message.conversationId)) {
        continue;
      }
      const conversation = this.db.conversations.get(message.conversationId);
      if (!conversation || !this.isUnreadFor(conversation, message, userId)) {
        continue;
      }
      result[message.conversationId] =
        (result[message.conversationId] ?? 0) + 1;
    }
    return Promise.resolve(result);
  }

  lastMessagesByConversationIds(
    conversationIds: string[],
  ): Promise<Record<string, Message>> {
    // Dernier message PAR conversation, EN UN APPEL (tie-break id — miroir
    // d'un DISTINCT ON (conversation_id) ... ORDER BY created_at DESC, id).
    const wanted = new Set(conversationIds);
    const result: Record<string, Message> = {};
    for (const message of this.db.messages.values()) {
      if (!wanted.has(message.conversationId)) {
        continue;
      }
      const current = result[message.conversationId];
      if (
        !current ||
        message.createdAt.getTime() > current.createdAt.getTime() ||
        (message.createdAt.getTime() === current.createdAt.getTime() &&
          message.id.localeCompare(current.id) < 0)
      ) {
        result[message.conversationId] = message;
      }
    }
    for (const key of Object.keys(result)) {
      result[key] = clone(result[key]);
    }
    return Promise.resolve(result);
  }

  markRead(conversationId: string, userId: string, at: Date): Promise<void> {
    const conversation = this.db.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation introuvable : ${conversationId}.`);
    }
    // L'appelant (service) a déjà vérifié l'appartenance : on pose le jalon
    // du bon participant.
    if (conversation.initiatorId === userId) {
      conversation.initiatorLastReadAt = new Date(at.getTime());
    } else {
      conversation.ownerLastReadAt = new Date(at.getTime());
    }
    this.db.touch(conversation);
    return Promise.resolve();
  }

  createMessage(input: CreateMessageInput): Promise<Message> {
    const conversation = this.db.conversations.get(input.conversationId);
    if (!conversation) {
      throw new Error(`Conversation introuvable : ${input.conversationId}.`);
    }
    if (!this.db.users.has(input.senderId)) {
      throw new Error(`Utilisateur introuvable : ${input.senderId}.`);
    }
    const now = new Date();
    const message: Message = {
      id: randomUUID(),
      conversationId: input.conversationId,
      senderId: input.senderId,
      body: input.body,
      // Tout message naît 'active' — 'hidden' est réservé à la modération
      // backoffice (CP2.5, D67).
      status: 'active',
      createdAt: now,
    };
    this.db.messages.set(message.id, message);
    // last_message_at posé ATOMIQUEMENT avec l'INSERT (équivalent transaction
    // SQL — décision D63 : seul horodatage dénormalisé à l'écriture).
    conversation.lastMessageAt = now;
    this.db.touch(conversation);
    return Promise.resolve(clone(message));
  }

  listMessages(
    conversationId: string,
    params: PageParams,
  ): Promise<PagedResult<Message>> {
    // Du PLUS RÉCENT au plus ancien (le client inverse pour l'affichage),
    // tie-break id — ordre stable entre pages. Les messages 'hidden' SONT
    // inclus (D67 : pagination et non-lus inchangés, le corps est remplacé
    // par le SERVICE pour les participants).
    const items = [...this.db.messages.values()]
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id));
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((m) => clone(m)),
      total: items.length,
    });
  }

  // ── Backoffice (CP2.5 — D67) ───────────────────────────────────────────────

  listAdmin(
    params: AdminListConversationsParams,
  ): Promise<PagedResult<Conversation>> {
    // TOUTES les conversations, même tri par ACTIVITÉ que listByParticipant
    // (lastMessageAt ?? createdAt DESC, tie-break id). Recherche insensible à
    // la casse sur le nom affiché d'un participant, le titre de l'annonce ou
    // le nom de la page liée (Lot 3 — D75).
    let items = [...this.db.conversations.values()];
    if (params.search !== undefined && params.search.trim() !== '') {
      const needle = params.search.trim().toLowerCase();
      items = items.filter((c) => {
        const initiator = this.db.users.get(c.initiatorId);
        const owner = this.db.users.get(c.ownerId);
        const listing =
          c.listingId !== null ? this.db.listings.get(c.listingId) : undefined;
        const page =
          c.pageId !== null ? this.db.pages.get(c.pageId) : undefined;
        return (
          (initiator?.displayName ?? '').toLowerCase().includes(needle) ||
          (owner?.displayName ?? '').toLowerCase().includes(needle) ||
          (listing?.title ?? '').toLowerCase().includes(needle) ||
          (page?.name ?? '').toLowerCase().includes(needle)
        );
      });
    }
    items.sort((a, b) => {
      const activityA = (a.lastMessageAt ?? a.createdAt).getTime();
      const activityB = (b.lastMessageAt ?? b.createdAt).getTime();
      return activityB - activityA || a.id.localeCompare(b.id);
    });
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((c) => clone(c)),
      total: items.length,
    });
  }

  findMessageById(id: string): Promise<Message | null> {
    return Promise.resolve(clone(this.db.messages.get(id) ?? null));
  }

  setMessageStatus(id: string, status: MessageStatus): Promise<Message> {
    const message = this.db.messages.get(id);
    if (!message) {
      throw new Error(`Message introuvable : ${id}.`);
    }
    // Idempotent — reposer le même statut est sans effet.
    message.status = status;
    return Promise.resolve(clone(message));
  }

  /** Jalon de lecture du participant userId dans cette conversation. */
  private lastReadOf(conversation: Conversation, userId: string): Date | null {
    return conversation.initiatorId === userId
      ? conversation.initiatorLastReadAt
      : conversation.ownerLastReadAt;
  }

  /** Un message est NON LU pour userId s'il vient de l'AUTRE participant et
   * est postérieur à son jalon de lecture (null = tout est non lu). */
  private isUnreadFor(
    conversation: Conversation,
    message: Message,
    userId: string,
  ): boolean {
    if (message.senderId === userId) {
      return false;
    }
    const lastRead = this.lastReadOf(conversation, userId);
    return (
      lastRead === null || message.createdAt.getTime() > lastRead.getTime()
    );
  }

  /** Au moins un message non lu pour userId dans cette conversation ? */
  private hasUnread(conversation: Conversation, userId: string): boolean {
    for (const message of this.db.messages.values()) {
      if (
        message.conversationId === conversation.id &&
        this.isUnreadFor(conversation, message, userId)
      ) {
        return true;
      }
    }
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Deals contractuels + avis (Lot 2 — CP2.4)
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockDealsRepository implements DealsRepository {
  constructor(private readonly db: MockDatabaseService) {}

  findById(id: string): Promise<Deal | null> {
    return Promise.resolve(clone(this.db.deals.get(id) ?? null));
  }

  create(input: CreateDealInput): Promise<Deal> {
    // Contraintes structurelles (miroir du SCHÉMA — la machine à états et les
    // règles métier vivent au SERVICE) : FK annonce/participants/conversation,
    // parties distinctes (CHECK).
    if (!this.db.listings.has(input.listingId)) {
      throw new Error(
        `Annonce introuvable : ${input.listingId} (FK listings).`,
      );
    }
    for (const userId of [input.proposerId, input.recipientId]) {
      if (!this.db.users.has(userId)) {
        throw new Error(`Utilisateur introuvable : ${userId}.`);
      }
    }
    if (input.proposerId === input.recipientId) {
      throw new Error('Un deal exige deux parties distinctes (CHECK).');
    }
    if (
      input.conversationId !== null &&
      !this.db.conversations.has(input.conversationId)
    ) {
      throw new Error(
        `Conversation introuvable : ${input.conversationId} (FK conversations).`,
      );
    }
    const now = new Date();
    const deal: Deal = {
      id: randomUUID(),
      dealNumber: this.db.nextDealNumber(),
      listingId: input.listingId,
      conversationId: input.conversationId,
      proposerId: input.proposerId,
      recipientId: input.recipientId,
      status: 'proposed',
      dueDate: input.dueDate ?? null,
      cancellationRequestedBy: null,
      disputedBy: null,
      disputeReason: null,
      disputeResolvedBy: null,
      disputeResolvedAt: null,
      disputeResolution: null,
      disputeResolutionNote: null,
      acceptedAt: null,
      completedAt: null,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.deals.set(deal.id, deal);
    // Éléments + sous-éléments créés ATOMIQUEMENT avec le deal.
    input.items.forEach((spec, index) => {
      this.insertItem(deal.id, spec, index, now);
    });
    return Promise.resolve(clone(deal));
  }

  update(id: string, patch: UpdateDealPatch): Promise<Deal> {
    const deal = this.db.deals.get(id);
    if (!deal) {
      throw new Error(`Deal introuvable : ${id}.`);
    }
    applyPatch(deal, patch);
    this.db.touch(deal);
    return Promise.resolve(clone(deal));
  }

  listByParticipant(
    userId: string,
    params: ListDealsParams,
  ): Promise<PagedResult<Deal>> {
    // Du plus récemment ACTIF au plus ancien (updatedAt DESC, tie-break id).
    let items = [...this.db.deals.values()].filter(
      (d) => d.proposerId === userId || d.recipientId === userId,
    );
    if (params.status !== undefined) {
      items = items.filter((d) => d.status === params.status);
    }
    items.sort(
      (a, b) =>
        b.updatedAt.getTime() - a.updatedAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((d) => clone(d)),
      total: items.length,
    });
  }

  listAdmin(params: AdminListDealsParams): Promise<PagedResult<Deal>> {
    // Liste BACKOFFICE (CP2.5 — D66) : tous statuts, convention des listes
    // admin (createdAt DESC, tie-break id). Recherche insensible à la casse
    // sur le nom d'une des parties ou le titre de l'annonce ; une saisie
    // entièrement numérique matche AUSSI le numéro exact du deal.
    let items = [...this.db.deals.values()];
    if (params.status !== undefined) {
      items = items.filter((d) => d.status === params.status);
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      const needle = params.search.trim().toLowerCase();
      const asNumber = /^\d+$/.test(needle) ? Number(needle) : null;
      items = items.filter((d) => {
        if (asNumber !== null && d.dealNumber === asNumber) {
          return true;
        }
        const proposer = this.db.users.get(d.proposerId);
        const recipient = this.db.users.get(d.recipientId);
        const listing = this.db.listings.get(d.listingId);
        return (
          (proposer?.displayName ?? '').toLowerCase().includes(needle) ||
          (recipient?.displayName ?? '').toLowerCase().includes(needle) ||
          (listing?.title ?? '').toLowerCase().includes(needle)
        );
      });
    }
    items.sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((d) => clone(d)),
      total: items.length,
    });
  }

  findOpenBetween(
    listingId: string,
    userA: string,
    userB: string,
  ): Promise<Deal | null> {
    // Deal OUVERT (proposed|active) entre les deux, quel que soit le sens —
    // le plus récent d'abord (au plus un par la règle métier du service).
    const candidates = [...this.db.deals.values()]
      .filter(
        (d) =>
          d.listingId === listingId &&
          (d.status === 'proposed' || d.status === 'active') &&
          ((d.proposerId === userA && d.recipientId === userB) ||
            (d.proposerId === userB && d.recipientId === userA)),
      )
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
    return Promise.resolve(candidates.length > 0 ? clone(candidates[0]) : null);
  }

  findOpenByConversation(conversationId: string): Promise<Deal | null> {
    const candidates = [...this.db.deals.values()]
      .filter(
        (d) =>
          d.conversationId === conversationId &&
          (d.status === 'proposed' || d.status === 'active'),
      )
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
    return Promise.resolve(candidates.length > 0 ? clone(candidates[0]) : null);
  }

  countCompletedByParticipant(userId: string): Promise<number> {
    let count = 0;
    for (const deal of this.db.deals.values()) {
      if (
        deal.status === 'completed' &&
        (deal.proposerId === userId || deal.recipientId === userId)
      ) {
        count++;
      }
    }
    return Promise.resolve(count);
  }

  listCompletedByParticipant(
    userId: string,
    params: PageParams,
  ): Promise<PagedResult<Deal>> {
    const items = [...this.db.deals.values()]
      .filter(
        (d) =>
          d.status === 'completed' &&
          (d.proposerId === userId || d.recipientId === userId),
      )
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0) ||
          a.id.localeCompare(b.id),
      );
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((d) => clone(d)),
      total: items.length,
    });
  }

  // ── Éléments & sous-éléments ───────────────────────────────────────────────

  listItems(dealId: string): Promise<DealItem[]> {
    return Promise.resolve(
      [...this.db.dealItems.values()]
        .filter((i) => i.dealId === dealId)
        .sort(this.byItemOrder)
        .map((i) => clone(i)),
    );
  }

  listItemsByDealIds(
    dealIds: string[],
  ): Promise<Record<string, DealItem[]>> {
    const wanted = new Set(dealIds);
    const result: Record<string, DealItem[]> = {};
    for (const item of this.db.dealItems.values()) {
      if (!wanted.has(item.dealId)) {
        continue;
      }
      (result[item.dealId] ??= []).push(clone(item));
    }
    for (const dealId of Object.keys(result)) {
      result[dealId].sort(this.byItemOrder);
    }
    return Promise.resolve(result);
  }

  findItemById(itemId: string): Promise<DealItem | null> {
    return Promise.resolve(clone(this.db.dealItems.get(itemId) ?? null));
  }

  listSteps(itemIds: string[]): Promise<DealItemStep[]> {
    const wanted = new Set(itemIds);
    return Promise.resolve(
      [...this.db.dealItemSteps.values()]
        .filter((s) => wanted.has(s.itemId))
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        .map((s) => clone(s)),
    );
  }

  findStepById(stepId: string): Promise<DealItemStep | null> {
    return Promise.resolve(clone(this.db.dealItemSteps.get(stepId) ?? null));
  }

  replaceItems(dealId: string, items: CreateDealItemSpec[]): Promise<void> {
    if (!this.db.deals.has(dealId)) {
      throw new Error(`Deal introuvable : ${dealId}.`);
    }
    // Purge éléments + sous-éléments (équivalent DELETE CASCADE) puis
    // réinsertion — atomique.
    for (const [id, item] of [...this.db.dealItems.entries()]) {
      if (item.dealId === dealId) {
        this.db.dealItems.delete(id);
        for (const [stepId, step] of [...this.db.dealItemSteps.entries()]) {
          if (step.itemId === id) {
            this.db.dealItemSteps.delete(stepId);
          }
        }
      }
    }
    const now = new Date();
    items.forEach((spec, index) => this.insertItem(dealId, spec, index, now));
    return Promise.resolve();
  }

  addItem(dealId: string, spec: CreateDealItemSpec): Promise<DealItem> {
    if (!this.db.deals.has(dealId)) {
      throw new Error(`Deal introuvable : ${dealId}.`);
    }
    // Position : après le dernier élément existant.
    let maxPosition = -1;
    for (const item of this.db.dealItems.values()) {
      if (item.dealId === dealId && item.position > maxPosition) {
        maxPosition = item.position;
      }
    }
    const created = this.insertItem(
      dealId,
      { ...spec, position: spec.position ?? maxPosition + 1 },
      maxPosition + 1,
      new Date(),
    );
    return Promise.resolve(clone(created));
  }

  updateItem(itemId: string, patch: UpdateDealItemPatch): Promise<DealItem> {
    const item = this.db.dealItems.get(itemId);
    if (!item) {
      throw new Error(`Élément introuvable : ${itemId}.`);
    }
    applyPatch(item, patch);
    return Promise.resolve(clone(item));
  }

  removeItem(itemId: string): Promise<void> {
    if (!this.db.dealItems.delete(itemId)) {
      throw new Error(`Élément introuvable : ${itemId}.`);
    }
    for (const [stepId, step] of [...this.db.dealItemSteps.entries()]) {
      if (step.itemId === itemId) {
        this.db.dealItemSteps.delete(stepId);
      }
    }
    return Promise.resolve();
  }

  honorStep(stepId: string, at: Date): Promise<DealItemStep> {
    const step = this.db.dealItemSteps.get(stepId);
    if (!step) {
      throw new Error(`Sous-élément introuvable : ${stepId}.`);
    }
    // Idempotent : déjà honoré = inchangé.
    if (step.honoredAt === null) {
      step.honoredAt = new Date(at.getTime());
    }
    return Promise.resolve(clone(step));
  }

  validateStep(stepId: string, at: Date): Promise<DealItemStep> {
    const step = this.db.dealItemSteps.get(stepId);
    if (!step) {
      throw new Error(`Sous-élément introuvable : ${stepId}.`);
    }
    // Le service garantit « honoré d'abord » ; on reproduit le CHECK SQL.
    if (step.honoredAt === null) {
      throw new Error(
        'Un sous-élément doit être honoré avant validation (CHECK).',
      );
    }
    if (step.validatedAt === null) {
      step.validatedAt = new Date(at.getTime());
    }
    return Promise.resolve(clone(step));
  }

  // ── Ajustements ────────────────────────────────────────────────────────────

  createAdjustment(
    input: CreateDealAdjustmentInput,
  ): Promise<DealAdjustment> {
    if (!this.db.deals.has(input.dealId)) {
      throw new Error(`Deal introuvable : ${input.dealId}.`);
    }
    const adjustment: DealAdjustment = {
      id: randomUUID(),
      dealId: input.dealId,
      proposedBy: input.proposedBy,
      kind: input.kind,
      itemId: input.itemId ?? null,
      payload: structuredClone(input.payload),
      description: input.description,
      status: 'pending',
      decidedAt: null,
      createdAt: new Date(),
    };
    this.db.dealAdjustments.set(adjustment.id, adjustment);
    return Promise.resolve(clone(adjustment));
  }

  findAdjustmentById(id: string): Promise<DealAdjustment | null> {
    return Promise.resolve(clone(this.db.dealAdjustments.get(id) ?? null));
  }

  listAdjustments(dealId: string): Promise<DealAdjustment[]> {
    return Promise.resolve(
      [...this.db.dealAdjustments.values()]
        .filter((a) => a.dealId === dealId)
        .sort((a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id))
        .map((a) => clone(a)),
    );
  }

  decideAdjustment(
    id: string,
    status: 'accepted' | 'rejected',
    at: Date,
  ): Promise<DealAdjustment> {
    const adjustment = this.db.dealAdjustments.get(id);
    if (!adjustment) {
      throw new Error(`Ajustement introuvable : ${id}.`);
    }
    adjustment.status = status;
    adjustment.decidedAt = new Date(at.getTime());
    return Promise.resolve(clone(adjustment));
  }

  // ── Notes de suivi ─────────────────────────────────────────────────────────

  createNote(input: {
    dealId: string;
    authorId: string;
    body: string;
  }): Promise<DealNote> {
    if (!this.db.deals.has(input.dealId)) {
      throw new Error(`Deal introuvable : ${input.dealId}.`);
    }
    const note: DealNote = {
      id: randomUUID(),
      dealId: input.dealId,
      authorId: input.authorId,
      body: input.body,
      createdAt: new Date(),
    };
    this.db.dealNotes.set(note.id, note);
    return Promise.resolve(clone(note));
  }

  listNotes(dealId: string): Promise<DealNote[]> {
    return Promise.resolve(
      [...this.db.dealNotes.values()]
        .filter((n) => n.dealId === dealId)
        .sort((a, b) => byCreatedAtAsc(a, b) || a.id.localeCompare(b.id))
        .map((n) => clone(n)),
    );
  }

  // ── Avis ───────────────────────────────────────────────────────────────────

  createReview(input: CreateDealReviewInput): Promise<DealReview> {
    if (!this.db.deals.has(input.dealId)) {
      throw new Error(`Deal introuvable : ${input.dealId}.`);
    }
    for (const review of this.db.dealReviews.values()) {
      if (
        review.dealId === input.dealId &&
        review.reviewerId === input.reviewerId
      ) {
        throw new Error(
          'Avis déjà déposé pour ce deal par cet évaluateur (contrainte UNIQUE).',
        );
      }
    }
    if (input.reviewerId === input.revieweeId) {
      throw new Error('Un avis exige deux parties distinctes (CHECK).');
    }
    const review: DealReview = {
      id: randomUUID(),
      dealId: input.dealId,
      reviewerId: input.reviewerId,
      revieweeId: input.revieweeId,
      ratingHonesty: input.ratingHonesty,
      ratingConformity: input.ratingConformity,
      ratingKindness: input.ratingKindness,
      comment: input.comment ?? null,
      createdAt: new Date(),
    };
    this.db.dealReviews.set(review.id, review);
    return Promise.resolve(clone(review));
  }

  listReviewsByDeal(dealId: string): Promise<DealReview[]> {
    return Promise.resolve(
      [...this.db.dealReviews.values()]
        .filter((r) => r.dealId === dealId)
        .sort((a, b) => byCreatedAtAsc(a, b) || a.id.localeCompare(b.id))
        .map((r) => clone(r)),
    );
  }

  listReviewsForUser(
    revieweeId: string,
    params: PageParams,
  ): Promise<PagedResult<DealReview>> {
    const items = [...this.db.dealReviews.values()]
      .filter((r) => r.revieweeId === revieweeId)
      .sort((a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id));
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((r) => clone(r)),
      total: items.length,
    });
  }

  reviewAggregates(revieweeId: string): Promise<DealReviewAggregates> {
    // Moyennes ARRONDIES à 2 décimales (parité stricte avec le ROUND(...,2)
    // du driver postgres).
    const received = [...this.db.dealReviews.values()].filter(
      (r) => r.revieweeId === revieweeId,
    );
    if (received.length === 0) {
      return Promise.resolve({
        count: 0,
        avgHonesty: null,
        avgConformity: null,
        avgKindness: null,
      });
    }
    const avg = (pick: (r: DealReview) => number): number =>
      Math.round(
        (received.reduce((sum, r) => sum + pick(r), 0) / received.length) *
          100,
      ) / 100;
    return Promise.resolve({
      count: received.length,
      avgHonesty: avg((r) => r.ratingHonesty),
      avgConformity: avg((r) => r.ratingConformity),
      avgKindness: avg((r) => r.ratingKindness),
    });
  }

  // ── Aides privées ──────────────────────────────────────────────────────────

  /** Tri de référence des éléments : position ASC, puis createdAt, puis id. */
  private readonly byItemOrder = (a: DealItem, b: DealItem): number =>
    a.position - b.position ||
    byCreatedAtAsc(a, b) ||
    a.id.localeCompare(b.id);

  /** Insère un élément + ses sous-éléments (le service garantit steps ≥ 1). */
  private insertItem(
    dealId: string,
    spec: CreateDealItemSpec,
    fallbackPosition: number,
    now: Date,
  ): DealItem {
    if (!this.db.users.has(spec.providerId)) {
      throw new Error(`Utilisateur introuvable : ${spec.providerId}.`);
    }
    const item: DealItem = {
      id: randomUUID(),
      dealId,
      providerId: spec.providerId,
      kind: spec.kind,
      title: spec.title,
      description: spec.description ?? '',
      value: spec.value,
      position: spec.position ?? fallbackPosition,
      createdAt: now,
    };
    this.db.dealItems.set(item.id, item);
    spec.steps.forEach((label, index) => {
      const step: DealItemStep = {
        id: randomUUID(),
        itemId: item.id,
        label,
        position: index,
        honoredAt: null,
        validatedAt: null,
      };
      this.db.dealItemSteps.set(step.id, step);
    });
    return item;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Pages restaurants & entreprises (Lot 3 — D69-D76)
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockPagesRepository implements PagesRepository {
  constructor(private readonly db: MockDatabaseService) {}

  // ── Pages ──────────────────────────────────────────────────────────────────

  findById(id: string): Promise<Page | null> {
    return Promise.resolve(clone(this.db.pages.get(id) ?? null));
  }

  findByIds(ids: string[]): Promise<Page[]> {
    // Lecture PAR LOT (posts de page d'un feed — évite les N+1) : ids
    // inconnus ignorés, ordre non garanti (comme un WHERE id = ANY($1)).
    const wanted = new Set(ids);
    return Promise.resolve(
      [...this.db.pages.values()]
        .filter((p) => wanted.has(p.id))
        .map((p) => clone(p)),
    );
  }

  findByUrlSlug(urlSlug: string): Promise<Page | null> {
    for (const page of this.db.pages.values()) {
      if (page.urlSlug === urlSlug) {
        return Promise.resolve(clone(page));
      }
    }
    return Promise.resolve(null);
  }

  async create(input: CreatePageInput): Promise<Page> {
    if (!this.db.users.has(input.ownerId)) {
      throw new Error(`Propriétaire introuvable : ${input.ownerId}.`);
    }
    if (await this.findByUrlSlug(input.urlSlug)) {
      throw new Error(
        `url_slug déjà utilisé : « ${input.urlSlug} » (contrainte UNIQUE).`,
      );
    }
    const now = new Date();
    const page: Page = {
      id: randomUUID(),
      ownerId: input.ownerId,
      pageType: input.pageType,
      name: input.name,
      urlSlug: input.urlSlug,
      bio: input.bio ?? '',
      avatarUrl: input.avatarUrl ?? null,
      coverUrl: input.coverUrl ?? null,
      city: input.city,
      location: input.location ?? null,
      phone: input.phone ?? null,
      attributes: [...(input.attributes ?? [])],
      vacationUntil: null,
      vacationMessage: null,
      verified: false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.db.pages.set(page.id, page);
    return clone(page);
  }

  update(id: string, patch: UpdatePagePatch): Promise<Page> {
    const page = this.db.pages.get(id);
    if (!page) {
      throw new Error(`Page introuvable : ${id}.`);
    }
    applyPatch(page, patch);
    if (patch.attributes !== undefined) {
      page.attributes = [...patch.attributes];
    }
    this.db.touch(page);
    return Promise.resolve(clone(page));
  }

  setStatus(id: string, status: PageStatus): Promise<Page> {
    const page = this.db.pages.get(id);
    if (!page) {
      throw new Error(`Page introuvable : ${id}.`);
    }
    page.status = status;
    page.deletedAt = status === 'deleted' ? new Date() : page.deletedAt;
    this.db.touch(page);
    return Promise.resolve(clone(page));
  }

  setVerified(id: string, verified: boolean): Promise<Page> {
    const page = this.db.pages.get(id);
    if (!page) {
      throw new Error(`Page introuvable : ${id}.`);
    }
    // Idempotent — reposer le même badge est sans effet.
    page.verified = verified;
    this.db.touch(page);
    return Promise.resolve(clone(page));
  }

  listByOwner(ownerId: string, params: ListOwnerPagesParams): Promise<Page[]> {
    // De la plus ancienne à la plus récente (ordre de création — la première
    // page du compte reste en tête), tie-break id : ordre STABLE.
    const statuses = new Set(params.statuses);
    return Promise.resolve(
      [...this.db.pages.values()]
        .filter((p) => p.ownerId === ownerId && statuses.has(p.status))
        .sort((a, b) => byCreatedAtAsc(a, b) || a.id.localeCompare(b.id))
        .map((p) => clone(p)),
    );
  }

  listAdmin(params: AdminListPagesParams): Promise<PagedResult<Page>> {
    // Liste BACKOFFICE : tous statuts par défaut, recherche insensible à la
    // casse sur nom / commune / nom affiché du propriétaire. Le driver
    // postgres fera un JOIN users + ILIKE.
    let items = [...this.db.pages.values()];
    if (params.pageType !== undefined) {
      items = items.filter((p) => p.pageType === params.pageType);
    }
    if (params.status !== undefined) {
      items = items.filter((p) => p.status === params.status);
    }
    if (params.verified !== undefined) {
      items = items.filter((p) => p.verified === params.verified);
    }
    if (params.flaggedOnly === true) {
      // Au moins un signalement OUVERT ciblant la page (miroir annonces).
      const flagged = new Set<string>();
      for (const report of this.db.reports.values()) {
        if (report.targetType === 'page' && report.status === 'open') {
          flagged.add(report.targetId);
        }
      }
      items = items.filter((p) => flagged.has(p.id));
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      const needle = params.search.trim().toLowerCase();
      items = items.filter((p) => {
        const ownerName =
          this.db.users.get(p.ownerId)?.displayName.toLowerCase() ?? '';
        return (
          p.name.toLowerCase().includes(needle) ||
          p.city.toLowerCase().includes(needle) ||
          ownerName.includes(needle)
        );
      });
    }
    // Antéchronologique, tie-break id : ordre STABLE entre deux pages.
    items.sort((a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id));
    return Promise.resolve({
      items: items
        .slice(params.offset, params.offset + params.limit)
        .map((p) => clone(p)),
      total: items.length,
    });
  }

  // ── Abonnés (D74) ──────────────────────────────────────────────────────────

  follow(pageId: string, userId: string): Promise<void> {
    if (!this.db.pages.has(pageId)) {
      throw new Error(`Page introuvable : ${pageId} (FK pages).`);
    }
    if (!this.db.users.has(userId)) {
      throw new Error(`Utilisateur introuvable : ${userId}.`);
    }
    // Idempotent : la PK composite absorbe le doublon (ON CONFLICT DO NOTHING).
    const exists = this.db.pageFollows.some(
      (f) => f.pageId === pageId && f.userId === userId,
    );
    if (!exists) {
      this.db.pageFollows.push({ pageId, userId, createdAt: new Date() });
    }
    return Promise.resolve();
  }

  unfollow(pageId: string, userId: string): Promise<void> {
    // Idempotent : no-op si l'abonnement n'existe pas.
    const index = this.db.pageFollows.findIndex(
      (f) => f.pageId === pageId && f.userId === userId,
    );
    if (index >= 0) {
      this.db.pageFollows.splice(index, 1);
    }
    return Promise.resolve();
  }

  isFollowing(pageId: string, userId: string): Promise<boolean> {
    return Promise.resolve(
      this.db.pageFollows.some(
        (f) => f.pageId === pageId && f.userId === userId,
      ),
    );
  }

  listFollowedPageIds(userId: string): Promise<string[]> {
    return Promise.resolve(
      this.db.pageFollows
        .filter((f) => f.userId === userId)
        .map((f) => f.pageId),
    );
  }

  followersCountsByPageIds(
    pageIds: string[],
  ): Promise<Record<string, number>> {
    // Compteur PAR page EN UN APPEL (anti N+1) — seuls les abonnés au compte
    // ACTIF comptent (miroir des compteurs follow utilisateurs) ; les pages
    // sans abonné sont ABSENTES du résultat.
    const wanted = new Set(pageIds);
    const result: Record<string, number> = {};
    for (const follow of this.db.pageFollows) {
      if (!wanted.has(follow.pageId)) {
        continue;
      }
      if (this.db.users.get(follow.userId)?.status !== 'active') {
        continue;
      }
      result[follow.pageId] = (result[follow.pageId] ?? 0) + 1;
    }
    return Promise.resolve(result);
  }

  // ── Horaires (D70) ─────────────────────────────────────────────────────────

  replaceHours(pageId: string, hours: PageHourSpec[]): Promise<void> {
    if (!this.db.pages.has(pageId)) {
      throw new Error(`Page introuvable : ${pageId} (FK pages).`);
    }
    // Remplacement ATOMIQUE : purge puis réinsertion (équivalent transaction
    // SQL DELETE + INSERT). Position par défaut : l'index du tableau.
    for (const [id, hour] of this.db.pageHours) {
      if (hour.pageId === pageId) {
        this.db.pageHours.delete(id);
      }
    }
    hours.forEach((spec, index) => {
      const hour: PageHour = {
        id: randomUUID(),
        pageId,
        weekday: spec.weekday,
        opensMinute: spec.opensMinute,
        closesMinute: spec.closesMinute,
        position: spec.position ?? index,
      };
      this.db.pageHours.set(hour.id, hour);
    });
    return Promise.resolve();
  }

  listHoursByPageIds(
    pageIds: string[],
  ): Promise<Record<string, PageHour[]>> {
    // Plages PAR page EN UN APPEL, triées weekday puis opensMinute (tie-break
    // id) ; les pages sans plage sont ABSENTES du résultat.
    const wanted = new Set(pageIds);
    const result: Record<string, PageHour[]> = {};
    for (const hour of this.db.pageHours.values()) {
      if (wanted.has(hour.pageId)) {
        (result[hour.pageId] ??= []).push(clone(hour));
      }
    }
    for (const list of Object.values(result)) {
      list.sort(
        (a, b) =>
          a.weekday - b.weekday ||
          a.opensMinute - b.opensMinute ||
          a.id.localeCompare(b.id),
      );
    }
    return Promise.resolve(result);
  }

  // ── Documents « Nos cartes » (D71) ─────────────────────────────────────────

  createDocument(input: CreatePageDocumentInput): Promise<PageDocument> {
    if (!this.db.pages.has(input.pageId)) {
      throw new Error(`Page introuvable : ${input.pageId} (FK pages).`);
    }
    // Position = max des positions existantes + 1 (ordre d'ajout).
    let maxPosition = -1;
    for (const document of this.db.pageDocuments.values()) {
      if (document.pageId === input.pageId && document.position > maxPosition) {
        maxPosition = document.position;
      }
    }
    const document: PageDocument = {
      id: randomUUID(),
      pageId: input.pageId,
      label: input.label,
      url: input.url,
      fileSizeBytes: input.fileSizeBytes,
      position: maxPosition + 1,
      createdAt: new Date(),
    };
    this.db.pageDocuments.set(document.id, document);
    return Promise.resolve(clone(document));
  }

  findDocumentById(id: string): Promise<PageDocument | null> {
    return Promise.resolve(clone(this.db.pageDocuments.get(id) ?? null));
  }

  deleteDocument(id: string): Promise<void> {
    // Suppression DÉFINITIVE et idempotente (simple ligne d'attachement).
    this.db.pageDocuments.delete(id);
    return Promise.resolve();
  }

  listDocumentsByPageIds(
    pageIds: string[],
  ): Promise<Record<string, PageDocument[]>> {
    const wanted = new Set(pageIds);
    const result: Record<string, PageDocument[]> = {};
    for (const document of this.db.pageDocuments.values()) {
      if (wanted.has(document.pageId)) {
        (result[document.pageId] ??= []).push(clone(document));
      }
    }
    for (const list of Object.values(result)) {
      list.sort(
        (a, b) =>
          a.position - b.position ||
          byCreatedAtAsc(a, b) ||
          a.id.localeCompare(b.id),
      );
    }
    return Promise.resolve(result);
  }

  // ── Plats (D71) ────────────────────────────────────────────────────────────

  createDish(input: CreateDishInput): Promise<Dish> {
    if (!this.db.pages.has(input.pageId)) {
      throw new Error(`Page introuvable : ${input.pageId} (FK pages).`);
    }
    if (
      (input.priceTakeawayCents ?? null) === null &&
      (input.priceDineInCents ?? null) === null
    ) {
      throw new Error(
        'Un plat exige au moins un prix : à emporter ou sur place (CHECK).',
      );
    }
    const now = new Date();
    const dish: Dish = {
      id: randomUUID(),
      pageId: input.pageId,
      name: input.name,
      description: input.description ?? '',
      imageUrl: input.imageUrl ?? null,
      priceTakeawayCents: input.priceTakeawayCents ?? null,
      priceDineInCents: input.priceDineInCents ?? null,
      position: input.position ?? this.nextDishPosition(input.pageId),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.db.dishes.set(dish.id, dish);
    return Promise.resolve(clone(dish));
  }

  findDishById(id: string): Promise<Dish | null> {
    return Promise.resolve(clone(this.db.dishes.get(id) ?? null));
  }

  findDishesByIds(ids: string[]): Promise<Dish[]> {
    const wanted = new Set(ids);
    return Promise.resolve(
      [...this.db.dishes.values()]
        .filter((d) => wanted.has(d.id))
        .map((d) => clone(d)),
    );
  }

  updateDish(id: string, patch: UpdateDishPatch): Promise<Dish> {
    const dish = this.db.dishes.get(id);
    if (!dish) {
      throw new Error(`Plat introuvable : ${id}.`);
    }
    applyPatch(dish, patch);
    if (
      dish.priceTakeawayCents === null &&
      dish.priceDineInCents === null
    ) {
      throw new Error(
        'Un plat exige au moins un prix : à emporter ou sur place (CHECK).',
      );
    }
    this.db.touch(dish);
    return Promise.resolve(clone(dish));
  }

  softDeleteDish(id: string): Promise<Dish> {
    const dish = this.db.dishes.get(id);
    if (!dish) {
      throw new Error(`Plat introuvable : ${id}.`);
    }
    // ATOMIQUEMENT : suppression douce + retrait de TOUS les menus programmés
    // qui référencent le plat (équivalent transaction SQL — D71).
    dish.status = 'deleted';
    this.db.touch(dish);
    for (const [itemId, item] of this.db.pageMenuItems) {
      if (item.dishId === id) {
        this.db.pageMenuItems.delete(itemId);
      }
    }
    return Promise.resolve(clone(dish));
  }

  listDishes(pageId: string): Promise<Dish[]> {
    return Promise.resolve(
      [...this.db.dishes.values()]
        .filter((d) => d.pageId === pageId && d.status === 'active')
        .sort(
          (a, b) =>
            a.position - b.position ||
            byCreatedAtAsc(a, b) ||
            a.id.localeCompare(b.id),
        )
        .map((d) => clone(d)),
    );
  }

  /** Position suivante d'un plat de la page (max + 1 — ordre d'ajout). */
  private nextDishPosition(pageId: string): number {
    let max = -1;
    for (const dish of this.db.dishes.values()) {
      if (dish.pageId === pageId && dish.position > max) {
        max = dish.position;
      }
    }
    return max + 1;
  }

  // ── Menus programmés (D71) ─────────────────────────────────────────────────

  upsertMenu(
    pageId: string,
    menuDate: string,
    dishIds: string[],
  ): Promise<PageMenuWithDishes | null> {
    if (!this.db.pages.has(pageId)) {
      throw new Error(`Page introuvable : ${pageId} (FK pages).`);
    }
    for (const dishId of dishIds) {
      if (!this.db.dishes.has(dishId)) {
        throw new Error(`Plat introuvable : ${dishId} (FK dishes).`);
      }
    }
    let menu = this.findMenu(pageId, menuDate);
    // [] = suppression du menu du jour (les items partent en CASCADE).
    if (dishIds.length === 0) {
      if (menu) {
        this.deleteMenuItems(menu.id);
        this.db.pageMenus.delete(menu.id);
      }
      return Promise.resolve(null);
    }
    const now = new Date();
    if (!menu) {
      menu = {
        id: randomUUID(),
        pageId,
        menuDate,
        createdAt: now,
        updatedAt: now,
      };
      this.db.pageMenus.set(menu.id, menu);
    } else {
      // Remplacement ATOMIQUE des items (équivalent transaction SQL).
      this.deleteMenuItems(menu.id);
      this.db.touch(menu);
    }
    // `const` pour la capture dans la closure (narrowing TS conservé).
    const target = menu;
    dishIds.forEach((dishId, index) => {
      const item: PageMenuItem = {
        id: randomUUID(),
        menuId: target.id,
        dishId,
        position: index,
      };
      this.db.pageMenuItems.set(item.id, item);
    });
    return Promise.resolve(this.assembleMenu(target));
  }

  listMenusWithDishes(
    pageId: string,
    fromDate: string,
    toDate: string,
  ): Promise<PageMenuWithDishes[]> {
    // Bornes INCLUSES — la comparaison lexicographique des 'YYYY-MM-DD' est
    // équivalente à la comparaison de dates SQL. Les jours sans menu sont
    // ABSENTS du résultat (l'appelant complète les trous).
    const menus = [...this.db.pageMenus.values()]
      .filter(
        (m) =>
          m.pageId === pageId &&
          m.menuDate >= fromDate &&
          m.menuDate <= toDate,
      )
      .sort(
        (a, b) =>
          a.menuDate.localeCompare(b.menuDate) || a.id.localeCompare(b.id),
      );
    return Promise.resolve(menus.map((menu) => this.assembleMenu(menu)));
  }

  /** Menu + ses plats ordonnés par position d'item. Les plats 'deleted'
   * n'apparaissent jamais (la suppression d'un plat retire ses items — la
   * garde reste par défense en profondeur). */
  private assembleMenu(menu: PageMenu): PageMenuWithDishes {
    const items = [...this.db.pageMenuItems.values()]
      .filter((i) => i.menuId === menu.id)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    const dishes: Dish[] = [];
    for (const item of items) {
      const dish = this.db.dishes.get(item.dishId);
      if (dish && dish.status === 'active') {
        dishes.push(clone(dish));
      }
    }
    return { menu: clone(menu), dishes };
  }

  private findMenu(pageId: string, menuDate: string): PageMenu | null {
    for (const menu of this.db.pageMenus.values()) {
      if (menu.pageId === pageId && menu.menuDate === menuDate) {
        return menu;
      }
    }
    return null;
  }

  private deleteMenuItems(menuId: string): void {
    for (const [id, item] of this.db.pageMenuItems) {
      if (item.menuId === menuId) {
        this.db.pageMenuItems.delete(id);
      }
    }
  }

  // ── Offres (D72) ───────────────────────────────────────────────────────────

  createOffer(input: CreatePageOfferInput): Promise<PageOffer> {
    if (!this.db.pages.has(input.pageId)) {
      throw new Error(`Page introuvable : ${input.pageId} (FK pages).`);
    }
    const now = new Date();
    const offer: PageOffer = {
      id: randomUUID(),
      pageId: input.pageId,
      title: input.title,
      description: input.description ?? '',
      imageUrl: input.imageUrl ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.db.pageOffers.set(offer.id, offer);
    return Promise.resolve(clone(offer));
  }

  findOfferById(id: string): Promise<PageOffer | null> {
    return Promise.resolve(clone(this.db.pageOffers.get(id) ?? null));
  }

  updateOffer(id: string, patch: UpdatePageOfferPatch): Promise<PageOffer> {
    const offer = this.db.pageOffers.get(id);
    if (!offer) {
      throw new Error(`Offre introuvable : ${id}.`);
    }
    applyPatch(offer, patch);
    this.db.touch(offer);
    return Promise.resolve(clone(offer));
  }

  setOfferStatus(id: string, status: PageContentStatus): Promise<PageOffer> {
    const offer = this.db.pageOffers.get(id);
    if (!offer) {
      throw new Error(`Offre introuvable : ${id}.`);
    }
    offer.status = status;
    this.db.touch(offer);
    return Promise.resolve(clone(offer));
  }

  listOffers(pageId: string): Promise<PageOffer[]> {
    return Promise.resolve(
      [...this.db.pageOffers.values()]
        .filter((o) => o.pageId === pageId && o.status === 'active')
        .sort((a, b) => byCreatedAtDesc(a, b) || a.id.localeCompare(b.id))
        .map((o) => clone(o)),
    );
  }

  // ── Événements (D72) ───────────────────────────────────────────────────────

  createEvent(input: CreatePageEventInput): Promise<PageEvent> {
    if (!this.db.pages.has(input.pageId)) {
      throw new Error(`Page introuvable : ${input.pageId} (FK pages).`);
    }
    const now = new Date();
    const event: PageEvent = {
      id: randomUUID(),
      pageId: input.pageId,
      title: input.title,
      description: input.description ?? '',
      imageUrl: input.imageUrl ?? null,
      startsAt: new Date(input.startsAt.getTime()),
      endsAt: input.endsAt ? new Date(input.endsAt.getTime()) : null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.db.pageEvents.set(event.id, event);
    return Promise.resolve(clone(event));
  }

  findEventById(id: string): Promise<PageEvent | null> {
    return Promise.resolve(clone(this.db.pageEvents.get(id) ?? null));
  }

  updateEvent(id: string, patch: UpdatePageEventPatch): Promise<PageEvent> {
    const event = this.db.pageEvents.get(id);
    if (!event) {
      throw new Error(`Événement introuvable : ${id}.`);
    }
    applyPatch(event, patch);
    this.db.touch(event);
    return Promise.resolve(clone(event));
  }

  setEventStatus(id: string, status: PageContentStatus): Promise<PageEvent> {
    const event = this.db.pageEvents.get(id);
    if (!event) {
      throw new Error(`Événement introuvable : ${id}.`);
    }
    event.status = status;
    this.db.touch(event);
    return Promise.resolve(clone(event));
  }

  listEvents(pageId: string): Promise<PageEvent[]> {
    // startsAt CROISSANT : le prochain événement d'abord (tie-break id).
    return Promise.resolve(
      [...this.db.pageEvents.values()]
        .filter((e) => e.pageId === pageId && e.status === 'active')
        .sort(
          (a, b) =>
            a.startsAt.getTime() - b.startsAt.getTime() ||
            a.id.localeCompare(b.id),
        )
        .map((e) => clone(e)),
    );
  }

  // ── Compteurs backoffice ───────────────────────────────────────────────────

  countContents(pageId: string): Promise<{
    dishes: number;
    documents: number;
    menus: number;
    offers: number;
    events: number;
  }> {
    let dishes = 0;
    for (const dish of this.db.dishes.values()) {
      if (dish.pageId === pageId && dish.status === 'active') {
        dishes++;
      }
    }
    let documents = 0;
    for (const document of this.db.pageDocuments.values()) {
      if (document.pageId === pageId) {
        documents++;
      }
    }
    let menus = 0;
    for (const menu of this.db.pageMenus.values()) {
      if (menu.pageId === pageId) {
        menus++;
      }
    }
    let offers = 0;
    for (const offer of this.db.pageOffers.values()) {
      if (offer.pageId === pageId && offer.status === 'active') {
        offers++;
      }
    }
    let events = 0;
    for (const event of this.db.pageEvents.values()) {
      if (event.pageId === pageId && event.status === 'active') {
        events++;
      }
    }
    return Promise.resolve({ dishes, documents, menus, offers, events });
  }
}

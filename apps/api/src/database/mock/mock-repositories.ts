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
  Notification,
  Post,
  PostStatus,
  PostType,
  Reaction,
  ReactionTargetType,
  Report,
  ReportStatus,
  SavedCollection,
  User,
} from '../domain/entities';
import {
  CamerasRepository,
  CommentsRepository,
  CreateCameraInput,
  CreateCommentInput,
  CreateNotificationInput,
  CreatePostInput,
  CreateReportInput,
  CreateUserInput,
  HandleReportInput,
  ListCamerasParams,
  ListFeedParams,
  ListMapMarkersParams,
  ListUsersParams,
  NotificationsRepository,
  PagedResult,
  PostsRepository,
  PostTypesRepository,
  ReactionsRepository,
  ReportsRepository,
  SavedRepository,
  UpdateCameraPatch,
  UpdatePostPatch,
  UpdatePostTypePatch,
  UpdateUserPatch,
  UsersRepository,
} from '../repositories/interfaces';
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

  list(params: ListUsersParams): Promise<PagedResult<User>> {
    let items = [...this.db.users.values()];
    if (params.status !== undefined) {
      items = items.filter((u) => u.status === params.status);
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
    const now = new Date();
    const post: Post = {
      id: randomUUID(),
      authorId: input.authorId,
      pageId: null, // Toujours null au Lot 1 (pages = Lot 3).
      typeSlug: input.typeSlug,
      title: input.title ?? null,
      body: input.body,
      location: input.location ?? null,
      city: input.city ?? null,
      visibility: 'public',
      status: 'active',
      urlSlug: input.urlSlug,
      mapExpiresAt: input.mapExpiresAt ?? null,
      reactionCount: 0,
      commentCount: 0,
      shareCount: 0,
      saveCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.db.posts.set(post.id, post);
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
      if (categories && !categories.has(p.typeSlug)) {
        return false;
      }
      return isInBbox(p.location, params.bbox);
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
}

// ────────────────────────────────────────────────────────────────────────────
// Signalements
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MockReportsRepository implements ReportsRepository {
  constructor(private readonly db: MockDatabaseService) {}

  create(input: CreateReportInput): Promise<Report> {
    if (!this.db.users.has(input.reporterId)) {
      throw new Error(`Utilisateur introuvable : ${input.reporterId}.`);
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
    return Promise.resolve(clone(report));
  }

  list(params?: { status?: ReportStatus }): Promise<Report[]> {
    let items = [...this.db.reports.values()];
    if (params?.status !== undefined) {
      items = items.filter((r) => r.status === params.status);
    }
    items.sort(byCreatedAtDesc);
    return Promise.resolve(items.map((r) => clone(r)));
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

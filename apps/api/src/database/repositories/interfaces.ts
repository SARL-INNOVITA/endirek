/**
 * Interfaces des repositories Endirek — contrat unique entre le code métier
 * et la couche de persistance, quel que soit le driver (mock ou postgres).
 *
 * Les modules métier (étapes 3 à 6) injectent ces interfaces via les tokens
 * de `database.tokens.ts` et ne connaissent JAMAIS l'implémentation.
 *
 * Périmètre volontairement minimal et pragmatique : chaque méthode répond à
 * un besoin identifié des étapes 3-6 ; on étendra au fil de l'eau.
 */

import {
  BoundingBox,
  Camera,
  CameraCategory,
  CameraStatus,
  CameraStreamType,
  Comment,
  CommentStatus,
  GeoPoint,
  Notification,
  NotificationType,
  Post,
  PostMediaType,
  PostStatus,
  PostType,
  Reaction,
  ReactionTargetType,
  Report,
  ReportReasonCode,
  ReportStatus,
  ReportTargetType,
  SavedCollection,
  User,
  UserRole,
  UserStatus,
} from '../domain/entities';

// ────────────────────────────────────────────────────────────────────────────
// Utilisateurs & follows
// ────────────────────────────────────────────────────────────────────────────

/** Données nécessaires à la création d'un utilisateur (le reste est défini
 * par défaut : bio '', settings {}, role 'user', status 'active'). */
export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string;
  city?: string | null;
  location?: GeoPoint | null;
  settings?: Record<string, unknown>;
  role?: UserRole;
}

/** Champs modifiables d'un utilisateur (profil + administration). */
export type UpdateUserPatch = Partial<
  Pick<
    User,
    | 'email'
    | 'passwordHash'
    | 'displayName'
    | 'avatarUrl'
    | 'coverUrl'
    | 'bio'
    | 'city'
    | 'location'
    | 'settings'
    | 'role'
    | 'status'
  >
>;

export interface ListUsersParams {
  status?: UserStatus;
  /** Recherche insensible à la casse sur displayName et email. */
  search?: string;
  limit: number;
  offset: number;
}

/** Résultat paginé générique (backoffice, listes admin). */
export interface PagedResult<T> {
  items: T[];
  total: number;
}

export interface UsersRepository {
  findById(id: string): Promise<User | null>;
  /** Recherche insensible à la casse (miroir de l'index UNIQUE lower(email)). */
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, patch: UpdateUserPatch): Promise<User>;
  /** Suppression douce RGPD : status 'deleted' + deletedAt, la ligne reste. */
  softDelete(id: string): Promise<void>;
  /** Idempotent ; refuse l'auto-suivi (CHECK follower <> followed). */
  follow(followerId: string, followedId: string): Promise<void>;
  unfollow(followerId: string, followedId: string): Promise<void>;
  isFollowing(followerId: string, followedId: string): Promise<boolean>;
  /** Ids des comptes suivis par userId (construction du feed « suivis »). */
  listFollowedIds(userId: string): Promise<string[]>;
  list(params: ListUsersParams): Promise<PagedResult<User>>;
}

// ────────────────────────────────────────────────────────────────────────────
// Types de publication (vocabulaire pilotable backoffice)
// ────────────────────────────────────────────────────────────────────────────

export type UpdatePostTypePatch = Partial<
  Pick<
    PostType,
    | 'labelFr'
    | 'icon'
    | 'color'
    | 'requiresLocationForMap'
    | 'showsOnMap'
    | 'defaultMapDurationMinutes'
    | 'isActive'
    | 'position'
  >
>;

export interface PostTypesRepository {
  /** Types actifs triés par position (composer d'un post, filtres du feed). */
  listActive(): Promise<PostType[]>;
  findBySlug(slug: string): Promise<PostType | null>;
  update(slug: string, patch: UpdatePostTypePatch): Promise<PostType>;
}

// ────────────────────────────────────────────────────────────────────────────
// Publications
// ────────────────────────────────────────────────────────────────────────────

/** Données de création d'un post. `mapExpiresAt` est calculé par le SERVICE
 * (createdAt + defaultMapDurationMinutes du type quand il y a une location) :
 * la règle métier carte ne vit pas dans le repository. */
export interface CreatePostInput {
  authorId: string;
  typeSlug: string;
  body: string;
  urlSlug: string;
  title?: string | null;
  location?: GeoPoint | null;
  city?: string | null;
  mapExpiresAt?: Date | null;
}

export type UpdatePostPatch = Partial<
  Pick<Post, 'title' | 'body' | 'location' | 'city' | 'mapExpiresAt'>
>;

export interface ListFeedParams {
  limit: number;
  /** Pagination par curseur : ne retourne que les posts strictement antérieurs. */
  beforeCreatedAt?: Date;
  /** Filtre optionnel sur les types (slugs de post_types). */
  typeSlugs?: string[];
  /** Filtre optionnel sur les auteurs (feed « suivis », profil). */
  authorIds?: string[];
}

export interface ListMapMarkersParams {
  bbox: BoundingBox;
  /** Filtre optionnel sur les types carte (slugs : weather, traffic, danger). */
  categories?: string[];
  /** Instant de référence pour l'expiration carte (injecté = testable). */
  now: Date;
}

export interface PostsRepository {
  findById(id: string): Promise<Post | null>;
  findByUrlSlug(urlSlug: string): Promise<Post | null>;
  create(input: CreatePostInput): Promise<Post>;
  update(id: string, patch: UpdatePostPatch): Promise<Post>;
  setStatus(id: string, status: PostStatus): Promise<Post>;
  /** Feed antéchronologique : posts 'active' uniquement. */
  listFeed(params: ListFeedParams): Promise<Post[]>;
  /** Marqueurs carte : location non nulle ET mapExpiresAt > now ET status
   * 'active', dans la bbox demandée. */
  listMapMarkers(params: ListMapMarkersParams): Promise<Post[]>;
}

// ────────────────────────────────────────────────────────────────────────────
// Médias de publication
// ────────────────────────────────────────────────────────────────────────────

export interface CreatePostMediaInput {
  postId: string;
  mediaType: PostMediaType;
  url: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  position?: number;
}

// (Pas de repository dédié au Lot 1 étape 2 : les médias seront gérés par le
// module posts à l'étape 4 ; le store mock les charge déjà depuis le seed.)

// ────────────────────────────────────────────────────────────────────────────
// Commentaires
// ────────────────────────────────────────────────────────────────────────────

export interface CreateCommentInput {
  postId: string;
  authorId: string;
  body: string;
  /** null = commentaire principal (depth 0) ; id d'un commentaire principal =
   * réponse (depth 1). Toute tentative de niveau 2+ est REFUSÉE (option A). */
  parentCommentId?: string | null;
}

export interface CommentsRepository {
  findById(id: string): Promise<Comment | null>;
  /** Tous les commentaires d'un post, triés par createdAt croissant
   * (miroir de l'index (post_id, created_at)). */
  listByPost(postId: string): Promise<Comment[]>;
  /** REFUSE (erreur claire) un parent qui a lui-même un parent : depth ≤ 1. */
  create(input: CreateCommentInput): Promise<Comment>;
  setStatus(id: string, status: CommentStatus): Promise<Comment>;
}

// ────────────────────────────────────────────────────────────────────────────
// Réactions
// ────────────────────────────────────────────────────────────────────────────

export interface ReactionsRepository {
  /** Une réaction par (user, cible) — UNIQUE côté SQL : si elle existe déjà,
   * l'emoji est mis à jour (changer d'emoji = update, pas de doublon). */
  upsert(
    userId: string,
    targetType: ReactionTargetType,
    targetId: string,
    emoji: string,
  ): Promise<Reaction>;
  remove(
    userId: string,
    targetType: ReactionTargetType,
    targetId: string,
  ): Promise<void>;
  listByTarget(
    targetType: ReactionTargetType,
    targetId: string,
  ): Promise<Reaction[]>;
  /** Agrégat { emoji → nombre } pour l'affichage des compteurs par emoji. */
  countsByEmoji(
    targetType: ReactionTargetType,
    targetId: string,
  ): Promise<Record<string, number>>;
}

// ────────────────────────────────────────────────────────────────────────────
// Sauvegardes (collections + posts sauvegardés)
// ────────────────────────────────────────────────────────────────────────────

export interface SavedRepository {
  /** Retourne la collection par défaut « Général » du propriétaire, en la
   * créant si nécessaire (une seule par user — index UNIQUE partiel). */
  getOrCreateDefaultCollection(ownerId: string): Promise<SavedCollection>;
  listCollections(ownerId: string): Promise<SavedCollection[]>;
  /** Idempotent : sauvegarder deux fois le même post ne duplique rien. */
  save(collectionId: string, postId: string): Promise<void>;
  unsave(collectionId: string, postId: string): Promise<void>;
  /** Posts d'une collection, du plus récemment sauvegardé au plus ancien. */
  listSavedPosts(collectionId: string): Promise<Post[]>;
}

// ────────────────────────────────────────────────────────────────────────────
// Caméras
// ────────────────────────────────────────────────────────────────────────────

export interface CreateCameraInput {
  name: string;
  streamType: CameraStreamType;
  url: string;
  category: CameraCategory;
  location: GeoPoint;
  cityName: string;
  description?: string;
  districtName?: string | null;
  status?: CameraStatus;
}

export type UpdateCameraPatch = Partial<
  Pick<
    Camera,
    | 'name'
    | 'streamType'
    | 'url'
    | 'category'
    | 'description'
    | 'location'
    | 'cityName'
    | 'districtName'
    | 'status'
  >
>;

export interface ListCamerasParams {
  category?: CameraCategory;
  status?: CameraStatus;
}

export interface CamerasRepository {
  list(params?: ListCamerasParams): Promise<Camera[]>;
  listInBbox(bbox: BoundingBox): Promise<Camera[]>;
  findById(id: string): Promise<Camera | null>;
  /** Attribue automatiquement un cameraNumber croissant (affiché « #23 »). */
  create(input: CreateCameraInput): Promise<Camera>;
  update(id: string, patch: UpdateCameraPatch): Promise<Camera>;
}

// ────────────────────────────────────────────────────────────────────────────
// Signalements (modération)
// ────────────────────────────────────────────────────────────────────────────

export interface CreateReportInput {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: ReportReasonCode;
  message?: string;
}

export interface HandleReportInput {
  status: ReportStatus;
  handledBy: string;
  resolutionNote?: string | null;
}

export interface ReportsRepository {
  create(input: CreateReportInput): Promise<Report>;
  /** Liste antéchronologique, filtrable par statut (file de modération). */
  list(params?: { status?: ReportStatus }): Promise<Report[]>;
  findById(id: string): Promise<Report | null>;
  /** Traite un signalement : statut, modérateur, note ; handledAt = now. */
  handle(id: string, input: HandleReportInput): Promise<Report>;
}

// ────────────────────────────────────────────────────────────────────────────
// Notifications
// ────────────────────────────────────────────────────────────────────────────

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  payload?: Record<string, unknown>;
}

export interface NotificationsRepository {
  create(input: CreateNotificationInput): Promise<Notification>;
  /** Liste antéchronologique paginée des notifications d'un utilisateur. */
  listByUser(
    userId: string,
    params: { limit: number; offset: number },
  ): Promise<Notification[]>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  unreadCount(userId: string): Promise<number>;
}

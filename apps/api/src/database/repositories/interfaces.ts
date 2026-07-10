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
  ExchangePref,
  GeoPoint,
  Listing,
  ListingCategory,
  ListingExternalLink,
  ListingFamily,
  ListingMedia,
  ListingMediaType,
  ListingStatus,
  ListingSubcategory,
  ListingTag,
  ListingValueKind,
  ModerationLevel,
  Notification,
  NotificationType,
  Post,
  PostMedia,
  PostMediaType,
  PostStatus,
  PostType,
  Reaction,
  ReactionTargetType,
  ReactionType,
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
  role?: UserRole;
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

/** Paramètres de pagination par limite/décalage (listes publiques). */
export interface PageParams {
  limit: number;
  offset: number;
}

export interface UsersRepository {
  findById(id: string): Promise<User | null>;
  /** Chargement PAR LOT (auteurs d'une page de feed — évite les N+1) : les
   * ids inconnus sont ignorés, l'ordre de retour n'est pas garanti. */
  findByIds(ids: string[]): Promise<User[]>;
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
  /** Followers d'un utilisateur, du suivi le plus récent au plus ancien.
   * Seuls les comptes ACTIFS apparaissent (les comptes supprimés/suspendus
   * sont exclus des listes publiques) ; `total` compte ces mêmes comptes
   * actifs — il peut donc différer de followersCount (qui compte tous les
   * liens de suivi, écart assumé et documenté). */
  listFollowers(userId: string, params: PageParams): Promise<PagedResult<User>>;
  /** Comptes suivis par un utilisateur — mêmes règles que listFollowers. */
  listFollowing(userId: string, params: PageParams): Promise<PagedResult<User>>;
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
  /** Tous les types, actifs ou non, triés par position (backoffice). */
  listAll(): Promise<PostType[]>;
  /** Types actifs triés par position (composer d'un post, filtres du feed). */
  listActive(): Promise<PostType[]>;
  findBySlug(slug: string): Promise<PostType | null>;
  update(slug: string, patch: UpdatePostTypePatch): Promise<PostType>;
}

// ────────────────────────────────────────────────────────────────────────────
// Publications
// ────────────────────────────────────────────────────────────────────────────

/** Média attaché à la création d'un post (le postId n'existe pas encore :
 * il est posé par le repository). Position par défaut : l'index du tableau. */
export type CreatePostMediaSpec = Omit<CreatePostMediaInput, 'postId'>;

/** Données de création d'un post. `mapExpiresAt` est calculé par le SERVICE
 * (createdAt + defaultMapDurationMinutes du type quand il y a une location) :
 * la règle métier carte ne vit pas dans le repository. Les médias sont créés
 * ATOMIQUEMENT avec le post (équivalent transaction côté SQL). */
export interface CreatePostInput {
  authorId: string;
  typeSlug: string;
  body: string;
  urlSlug: string;
  title?: string | null;
  location?: GeoPoint | null;
  city?: string | null;
  mapExpiresAt?: Date | null;
  media?: CreatePostMediaSpec[];
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
  /** Boîte englobante optionnelle — absente : toute l'île. */
  bbox?: BoundingBox;
  /** Filtre optionnel sur les types carte (slugs : weather, traffic, danger). */
  categories?: string[];
  /** Instant de référence pour l'expiration carte (injecté = testable). */
  now: Date;
}

/** Page de publications d'un auteur, filtrée par statuts (profil public :
 * ['active'] ; « mes posts » : ['active','hidden'] — jamais 'deleted'). */
export interface ListAuthorPostsParams {
  statuses: PostStatus[];
  limit: number;
  offset: number;
}

/** Paramètres de la liste backoffice des publications : TOUS statuts par
 * défaut (y compris 'deleted' — audit), filtres facultatifs. `search` porte
 * sur le titre, le corps ET le nom affiché de l'auteur (insensible à la
 * casse). */
export interface AdminListPostsParams {
  typeSlug?: string;
  status?: PostStatus;
  /** true = publication actuellement visible sur la carte, false = hors carte. */
  mapVisible?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

export interface PostsRepository {
  findById(id: string): Promise<Post | null>;
  findByUrlSlug(urlSlug: string): Promise<Post | null>;
  create(input: CreatePostInput): Promise<Post>;
  update(id: string, patch: UpdatePostPatch): Promise<Post>;
  setStatus(id: string, status: PostStatus): Promise<Post>;
  /** Nombre de publications 'active' d'un auteur — alimente le `postsCount`
   * des profils (étape 3) sans matérialiser la liste des posts. */
  countByAuthor(authorId: string): Promise<number>;
  /** TOUTES les publications d'un auteur, quel que soit leur statut,
   * antéchronologiques — export RGPD (le feed public passe par listFeed). */
  listByAuthor(authorId: string): Promise<Post[]>;
  /** Page antéchronologique des publications d'un auteur filtrée par statuts
   * (listes de profil paginées — GET /users/:id/posts, /users/me/posts). */
  listByAuthorPaged(
    authorId: string,
    params: ListAuthorPostsParams,
  ): Promise<PagedResult<Post>>;
  /** Feed antéchronologique : posts 'active' uniquement. */
  listFeed(params: ListFeedParams): Promise<Post[]>;
  /** Fenêtre du scoring du feed : les `limit` posts 'active' les plus récents
   * (createdAt DESC, tie-break id — ordre STABLE). Le driver postgres portera
   * le scoring en SQL et cette fenêtre deviendra une sous-requête. */
  listActiveWindow(limit: number): Promise<Post[]>;
  /** Marqueurs carte : location non nulle ET mapExpiresAt > now ET status
   * 'active', dans la bbox demandée (toute l'île si absente). */
  listMapMarkers(params: ListMapMarkersParams): Promise<Post[]>;
  /** Liste BACKOFFICE paginée : tous statuts, filtres typeSlug/status et
   * recherche titre/corps/nom d'auteur, antéchronologique (tie-break id —
   * ordre stable). Le driver postgres fera un JOIN users + ILIKE. */
  listAdmin(params: AdminListPostsParams): Promise<PagedResult<Post>>;
  /** Médias de plusieurs posts EN UN APPEL (page de feed — évite les N+1),
   * triés par position croissante au sein de chaque post. */
  listMediaByPostIds(postIds: string[]): Promise<PostMedia[]>;
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

// (Pas de repository dédié : depuis l'étape 4, les médias sont créés avec le
// post — CreatePostInput.media — et lus par lot via listMediaByPostIds.)

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
  /** Tous les commentaires d'un auteur (tous statuts), chronologiques —
   * export RGPD. */
  listByAuthor(authorId: string): Promise<Comment[]>;
  /** REFUSE (erreur claire) un parent qui a lui-même un parent : depth ≤ 1. */
  create(input: CreateCommentInput): Promise<Comment>;
  setStatus(id: string, status: CommentStatus): Promise<Comment>;
}

// ────────────────────────────────────────────────────────────────────────────
// Réactions
// ────────────────────────────────────────────────────────────────────────────

export interface ReactionsRepository {
  /** Palette ACTIVE de la table reaction_types, triée par position — la
   * validation des emojis se fait TOUJOURS contre cette table (pilotable
   * par le backoffice), jamais contre une liste en dur dans le code. */
  listActiveTypes(): Promise<ReactionType[]>;
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
  /** Toutes les réactions émises par un utilisateur, antéchronologiques —
   * export RGPD. */
  listByUser(userId: string): Promise<Reaction[]>;
  /** Agrégat { emoji → nombre } pour l'affichage des compteurs par emoji. */
  countsByEmoji(
    targetType: ReactionTargetType,
    targetId: string,
  ): Promise<Record<string, number>>;
  /** Même agrégat pour PLUSIEURS cibles en un appel (reactionsTop d'une page
   * de feed — évite les N+1) : { targetId → { emoji → nombre } } ; les cibles
   * sans réaction sont absentes du résultat. */
  countsByEmojiForTargets(
    targetType: ReactionTargetType,
    targetIds: string[],
  ): Promise<Record<string, Record<string, number>>>;
  /** Réactions du VIEWER sur plusieurs cibles en un appel (viewerReaction
   * d'une page de feed) : { targetId → emoji } ; cibles non réagies absentes. */
  findViewerReactions(
    userId: string,
    targetType: ReactionTargetType,
    targetIds: string[],
  ): Promise<Record<string, string>>;
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
  /** Page des posts enregistrés par un utilisateur, TOUTES collections
   * confondues, du plus récemment enregistré au plus ancien. Seuls les
   * posts encore 'active' sont servis (les posts devenus hidden/deleted
   * sont exclus de la liste ET de `total`) — GET /users/me/saved-posts. */
  listSavedPostsByUser(
    userId: string,
    params: PageParams,
  ): Promise<PagedResult<Post>>;
  /** Le post est-il enregistré dans AU MOINS une collection de l'utilisateur ? */
  isSaved(userId: string, postId: string): Promise<boolean>;
  /** Filtre PAR LOT (viewerSaved d'une page de feed — évite les N+1) : parmi
   * `postIds`, ceux enregistrés dans une collection de l'utilisateur. */
  filterSavedPostIds(userId: string, postIds: string[]): Promise<string[]>;
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

/** Paramètres de la liste BACKOFFICE des caméras : TOUS statuts par défaut,
 * filtres facultatifs par catégorie et statut, recherche insensible à la
 * casse sur name/cityName/description, pagination bornée par le DTO
 * appelant. */
export interface AdminListCamerasParams {
  category?: CameraCategory;
  status?: CameraStatus;
  search?: string;
  limit: number;
  offset: number;
}

export interface CamerasRepository {
  list(params?: ListCamerasParams): Promise<Camera[]>;
  listInBbox(bbox: BoundingBox): Promise<Camera[]>;
  findById(id: string): Promise<Camera | null>;
  /** Attribue automatiquement un cameraNumber croissant (affiché « #23 »). */
  create(input: CreateCameraInput): Promise<Camera>;
  update(id: string, patch: UpdateCameraPatch): Promise<Camera>;
  /** Change le statut d'une caméra (activation/désactivation, masquage doux —
   * DELETE = status 'hidden'). Plus explicite qu'un update générique. */
  setStatus(id: string, status: CameraStatus): Promise<Camera>;
  /** Liste BACKOFFICE paginée : tous statuts, filtres catégorie/statut et
   * recherche name/cityName/description (insensible à la casse), triée par
   * cameraNumber croissant (ordre d'affichage « #1, #2, ... »). Le driver
   * postgres fera un ILIKE + LIMIT/OFFSET. */
  listAdmin(params: AdminListCamerasParams): Promise<PagedResult<Camera>>;
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

/** Paramètres de la file de modération backoffice : filtres facultatifs par
 * statut et type de cible, pagination bornée par le DTO appelant. */
export interface ListReportsParams {
  status?: ReportStatus;
  targetType?: ReportTargetType;
  limit: number;
  offset: number;
}

export interface ReportsRepository {
  /** REFUSE un doublon (reporterId, targetType, targetId) en levant une
   * UniqueViolationError (repositories/errors.ts) — miroir de la contrainte
   * UNIQUE reports_reporter_target_unique. Le service vérifie en amont via
   * existsByReporterAndTarget ET rattrape cette erreur typée (concurrence)
   * pour répondre 409 dans les deux cas. */
  create(input: CreateReportInput): Promise<Report>;
  /** L'utilisateur a-t-il DÉJÀ signalé cette cible ? (anti-doublon 409). */
  existsByReporterAndTarget(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<boolean>;
  /** File de modération paginée, antéchronologique, filtrable par statut et
   * type de cible (backoffice — GET /admin/reports). */
  list(params: ListReportsParams): Promise<PagedResult<Report>>;
  /** Tous les signalements visant UNE cible, antéchronologiques
   * (détail backoffice d'un post — GET /admin/posts/:id). */
  listByTarget(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<Report[]>;
  /** Nombre de signalements 'open' PAR CIBLE, en un appel pour toute une
   * page (openReportsCount de la liste admin — évite les N+1) :
   * { targetId → nombre } ; les cibles sans signalement ouvert sont
   * absentes du résultat. */
  countOpenByTargets(
    targetType: ReportTargetType,
    targetIds: string[],
  ): Promise<Record<string, number>>;
  /** Signalements ÉMIS par un utilisateur, antéchronologiques — export RGPD. */
  listByReporter(reporterId: string): Promise<Report[]>;
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
  /** Notification par id — contrôle d'ownership avant markRead (le service
   * répond 404 si elle n'appartient pas au user courant). */
  findById(id: string): Promise<Notification | null>;
  /** Liste antéchronologique paginée des notifications d'un utilisateur. */
  listByUser(
    userId: string,
    params: { limit: number; offset: number },
  ): Promise<Notification[]>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  unreadCount(userId: string): Promise<number>;
}

// ────────────────────────────────────────────────────────────────────────────
// Dealplace — Taxonomie (catégories / sous-catégories / tags)
// ────────────────────────────────────────────────────────────────────────────

/** Données de création d'une catégorie Dealplace (backoffice). */
export interface CreateListingCategoryInput {
  slug: string;
  family: ListingFamily;
  labelFr: string;
  position: number;
  moderationLevel?: ModerationLevel;
  isActive?: boolean;
}

/** Champs modifiables d'une catégorie (backoffice) — slug/family non modifiés. */
export type UpdateListingCategoryPatch = Partial<
  Pick<
    ListingCategory,
    'labelFr' | 'position' | 'moderationLevel' | 'isActive'
  >
>;

/** Données de création d'une sous-catégorie Dealplace (backoffice). */
export interface CreateListingSubcategoryInput {
  slug: string;
  categorySlug: string;
  labelFr: string;
  position: number;
  isActive?: boolean;
}

/** Champs modifiables d'une sous-catégorie (backoffice) — slug/categorySlug
 * non modifiés (une sous-catégorie ne change pas de catégorie). */
export type UpdateListingSubcategoryPatch = Partial<
  Pick<ListingSubcategory, 'labelFr' | 'position' | 'isActive'>
>;

/** Données de création d'un tag transversal (backoffice). */
export interface CreateListingTagInput {
  slug: string;
  labelFr: string;
  isActive?: boolean;
}

/** Champs modifiables d'un tag (backoffice) — slug non modifié. */
export type UpdateListingTagPatch = Partial<
  Pick<ListingTag, 'labelFr' | 'isActive'>
>;

/** Repository de la taxonomie Dealplace : catégories, sous-catégories et tags.
 * Vocabulaire pilotable par le backoffice (rien de hardcodé côté service). */
export interface ListingTaxonomyRepository {
  /** Catégories triées par position ASC (tie-break slug). `activeOnly` = true :
   * seules les catégories actives (composer d'annonce, filtres publics). */
  listCategories(activeOnly: boolean): Promise<ListingCategory[]>;
  /** Sous-catégories d'une catégorie, triées par position ASC (tie-break slug).
   * `activeOnly` = true : seules les sous-catégories actives. */
  listSubcategories(
    categorySlug: string,
    activeOnly: boolean,
  ): Promise<ListingSubcategory[]>;
  /** Tags triés par slug ASC. `activeOnly` = true : seuls les tags actifs. */
  listTags(activeOnly: boolean): Promise<ListingTag[]>;
  findCategory(slug: string): Promise<ListingCategory | null>;
  findSubcategory(slug: string): Promise<ListingSubcategory | null>;
  findTag(slug: string): Promise<ListingTag | null>;
  // ── Backoffice : gestion du vocabulaire ─────────────────────────────────
  createCategory(input: CreateListingCategoryInput): Promise<ListingCategory>;
  updateCategory(
    slug: string,
    patch: UpdateListingCategoryPatch,
  ): Promise<ListingCategory>;
  createSubcategory(
    input: CreateListingSubcategoryInput,
  ): Promise<ListingSubcategory>;
  updateSubcategory(
    slug: string,
    patch: UpdateListingSubcategoryPatch,
  ): Promise<ListingSubcategory>;
  createTag(input: CreateListingTagInput): Promise<ListingTag>;
  updateTag(slug: string, patch: UpdateListingTagPatch): Promise<ListingTag>;
}

// ────────────────────────────────────────────────────────────────────────────
// Dealplace — Annonces (listings)
// ────────────────────────────────────────────────────────────────────────────

/** Média attaché à la création d'une annonce (le listingId n'existe pas
 * encore : il est posé par le repository). Position par défaut : l'index du
 * tableau. Miroir de CreatePostMediaSpec côté posts. */
export interface CreateListingMediaSpec {
  mediaType: ListingMediaType;
  url: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  position?: number;
}

/** Données de création d'une annonce. Les règles métier (valeur cohérente,
 * photo obligatoire pour un bien, catégorie non 'forbidden', commune du
 * référentiel, sous-catégorie cohérente...) sont vérifiées AU SERVICE : le
 * repository reproduit les seules contraintes structurelles (FK category /
 * subcategory, unicité url_slug, cohérence value_kind/value_max, exchangePrefs
 * non vide). Médias et tags sont écrits ATOMIQUEMENT avec l'annonce
 * (équivalent transaction SQL). */
export interface CreateListingInput {
  ownerId: string;
  listingType: ListingFamily;
  title: string;
  description: string;
  categorySlug: string;
  subcategorySlug: string;
  valueKind: ListingValueKind;
  valueMin: number;
  valueMax?: number | null;
  currency?: string;
  city: string;
  location?: GeoPoint | null;
  exchangePrefs: ExchangePref[];
  externalLinks?: ListingExternalLink[];
  urlSlug: string;
  media?: CreateListingMediaSpec[];
  tagSlugs?: string[];
}

/** Champs modifiables d'une annonce par son propriétaire (le service décide de
 * ce qu'il expose ; médias/tags gérés à part). Le statut passe par setStatus. */
export interface UpdateListingPatch {
  title?: string;
  description?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  valueKind?: ListingValueKind;
  valueMin?: number;
  /** null = repasse en 'fixed' (pas de max) ; nombre = borne haute. */
  valueMax?: number | null;
  currency?: string;
  city?: string;
  location?: GeoPoint | null;
  exchangePrefs?: ExchangePref[];
  externalLinks?: ListingExternalLink[];
}

/** Filtres de la liste PUBLIQUE des annonces (annuaire Dealplace). Tous
 * facultatifs sauf la pagination. Ne renvoie que les annonces 'active'. */
export interface ListPublicListingsParams {
  family?: ListingFamily;
  categorySlug?: string;
  subcategorySlug?: string;
  city?: string;
  /** Borne basse sur la valeur (euros) — compare à valueMin. */
  valueMin?: number;
  /** Borne haute sur la valeur (euros) — compare à valueMin (fixed) ou valueMax. */
  valueMax?: number;
  /** Sous-ensemble de tags : l'annonce doit porter TOUS ces tags. */
  tagSlugs?: string[];
  /** Recherche insensible à la casse sur le titre et la description. */
  search?: string;
  limit: number;
  offset: number;
}

/** Page des annonces d'un propriétaire, filtrée par statuts (profil public :
 * ['active'] ; « mes annonces » : ['active','hidden'] — jamais 'deleted' seul,
 * mais l'appelant reste libre). */
export interface ListOwnerListingsParams {
  statuses?: ListingStatus[];
  limit: number;
  offset: number;
}

/** Filtres de la liste BACKOFFICE des annonces : TOUS statuts par défaut (y
 * compris 'deleted' — audit), filtres facultatifs. `search` porte sur le
 * titre, la description ET le nom affiché du propriétaire (insensible à la
 * casse). */
export interface AdminListListingsParams {
  family?: ListingFamily;
  categorySlug?: string;
  status?: ListingStatus;
  /** true : seulement les annonces de catégorie 'sensitive'/'forbidden'
   * (file de modération) ; false : seulement 'standard' ; absent : toutes. */
  flaggedOnly?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

export interface ListingsRepository {
  findById(id: string): Promise<Listing | null>;
  findByUrlSlug(urlSlug: string): Promise<Listing | null>;
  /** Crée l'annonce AVEC ses médias et ses tags de façon atomique (équivalent
   * transaction SQL). Vérifie les FK (owner, catégorie, sous-catégorie, tags),
   * l'unicité de url_slug et les contraintes de valeur/exchangePrefs. */
  create(input: CreateListingInput): Promise<Listing>;
  update(id: string, patch: UpdateListingPatch): Promise<Listing>;
  /** Remplace INTÉGRALEMENT l'ensemble des tags d'une annonce (PATCH tags par
   * le propriétaire) : purge les liens existants puis réinsère `tagSlugs`
   * (dédoublonnés). Chaque slug doit exister (FK listing_tags — même message
   * d'erreur que create). Opération atomique (équivalent transaction SQL). */
  setTags(id: string, tagSlugs: string[]): Promise<void>;
  setStatus(id: string, status: ListingStatus): Promise<Listing>;
  /** Annuaire PUBLIC paginé : annonces 'active' uniquement, antéchronologique
   * (tie-break id — ordre stable), filtres family/category/subcategory/city/
   * valeur/tags/recherche. */
  listPublic(params: ListPublicListingsParams): Promise<PagedResult<Listing>>;
  /** Annonces d'un propriétaire, filtrées par statuts, antéchronologiques. */
  listByOwner(
    ownerId: string,
    params: ListOwnerListingsParams,
  ): Promise<PagedResult<Listing>>;
  /** Liste BACKOFFICE paginée : tous statuts, filtres et recherche titre/
   * description/nom du propriétaire, antéchronologique (tie-break id). */
  listAdmin(params: AdminListListingsParams): Promise<PagedResult<Listing>>;
  /** Médias de plusieurs annonces EN UN APPEL (page d'annuaire — évite les
   * N+1), triés par position croissante au sein de chaque annonce. */
  listMediaByListingIds(listingIds: string[]): Promise<ListingMedia[]>;
  /** Slugs de tags de plusieurs annonces EN UN APPEL : { listingId → slugs[] }
   * (slugs triés). Les annonces sans tag sont absentes du résultat. */
  listTagsByListingIds(
    listingIds: string[],
  ): Promise<Record<string, string[]>>;
}

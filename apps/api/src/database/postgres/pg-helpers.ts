/**
 * Helpers partagés du driver postgres.
 *
 * Trois responsabilités :
 *  1. `query` / `withTransaction` : exécution de SQL BRUT paramétré (jamais de
 *     concaténation de valeurs — toujours $1, $2, ... et un tableau de params).
 *  2. Les MAPPERS ligne → entité (rowToUser, rowToPost, ...) : convertissent le
 *     snake_case SQL en camelCase du domaine, désérialisent le jsonb et
 *     reconstruisent les GeoPoint {lat,lng}.
 *  3. Des FRAGMENTS SQL réutilisables (listes de colonnes + expressions
 *     ST_X/ST_Y) pour les tables géométriques.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONVENTION GÉOMÉTRIE (IMPORTANTE, à respecter dans TOUS les SELECT)
 * ─────────────────────────────────────────────────────────────────────────────
 * Les colonnes `location` sont de type geometry(Point,4326). Les mappers ne
 * lisent JAMAIS la géométrie binaire : ils lisent deux colonnes scalaires
 * `lat` et `lng` que les SELECT DOIVENT exposer via :
 *
 *     ST_Y(location) AS lat, ST_X(location) AS lng
 *
 * (ST_X = longitude, ST_Y = latitude). Le mapper construit alors
 * `location = { lat, lng }` si les deux valeurs sont non nulles, sinon `null`.
 * À l'écriture, on repasse par ST_SetSRID(ST_MakePoint($lng, $lat), 4326).
 *
 * Les fragments SQL_*_COLUMNS ci-dessous encapsulent cette convention : les
 * repositories (phase suivante) les réutilisent au lieu de réécrire les listes
 * de colonnes à la main, garantissant que `lat`/`lng` sont toujours exposés.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import {
  Camera,
  CameraCategory,
  CameraStatus,
  CameraStreamType,
  Comment,
  CommentDepth,
  CommentStatus,
  Conversation,
  Deal,
  DealAdjustment,
  DealAdjustmentKind,
  DealAdjustmentStatus,
  DealDisputeResolution,
  DealItem,
  DealItemKind,
  DealItemStep,
  DealNote,
  DealReview,
  DealStatus,
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
  Message,
  MessageStatus,
  ModerationLevel,
  Notification,
  NotificationType,
  Dish,
  DishStatus,
  Page,
  PageContentStatus,
  PageDocument,
  PageEvent,
  PageHour,
  PageMenu,
  PageOffer,
  PageStatus,
  PageType,
  Post,
  PostMedia,
  PostMediaType,
  PostStatus,
  PostType,
  PostVisibility,
  Reaction,
  ReactionTargetType,
  ReactionType,
  Report,
  ReportReasonCode,
  ReportStatus,
  ReportTargetType,
  User,
  UserRole,
  UserStatus,
} from '../domain/entities';

// ────────────────────────────────────────────────────────────────────────────
// Exécution SQL
// ────────────────────────────────────────────────────────────────────────────

/** Ligne SQL brute : un enregistrement clé → valeur avant mapping. */
export type SqlRow = QueryResultRow;

/**
 * Exécute une requête SQL paramétrée sur le pool et renvoie le résultat pg.
 * Les valeurs passent TOUJOURS par `params` (placeholders $1, $2, ...) : aucune
 * interpolation de valeur dans la chaîne SQL (protection injection).
 */
export function query<R extends QueryResultRow = SqlRow>(
  pool: Pool,
  sql: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<R>> {
  // `params` est typé readonly pour l'appelant ; pg attend un tableau mutable.
  return pool.query<R>(sql, params as unknown[]);
}

/**
 * Exécute `fn` dans une TRANSACTION (BEGIN / COMMIT, ROLLBACK sur erreur).
 *
 * `fn` reçoit le client dédié à la transaction : toutes ses requêtes DOIVENT
 * passer par ce client (pas par le pool) pour rester dans la même transaction.
 * Le client est TOUJOURS relâché (`release`), succès ou échec. Sert au seeder
 * (insertion atomique) et à toute écriture multi-tables (ex. post + médias).
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // Annule proprement ; on avale une éventuelle erreur de ROLLBACK pour ne
    // pas masquer l'erreur d'origine (qui est celle qui compte).
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connexion probablement déjà cassée : l'erreur d'origine prime */
    }
    throw error;
  } finally {
    client.release();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Conversions primitives
// ────────────────────────────────────────────────────────────────────────────

/**
 * Reconstruit un GeoPoint depuis les colonnes scalaires `lat`/`lng` exposées
 * par le SELECT (voir la CONVENTION GÉOMÉTRIE en tête de fichier). Renvoie
 * `null` dès qu'une des deux coordonnées est absente/nulle (colonne location
 * NULL en base). node-postgres peut renvoyer les valeurs numériques en `number`
 * ou en `string` selon le type : on force donc `Number(...)`.
 */
export function rowToGeoPoint(row: {
  lat?: number | string | null;
  lng?: number | string | null;
}): GeoPoint | null {
  if (row.lat === null || row.lat === undefined) {
    return null;
  }
  if (row.lng === null || row.lng === undefined) {
    return null;
  }
  return { lat: Number(row.lat), lng: Number(row.lng) };
}

/** timestamptz → Date (node-postgres renvoie déjà un Date, on sécurise le null). */
function toDate(value: Date | string | null | undefined): Date {
  if (value instanceof Date) {
    return value;
  }
  // Valeur inattendue (string) : on la convertit ; un null sur une colonne
  // NOT NULL signalerait un bug de requête — on ne le masque pas silencieusement.
  return new Date(value as string);
}

/** timestamptz nullable → Date | null. */
function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  return toDate(value);
}

/**
 * jsonb → objet. node-postgres désérialise déjà le jsonb en objet JS ; ce
 * helper couvre les cas de bord (valeur renvoyée en string, ou null) pour
 * toujours produire un Record non nul (miroir du DEFAULT '{}' côté SQL).
 */
function toJsonObject(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return {};
  }
  if (typeof value === 'string') {
    return JSON.parse(value) as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

/**
 * jsonb (tableau) → tableau de liens externes {label, url}. node-postgres
 * désérialise déjà le jsonb ; ce helper couvre les cas de bord (string, null)
 * et se protège d'une valeur mal formée pour toujours renvoyer un tableau
 * (miroir du DEFAULT '[]' de listings.external_links). On ne conserve que les
 * entrées ayant label ET url en chaîne.
 */
function toExternalLinks(value: unknown): ListingExternalLink[] {
  let parsed: unknown = value;
  if (parsed === null || parsed === undefined) {
    return [];
  }
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed);
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .filter(
      (item): item is { label: unknown; url: unknown } =>
        typeof item === 'object' && item !== null,
    )
    .filter(
      (item) => typeof item.label === 'string' && typeof item.url === 'string',
    )
    .map((item) => ({ label: item.label as string, url: item.url as string }));
}

/**
 * text[] PostgreSQL → tableau de chaînes typé. node-postgres renvoie déjà un
 * tableau JS pour une colonne text[] ; ce helper sécurise le null (colonne
 * absente) en tableau vide.
 */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  return [];
}

// ────────────────────────────────────────────────────────────────────────────
// Mappers ligne → entité (une fonction par entité du domaine)
// ────────────────────────────────────────────────────────────────────────────
//
// Chaque mapper suppose que le SELECT a exposé les colonnes attendues (voir les
// fragments SQL_*_COLUMNS). Les compteurs dénormalisés (followersCount,
// reactionCount, ...) sont CALCULÉS À LA LECTURE par les repositories via des
// sous-requêtes : ils arrivent ici comme des colonnes agrégées et sont mappés
// tels quels (Number(...) car COUNT() renvoie un bigint = string côté pg).

export function rowToUser(row: SqlRow): User {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    coverUrl: (row.cover_url as string | null) ?? null,
    bio: row.bio as string,
    city: (row.city as string | null) ?? null,
    dealplaceSeeking: (row.dealplace_seeking as string | null) ?? null,
    location: rowToGeoPoint(row),
    settings: toJsonObject(row.settings),
    role: row.role as UserRole,
    status: row.status as UserStatus,
    // Compteurs calculés à la lecture (sous-requêtes) : absents = 0.
    followersCount: Number(row.followers_count ?? 0),
    followingCount: Number(row.following_count ?? 0),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    deletedAt: toDateOrNull(row.deleted_at),
  };
}

export function rowToPostType(row: SqlRow): PostType {
  return {
    slug: row.slug as string,
    labelFr: row.label_fr as string,
    icon: row.icon as string,
    color: row.color as string,
    requiresLocationForMap: row.requires_location_for_map as boolean,
    showsOnMap: row.shows_on_map as boolean,
    defaultMapDurationMinutes:
      row.default_map_duration_minutes === null ||
      row.default_map_duration_minutes === undefined
        ? null
        : Number(row.default_map_duration_minutes),
    pageOnly: row.page_only as boolean,
    isActive: row.is_active as boolean,
    position: Number(row.position),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function rowToReactionType(row: SqlRow): ReactionType {
  return {
    emoji: row.emoji as string,
    labelFr: row.label_fr as string,
    position: Number(row.position),
    isActive: row.is_active as boolean,
  };
}

export function rowToPost(row: SqlRow): Post {
  return {
    id: row.id as string,
    authorId: row.author_id as string,
    pageId: (row.page_id as string | null) ?? null,
    typeSlug: row.type_slug as string,
    title: (row.title as string | null) ?? null,
    body: row.body as string,
    location: rowToGeoPoint(row),
    city: (row.city as string | null) ?? null,
    visibility: row.visibility as PostVisibility,
    status: row.status as PostStatus,
    urlSlug: row.url_slug as string,
    mapExpiresAt: toDateOrNull(row.map_expires_at),
    mapVisibleFrom: toDateOrNull(row.map_visible_from),
    // Compteurs calculés à la lecture (sous-requêtes) : absents = 0.
    reactionCount: Number(row.reaction_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    shareCount: Number(row.share_count ?? 0),
    saveCount: Number(row.save_count ?? 0),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function rowToPostMedia(row: SqlRow): PostMedia {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    mediaType: row.media_type as PostMediaType,
    url: row.url as string,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    width:
      row.width === null || row.width === undefined ? null : Number(row.width),
    height:
      row.height === null || row.height === undefined
        ? null
        : Number(row.height),
    position: Number(row.position),
    createdAt: toDate(row.created_at),
  };
}

export function rowToComment(row: SqlRow): Comment {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    authorId: row.author_id as string,
    parentCommentId: (row.parent_comment_id as string | null) ?? null,
    depth: Number(row.depth) as CommentDepth,
    body: row.body as string,
    status: row.status as CommentStatus,
    // Compteur calculé à la lecture (sous-requête) : absent = 0.
    reactionCount: Number(row.reaction_count ?? 0),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function rowToReaction(row: SqlRow): Reaction {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    targetType: row.target_type as ReactionTargetType,
    targetId: row.target_id as string,
    emoji: row.emoji as string,
    createdAt: toDate(row.created_at),
  };
}

export function rowToSavedCollection(row: SqlRow): import('../domain/entities').SavedCollection {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    isDefault: row.is_default as boolean,
    createdAt: toDate(row.created_at),
  };
}

export function rowToCamera(row: SqlRow): Camera {
  const location = rowToGeoPoint(row);
  return {
    id: row.id as string,
    cameraNumber: Number(row.camera_number),
    name: row.name as string,
    streamType: row.stream_type as CameraStreamType,
    url: row.url as string,
    category: row.category as CameraCategory,
    description: row.description as string,
    // location est NOT NULL côté SQL : une caméra est toujours géolocalisée.
    // Le `?? { lat: 0, lng: 0 }` n'est là que pour satisfaire le typage non-null
    // (Camera.location: GeoPoint) ; en pratique location n'est jamais nul.
    location: location ?? { lat: 0, lng: 0 },
    cityName: row.city_name as string,
    districtName: (row.district_name as string | null) ?? null,
    status: row.status as CameraStatus,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function rowToReport(row: SqlRow): Report {
  return {
    id: row.id as string,
    reporterId: row.reporter_id as string,
    targetType: row.target_type as ReportTargetType,
    targetId: row.target_id as string,
    reasonCode: row.reason_code as ReportReasonCode,
    message: row.message as string,
    status: row.status as ReportStatus,
    handledBy: (row.handled_by as string | null) ?? null,
    handledAt: toDateOrNull(row.handled_at),
    resolutionNote: (row.resolution_note as string | null) ?? null,
    createdAt: toDate(row.created_at),
  };
}

export function rowToNotification(row: SqlRow): Notification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as NotificationType,
    payload: toJsonObject(row.payload),
    readAt: toDateOrNull(row.read_at),
    createdAt: toDate(row.created_at),
  };
}

// ── Dealplace : taxonomie + annonces ────────────────────────────────────────

export function rowToListingCategory(row: SqlRow): ListingCategory {
  return {
    slug: row.slug as string,
    family: row.family as ListingFamily,
    labelFr: row.label_fr as string,
    position: Number(row.position),
    moderationLevel: row.moderation_level as ModerationLevel,
    isActive: row.is_active as boolean,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function rowToListingSubcategory(row: SqlRow): ListingSubcategory {
  return {
    slug: row.slug as string,
    categorySlug: row.category_slug as string,
    labelFr: row.label_fr as string,
    position: Number(row.position),
    isActive: row.is_active as boolean,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function rowToListingTag(row: SqlRow): ListingTag {
  return {
    slug: row.slug as string,
    labelFr: row.label_fr as string,
    isActive: row.is_active as boolean,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function rowToListing(row: SqlRow): Listing {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    listingType: row.listing_type as ListingFamily,
    title: row.title as string,
    description: row.description as string,
    categorySlug: row.category_slug as string,
    subcategorySlug: row.subcategory_slug as string,
    valueKind: row.value_kind as ListingValueKind,
    valueMin: Number(row.value_min),
    valueMax:
      row.value_max === null || row.value_max === undefined
        ? null
        : Number(row.value_max),
    currency: row.currency as string,
    city: row.city as string,
    // location reconstruit depuis les colonnes lat/lng (convention géométrie).
    location: rowToGeoPoint(row),
    exchangePrefs: toStringArray(row.exchange_prefs) as ExchangePref[],
    externalLinks: toExternalLinks(row.external_links),
    urlSlug: row.url_slug as string,
    status: row.status as ListingStatus,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    deletedAt: toDateOrNull(row.deleted_at),
  };
}

export function rowToListingMedia(row: SqlRow): ListingMedia {
  return {
    id: row.id as string,
    listingId: row.listing_id as string,
    mediaType: row.media_type as ListingMediaType,
    url: row.url as string,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    width:
      row.width === null || row.width === undefined ? null : Number(row.width),
    height:
      row.height === null || row.height === undefined
        ? null
        : Number(row.height),
    position: Number(row.position),
    createdAt: toDate(row.created_at),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Fragments SQL réutilisables (listes de colonnes)
// ────────────────────────────────────────────────────────────────────────────
//
// Ces fragments centralisent la CONVENTION GÉOMÉTRIE : pour les tables avec une
// colonne `location`, ils exposent ST_Y(...) AS lat / ST_X(...) AS lng afin que
// les mappers rowToGeoPoint(...) fonctionnent. Ils listent les colonnes de BASE
// (hors compteurs dénormalisés, calculés à la lecture par sous-requête dans les
// repositories). Réutilisez-les dans les SELECT plutôt que de retaper `*`.
//
// Usage attendu (phase repositories), ex. :
//   `SELECT ${SQL_USER_COLUMNS} FROM users u WHERE u.id = $1`
// L'alias de table est fixé par convention (u = users, p = posts, c = cameras).

/** Colonnes de `users` (alias de table `u`) — compteurs exclus (sous-requête). */
export const SQL_USER_COLUMNS = `
  u.id,
  u.email,
  u.password_hash,
  u.display_name,
  u.avatar_url,
  u.cover_url,
  u.bio,
  u.city,
  u.dealplace_seeking,
  ST_Y(u.location) AS lat,
  ST_X(u.location) AS lng,
  u.settings,
  u.role,
  u.status,
  u.created_at,
  u.updated_at,
  u.deleted_at
`.trim();

/** Colonnes de `posts` (alias de table `p`) — compteurs exclus (sous-requête). */
export const SQL_POST_COLUMNS = `
  p.id,
  p.author_id,
  p.page_id,
  p.type_slug,
  p.title,
  p.body,
  ST_Y(p.location) AS lat,
  ST_X(p.location) AS lng,
  p.city,
  p.visibility,
  p.status,
  p.url_slug,
  p.map_expires_at,
  p.map_visible_from,
  p.share_count,
  p.created_at,
  p.updated_at
`.trim();

/** Colonnes de `cameras` (alias de table `c`). */
export const SQL_CAMERA_COLUMNS = `
  c.id,
  c.camera_number,
  c.name,
  c.stream_type,
  c.url,
  c.category,
  c.description,
  ST_Y(c.location) AS lat,
  ST_X(c.location) AS lng,
  c.city_name,
  c.district_name,
  c.status,
  c.created_at,
  c.updated_at
`.trim();

/** Colonnes de `listings` (alias de table `l`) — location exposée en lat/lng
 * (convention géométrie). Pas de compteur dénormalisé sur les annonces au
 * CP2.1 : la liste des colonnes suffit. */
export const SQL_LISTING_COLUMNS = `
  l.id,
  l.owner_id,
  l.listing_type,
  l.title,
  l.description,
  l.category_slug,
  l.subcategory_slug,
  l.value_kind,
  l.value_min,
  l.value_max,
  l.currency,
  l.city,
  ST_Y(l.location) AS lat,
  ST_X(l.location) AS lng,
  l.exchange_prefs,
  l.external_links,
  l.url_slug,
  l.status,
  l.created_at,
  l.updated_at,
  l.deleted_at
`.trim();

/**
 * Expression SQL d'écriture d'une géométrie Point(4326) depuis deux paramètres
 * (longitude puis latitude). Passez les numéros de placeholder, ex. pour $3=lng
 * et $4=lat : `geoPointToSql('$3', '$4')` → ST_SetSRID(ST_MakePoint($3,$4),4326).
 * Rappel ORDRE : ST_MakePoint(lng, lat) — longitude d'abord.
 */
export function geoPointToSql(lngPlaceholder: string, latPlaceholder: string): string {
  return `ST_SetSRID(ST_MakePoint(${lngPlaceholder}, ${latPlaceholder}), 4326)`;
}

// ────────────────────────────────────────────────────────────────────────────
// Conversations 1-to-1 (Lot 2 — CP2.3)
// ────────────────────────────────────────────────────────────────────────────

/** Colonnes de `conversations` (alias de table `c`). */
export const SQL_CONVERSATION_COLUMNS = `
  c.id,
  c.listing_id,
  c.page_id,
  c.initiator_id,
  c.owner_id,
  c.initiator_last_read_at,
  c.owner_last_read_at,
  c.last_message_at,
  c.created_at,
  c.updated_at
`.trim();

/** Colonnes de `messages` (alias de table `m`). */
export const SQL_MESSAGE_COLUMNS = `
  m.id,
  m.conversation_id,
  m.sender_id,
  m.body,
  m.status,
  m.created_at
`.trim();

export function rowToConversation(row: SqlRow): Conversation {
  return {
    id: row.id as string,
    listingId: (row.listing_id as string | null) ?? null,
    pageId: (row.page_id as string | null) ?? null,
    initiatorId: row.initiator_id as string,
    ownerId: row.owner_id as string,
    initiatorLastReadAt: toDateOrNull(row.initiator_last_read_at),
    ownerLastReadAt: toDateOrNull(row.owner_last_read_at),
    lastMessageAt: toDateOrNull(row.last_message_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function rowToMessage(row: SqlRow): Message {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    senderId: row.sender_id as string,
    body: row.body as string,
    status: row.status as MessageStatus,
    createdAt: toDate(row.created_at),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Deals contractuels + avis (Lot 2 — CP2.4)
// ────────────────────────────────────────────────────────────────────────────

/** Colonnes de `deals` (alias de table `d`). */
export const SQL_DEAL_COLUMNS = `
  d.id,
  d.deal_number,
  d.listing_id,
  d.conversation_id,
  d.proposer_id,
  d.recipient_id,
  d.status,
  d.due_date,
  d.cancellation_requested_by,
  d.disputed_by,
  d.dispute_reason,
  d.dispute_resolved_by,
  d.dispute_resolved_at,
  d.dispute_resolution,
  d.dispute_resolution_note,
  d.accepted_at,
  d.completed_at,
  d.closed_at,
  d.created_at,
  d.updated_at
`.trim();

/** Colonnes de `deal_items` (alias de table `i`). */
export const SQL_DEAL_ITEM_COLUMNS = `
  i.id,
  i.deal_id,
  i.provider_id,
  i.kind,
  i.title,
  i.description,
  i.value,
  i.position,
  i.created_at
`.trim();

/** Colonnes de `deal_item_steps` (alias de table `s`). */
export const SQL_DEAL_STEP_COLUMNS = `
  s.id,
  s.item_id,
  s.label,
  s.position,
  s.honored_at,
  s.validated_at
`.trim();

export function rowToDeal(row: SqlRow): Deal {
  return {
    id: row.id as string,
    dealNumber: Number(row.deal_number),
    listingId: row.listing_id as string,
    conversationId: (row.conversation_id as string | null) ?? null,
    proposerId: row.proposer_id as string,
    recipientId: row.recipient_id as string,
    status: row.status as DealStatus,
    dueDate: toDateOrNull(row.due_date),
    cancellationRequestedBy:
      (row.cancellation_requested_by as string | null) ?? null,
    disputedBy: (row.disputed_by as string | null) ?? null,
    disputeReason: (row.dispute_reason as string | null) ?? null,
    disputeResolvedBy: (row.dispute_resolved_by as string | null) ?? null,
    disputeResolvedAt: toDateOrNull(row.dispute_resolved_at),
    disputeResolution:
      (row.dispute_resolution as DealDisputeResolution | null) ?? null,
    disputeResolutionNote:
      (row.dispute_resolution_note as string | null) ?? null,
    acceptedAt: toDateOrNull(row.accepted_at),
    completedAt: toDateOrNull(row.completed_at),
    closedAt: toDateOrNull(row.closed_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function rowToDealItem(row: SqlRow): DealItem {
  return {
    id: row.id as string,
    dealId: row.deal_id as string,
    providerId: row.provider_id as string,
    kind: row.kind as DealItemKind,
    title: row.title as string,
    description: (row.description as string) ?? '',
    value: Number(row.value),
    position: Number(row.position),
    createdAt: toDate(row.created_at),
  };
}

export function rowToDealItemStep(row: SqlRow): DealItemStep {
  return {
    id: row.id as string,
    itemId: row.item_id as string,
    label: row.label as string,
    position: Number(row.position),
    honoredAt: toDateOrNull(row.honored_at),
    validatedAt: toDateOrNull(row.validated_at),
  };
}

export function rowToDealAdjustment(row: SqlRow): DealAdjustment {
  return {
    id: row.id as string,
    dealId: row.deal_id as string,
    proposedBy: row.proposed_by as string,
    kind: row.kind as DealAdjustmentKind,
    itemId: (row.item_id as string | null) ?? null,
    payload: toJsonObject(row.payload),
    description: row.description as string,
    status: row.status as DealAdjustmentStatus,
    decidedAt: toDateOrNull(row.decided_at),
    createdAt: toDate(row.created_at),
  };
}

export function rowToDealNote(row: SqlRow): DealNote {
  return {
    id: row.id as string,
    dealId: row.deal_id as string,
    authorId: row.author_id as string,
    body: row.body as string,
    createdAt: toDate(row.created_at),
  };
}

export function rowToDealReview(row: SqlRow): DealReview {
  return {
    id: row.id as string,
    dealId: row.deal_id as string,
    reviewerId: row.reviewer_id as string,
    revieweeId: row.reviewee_id as string,
    ratingHonesty: Number(row.rating_honesty),
    ratingConformity: Number(row.rating_conformity),
    ratingKindness: Number(row.rating_kindness),
    comment: (row.comment as string | null) ?? null,
    createdAt: toDate(row.created_at),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Pages restaurants & entreprises (Lot 3 — D69-D76)
// ────────────────────────────────────────────────────────────────────────────

/** Colonnes de la table `pages` (alias `pa`) — lat/lng extraits de la
 * géométrie comme partout (ST_X = longitude, ST_Y = latitude). */
export const SQL_PAGE_COLUMNS = `
  pa.id,
  pa.owner_id,
  pa.page_type,
  pa.name,
  pa.url_slug,
  pa.bio,
  pa.avatar_url,
  pa.cover_url,
  pa.city,
  ST_Y(pa.location) AS lat,
  ST_X(pa.location) AS lng,
  pa.phone,
  pa.attributes,
  pa.vacation_until,
  pa.vacation_message,
  pa.verified,
  pa.status,
  pa.created_at,
  pa.updated_at,
  pa.deleted_at
`.trim();

export function rowToPage(row: SqlRow): Page {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    pageType: row.page_type as PageType,
    name: row.name as string,
    urlSlug: row.url_slug as string,
    bio: row.bio as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    coverUrl: (row.cover_url as string | null) ?? null,
    city: row.city as string,
    location: rowToGeoPoint(row),
    phone: (row.phone as string | null) ?? null,
    attributes: toStringArray(row.attributes),
    vacationUntil: toDateOrNull(row.vacation_until),
    vacationMessage: (row.vacation_message as string | null) ?? null,
    verified: row.verified as boolean,
    status: row.status as PageStatus,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    deletedAt: toDateOrNull(row.deleted_at),
  };
}

/** Colonnes de la table `page_hours` (alias `h`). */
export const SQL_PAGE_HOUR_COLUMNS = `
  h.id,
  h.page_id,
  h.weekday,
  h.opens_minute,
  h.closes_minute,
  h.position
`.trim();

export function rowToPageHour(row: SqlRow): PageHour {
  return {
    id: row.id as string,
    pageId: row.page_id as string,
    weekday: Number(row.weekday),
    opensMinute: Number(row.opens_minute),
    closesMinute: Number(row.closes_minute),
    position: Number(row.position),
  };
}

/** Colonnes de la table `page_documents` (alias `pd`). */
export const SQL_PAGE_DOCUMENT_COLUMNS = `
  pd.id,
  pd.page_id,
  pd.label,
  pd.url,
  pd.file_size_bytes,
  pd.position,
  pd.created_at
`.trim();

export function rowToPageDocument(row: SqlRow): PageDocument {
  return {
    id: row.id as string,
    pageId: row.page_id as string,
    label: row.label as string,
    url: row.url as string,
    fileSizeBytes: Number(row.file_size_bytes),
    position: Number(row.position),
    createdAt: toDate(row.created_at),
  };
}

/** Colonnes de la table `dishes` (alias `di`). */
export const SQL_DISH_COLUMNS = `
  di.id,
  di.page_id,
  di.name,
  di.description,
  di.image_url,
  di.price_takeaway_cents,
  di.price_dinein_cents,
  di.position,
  di.status,
  di.created_at,
  di.updated_at
`.trim();

export function rowToDish(row: SqlRow): Dish {
  return {
    id: row.id as string,
    pageId: row.page_id as string,
    name: row.name as string,
    description: row.description as string,
    imageUrl: (row.image_url as string | null) ?? null,
    priceTakeawayCents:
      row.price_takeaway_cents === null ||
      row.price_takeaway_cents === undefined
        ? null
        : Number(row.price_takeaway_cents),
    priceDineInCents:
      row.price_dinein_cents === null || row.price_dinein_cents === undefined
        ? null
        : Number(row.price_dinein_cents),
    position: Number(row.position),
    status: row.status as DishStatus,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/** Colonnes de la table `page_menus` (alias `pm`) — `menu_date` est
 * sérialisée en 'YYYY-MM-DD' via to_char (jamais de Date locale ambiguë). */
export const SQL_PAGE_MENU_COLUMNS = `
  pm.id,
  pm.page_id,
  to_char(pm.menu_date, 'YYYY-MM-DD') AS menu_date,
  pm.created_at,
  pm.updated_at
`.trim();

export function rowToPageMenu(row: SqlRow): PageMenu {
  return {
    id: row.id as string,
    pageId: row.page_id as string,
    menuDate: row.menu_date as string,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/** Colonnes de la table `page_offers` (alias `po`). */
export const SQL_PAGE_OFFER_COLUMNS = `
  po.id,
  po.page_id,
  po.title,
  po.description,
  po.image_url,
  po.starts_at,
  po.ends_at,
  po.status,
  po.created_at,
  po.updated_at
`.trim();

export function rowToPageOffer(row: SqlRow): PageOffer {
  return {
    id: row.id as string,
    pageId: row.page_id as string,
    title: row.title as string,
    description: row.description as string,
    imageUrl: (row.image_url as string | null) ?? null,
    startsAt: toDateOrNull(row.starts_at),
    endsAt: toDateOrNull(row.ends_at),
    status: row.status as PageContentStatus,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/** Colonnes de la table `page_events` (alias `pe`). */
export const SQL_PAGE_EVENT_COLUMNS = `
  pe.id,
  pe.page_id,
  pe.title,
  pe.description,
  pe.image_url,
  pe.starts_at,
  pe.ends_at,
  pe.status,
  pe.created_at,
  pe.updated_at
`.trim();

export function rowToPageEvent(row: SqlRow): PageEvent {
  return {
    id: row.id as string,
    pageId: row.page_id as string,
    title: row.title as string,
    description: row.description as string,
    imageUrl: (row.image_url as string | null) ?? null,
    startsAt: toDate(row.starts_at),
    endsAt: toDateOrNull(row.ends_at),
    status: row.status as PageContentStatus,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

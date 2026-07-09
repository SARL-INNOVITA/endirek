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
  GeoPoint,
  Notification,
  NotificationType,
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

/**
 * Expression SQL d'écriture d'une géométrie Point(4326) depuis deux paramètres
 * (longitude puis latitude). Passez les numéros de placeholder, ex. pour $3=lng
 * et $4=lat : `geoPointToSql('$3', '$4')` → ST_SetSRID(ST_MakePoint($3,$4),4326).
 * Rappel ORDRE : ST_MakePoint(lng, lat) — longitude d'abord.
 */
export function geoPointToSql(lngPlaceholder: string, latPlaceholder: string): string {
  return `ST_SetSRID(ST_MakePoint(${lngPlaceholder}, ${latPlaceholder}), 4326)`;
}

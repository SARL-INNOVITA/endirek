/**
 * Entités du domaine Endirek — miroir TypeScript EXACT du schéma PostgreSQL
 * (apps/api/db/migrations/0001_lot1_init.sql, documenté dans docs/DATABASE.md).
 *
 * Conventions :
 * - snake_case côté SQL ↔ camelCase ici (ex. `password_hash` → `passwordHash`) ;
 * - `geometry(Point,4326)` ↔ `GeoPoint | null` (lat/lng WGS84) ;
 * - `timestamptz` ↔ `Date` ;
 * - les statuts sont des unions de chaînes, miroir des contraintes CHECK
 *   (évolutif : élargir l'union quand le CHECK SQL est élargi).
 *
 * Ces interfaces sont partagées par tous les drivers (mock aujourd'hui,
 * postgres demain) : le code métier ne dépend que d'elles.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types utilitaires
// ────────────────────────────────────────────────────────────────────────────

/** Point géographique WGS84 — équivalent TS de `geometry(Point,4326)`. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Boîte englobante (requêtes carte) : bornes incluses, WGS84. */
export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/** Rôle d'un utilisateur — CHECK (role IN ('user','moderator','super_admin')). */
export type UserRole = 'user' | 'moderator' | 'super_admin';

/** Statut d'un compte utilisateur. */
export type UserStatus = 'active' | 'suspended' | 'deleted';

/** Statut d'une publication. NB : « reported » n'est PAS un statut de post —
 * l'état de signalement vit dans la table `reports` (un post signalé peut
 * rester `active` tant que la modération n'a pas tranché). */
export type PostStatus = 'active' | 'hidden' | 'deleted';

/** Visibilité d'une publication — 'public' seul au Lot 1 (évolutif). */
export type PostVisibility = 'public';

/** Statut d'un commentaire. */
export type CommentStatus = 'active' | 'hidden' | 'deleted';

/** Profondeur d'un commentaire — option A validée : 0 = commentaire principal,
 * 1 = réponse à un commentaire principal. Pas de réponse à une réponse au Lot 1. */
export type CommentDepth = 0 | 1;

/** Type d'un média attaché à un post. */
export type PostMediaType = 'image' | 'video';

/** Cible d'une réaction (association polymorphe, intégrité au niveau service). */
export type ReactionTargetType = 'post' | 'comment';

/** Cible d'un signalement (association polymorphe, intégrité au niveau service). */
export type ReportTargetType = 'post' | 'comment' | 'user';

/** Motifs de signalement documentés (TEXT côté SQL, codes pilotés côté app). */
export type ReportReasonCode =
  | 'spam'
  | 'hateful'
  | 'dangerous'
  | 'false_info'
  | 'other';

/** Cycle de vie d'un signalement côté modération. */
export type ReportStatus = 'open' | 'reviewed' | 'action_taken' | 'dismissed';

/** Type de flux d'une caméra. */
export type CameraStreamType = 'image' | 'video' | 'iframe';

/** Catégorie d'une caméra (onglets météo / trafic). */
export type CameraCategory = 'weather' | 'traffic';

/** Statut d'une caméra. */
export type CameraStatus = 'active' | 'inactive' | 'error' | 'hidden';

/** Types de notification documentés (TEXT côté SQL, codes pilotés côté app). */
export type NotificationType =
  | 'comment'
  | 'reply'
  | 'reaction'
  | 'report_handled'
  | 'system';

// ────────────────────────────────────────────────────────────────────────────
// Dealplace (Lot 2 — CP2.1) : taxonomie biens/services + annonces (listings)
// ────────────────────────────────────────────────────────────────────────────

/** Famille d'une catégorie / type d'une annonce Dealplace —
 * CHECK (family IN ('good','service')) et CHECK (listing_type IN (...)). */
export type ListingFamily = 'good' | 'service';

/** Niveau de modération d'une catégorie Dealplace :
 * - 'standard'  : catégorie normale ;
 * - 'sensitive' : autorisée mais MARQUÉE (les annonces héritent d'un flag pour
 *   la modération) ;
 * - 'forbidden' : création d'annonce REFUSÉE par le service (400). */
export type ModerationLevel = 'standard' | 'sensitive' | 'forbidden';

/** Nature de la valeur d'une annonce — CHECK (value_kind IN ('fixed','range')).
 * 'fixed' : prix/valeur unique (valueMin) ; 'range' : fourchette
 * (valueMin ≤ valueMax). */
export type ListingValueKind = 'fixed' | 'range';

/** Statut d'une annonce Dealplace. */
export type ListingStatus = 'active' | 'hidden' | 'deleted';

/** Préférence d'échange d'une annonce (ce que le propriétaire accepte) —
 * exchange_prefs est un sous-ensemble NON VIDE de ces valeurs. */
export type ExchangePref = 'goods' | 'services' | 'money' | 'open';

/** Type d'un média attaché à une annonce (miroir de post_media). */
export type ListingMediaType = 'image' | 'video';

/** Lien externe attaché à une annonce (external_links jsonb : tableau de ceux-ci). */
export interface ListingExternalLink {
  label: string;
  url: string;
}

/** Table `listing_categories` — catégorie de la taxonomie Dealplace, pilotable
 * par le backoffice (comme post_types : rien de hardcodé dans le code métier). */
export interface ListingCategory {
  slug: string;
  family: ListingFamily;
  labelFr: string;
  position: number;
  moderationLevel: ModerationLevel;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Table `listing_subcategories` — sous-catégorie rattachée à une catégorie.
 * Chaque catégorie possède une sous-catégorie de repli « autres-<cat> »
 * (label « Autres »). */
export interface ListingSubcategory {
  slug: string;
  categorySlug: string;
  labelFr: string;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Table `listing_tags` — tag transversal pilotable par le backoffice. */
export interface ListingTag {
  slug: string;
  labelFr: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Table `listings` — annonce Dealplace (bien ou service).
 *
 * Règles métier (appliquées au SERVICE) : valeur obligatoire (fixed → valueMin ;
 * range → valueMin ≤ valueMax) ; PHOTO obligatoire pour listingType='good'
 * (≥1 média) ; commune obligatoire (référentiel communes) ; category+subcategory
 * cohérentes ; exchangePrefs non vide ; catégorie 'forbidden' → création
 * refusée ; 'sensitive' → marquée. `location` = centre de la commune si fournie
 * (adresse exacte JAMAIS stockée). `urlSlug` généré (slug titre + suffixe). */
export interface Listing {
  id: string;
  ownerId: string;
  listingType: ListingFamily;
  title: string;
  description: string;
  categorySlug: string;
  subcategorySlug: string;
  valueKind: ListingValueKind;
  /** Euros entiers, ≥ 0. */
  valueMin: number;
  /** Euros entiers, ≥ valueMin si 'range' ; null si 'fixed'. */
  valueMax: number | null;
  currency: string;
  /** Commune (référentiel communes) — l'adresse exacte n'est jamais stockée. */
  city: string;
  /** Centre de la commune (optionnel) — WGS84. */
  location: GeoPoint | null;
  exchangePrefs: ExchangePref[];
  externalLinks: ListingExternalLink[];
  urlSlug: string;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Table `listing_media` — média attaché à une annonce (image en pratique). */
export interface ListingMedia {
  id: string;
  listingId: string;
  mediaType: ListingMediaType;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  position: number;
  createdAt: Date;
}

// ────────────────────────────────────────────────────────────────────────────
// Entités (une interface par table du Lot 1)
// ────────────────────────────────────────────────────────────────────────────

/** Table `users`. Le rôle (`role`) suffit au backoffice Lot 1 : pas de table
 * admin_users séparée. `deletedAt` : suppression douce RGPD. */
export interface User {
  id: string;
  /** Unicité insensible à la casse (index UNIQUE sur lower(email)). */
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string;
  city: string | null;
  /** Volet Profil Dealplace (CP2.2) : « Ce que je recherche » — texte libre
   * public (500 caractères max, garanti au service), null = non renseigné. */
  dealplaceSeeking: string | null;
  /** Position publique approximative (jamais la position exacte). */
  location: GeoPoint | null;
  settings: Record<string, unknown>;
  role: UserRole;
  status: UserStatus;
  /** Dénormalisé — recalculé par le mock depuis `follows` au chargement. */
  followersCount: number;
  /** Dénormalisé — recalculé par le mock depuis `follows` au chargement. */
  followingCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Table `follows` — PK composite (followerId, followedId), pas d'auto-suivi. */
export interface Follow {
  followerId: string;
  followedId: string;
  createdAt: Date;
}

/** Table `post_types` — vocabulaire pilotable par le backoffice (rien de
 * hardcodé dans le code métier). */
export interface PostType {
  slug: string;
  labelFr: string;
  icon: string;
  color: string;
  /** true : le post doit avoir une location pour apparaître sur la carte. */
  requiresLocationForMap: boolean;
  /** true : ce type de post est éligible à l'affichage carte. */
  showsOnMap: boolean;
  /** Durée de vie carte par défaut (minutes) — null pour les types feed-only. */
  defaultMapDurationMinutes: number | null;
  isActive: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Table `reaction_types` — palette de réactions pilotable par le backoffice. */
export interface ReactionType {
  emoji: string;
  labelFr: string;
  position: number;
  isActive: boolean;
}

/** Table `posts`.
 *
 * Règle métier (SERVICE, pas contrainte DB) : un post weather/traffic/danger
 * n'apparaît sur la carte QUE s'il a une `location` ; sinon il reste feed-only
 * (posture légale). À la création avec location, le service pose
 * `mapExpiresAt = createdAt + defaultMapDurationMinutes` de son type. Après
 * expiration, le post disparaît de la carte mais reste dans le feed. */
export interface Post {
  id: string;
  authorId: string;
  /** Anticipation pages restaurants/entreprises (Lot 3) — AUCUNE FK côté SQL
   * tant que la table `pages` n'existe pas ; toujours null au Lot 1. */
  pageId: string | null;
  typeSlug: string;
  title: string | null;
  body: string;
  location: GeoPoint | null;
  city: string | null;
  visibility: PostVisibility;
  status: PostStatus;
  /** Identifiant public unique pour la future URL web partageable. */
  urlSlug: string;
  /** Fin de visibilité carte — null si le post n'est pas/plus lié à la carte. */
  mapExpiresAt: Date | null;
  /** Dénormalisé — recalculé par le mock depuis `reactions`. */
  reactionCount: number;
  /** Dénormalisé — recalculé par le mock depuis `comments` (statut active). */
  commentCount: number;
  /** Dénormalisé — pas de table source au Lot 1 (partage = Lot ultérieur). */
  shareCount: number;
  /** Dénormalisé — recalculé par le mock depuis `saved_posts`. */
  saveCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Table `post_media`. */
export interface PostMedia {
  id: string;
  postId: string;
  mediaType: PostMediaType;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  position: number;
  createdAt: Date;
}

/** Table `comments` — option A validée : depth 0 (commentaire principal) ou
 * depth 1 (réponse). Le service REFUSE toute tentative de niveau 2+. */
export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  depth: CommentDepth;
  body: string;
  status: CommentStatus;
  /** Dénormalisé — recalculé par le mock depuis `reactions`. */
  reactionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Table `reactions` — une seule réaction par (user, cible) : changer d'emoji
 * est un UPDATE. `targetId` est polymorphe (pas de FK, intégrité service). */
export interface Reaction {
  id: string;
  userId: string;
  targetType: ReactionTargetType;
  targetId: string;
  emoji: string;
  createdAt: Date;
}

/** Table `saved_collections` — une seule collection par défaut (« Général »)
 * par utilisateur, créée à l'inscription par le service. */
export interface SavedCollection {
  id: string;
  ownerId: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
}

/** Table `saved_posts` — PK composite (collectionId, postId). */
export interface SavedPost {
  collectionId: string;
  postId: string;
  createdAt: Date;
}

/** Table `cameras` — `cameraNumber` est auto-attribué (IDENTITY côté SQL,
 * séquence en mémoire côté mock) et affiché « #23 » dans l'app. */
export interface Camera {
  id: string;
  cameraNumber: number;
  name: string;
  streamType: CameraStreamType;
  url: string;
  category: CameraCategory;
  description: string;
  /** NOT NULL côté SQL : une caméra est toujours géolocalisée. */
  location: GeoPoint;
  /** Déduite via géocodage (mock au Lot 1) — ajustable manuellement. */
  cityName: string;
  districtName: string | null;
  status: CameraStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Table `reports` — l'état de signalement vit ICI, pas dans le statut des
 * posts/commentaires (un contenu signalé peut rester actif). */
export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  /** Polymorphe : pas de FK, intégrité vérifiée au niveau service. */
  targetId: string;
  reasonCode: ReportReasonCode;
  message: string;
  status: ReportStatus;
  handledBy: string | null;
  handledAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
}

/** Table `notifications`. */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

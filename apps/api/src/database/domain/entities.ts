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

/** Cible d'un signalement (association polymorphe, intégrité au niveau
 * service). 'listing' (annonce Dealplace) ajouté au CP2.5 — D65. */
export type ReportTargetType = 'post' | 'comment' | 'user' | 'listing';

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

/** Types de notification documentés (TEXT côté SQL, codes pilotés côté app).
 * 'deal' (CP2.4) : jalons d'un deal (proposition reçue, acceptation, refus,
 * annulation, litige, conclusion, avis reçu) — payload { dealId, event,
 * title, message }. */
export type NotificationType =
  | 'comment'
  | 'reply'
  | 'reaction'
  | 'report_handled'
  | 'system'
  | 'deal';

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

// ────────────────────────────────────────────────────────────────────────────
// Conversations 1-to-1 (Lot 2 — CP2.3)
// ────────────────────────────────────────────────────────────────────────────

/** Table `conversations` — messagerie privée 1-to-1 LIÉE À UNE ANNONCE
 * (CP2.3, décision D63) : une conversation par (listing, initiateur).
 * `ownerId` = propriétaire de l'annonce (dénormalisé à la création).
 * Lecture par participant : un message est « non lu » s'il vient de l'AUTRE
 * participant et est postérieur à MON `*LastReadAt` (null = jamais lu). */
export interface Conversation {
  id: string;
  listingId: string;
  initiatorId: string;
  ownerId: string;
  initiatorLastReadAt: Date | null;
  ownerLastReadAt: Date | null;
  /** Posé à CHAQUE message (même transaction) — tri des listes. */
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Statut d'un message (CP2.5 — D67) : 'hidden' = masqué par la modération
 * backoffice. Pas de 'deleted' (D63 : les messages ne sont ni éditables ni
 * supprimables). Un message masqué RESTE dans le fil (pagination et non-lus
 * inchangés) ; seul son corps est remplacé pour les participants. */
export type MessageStatus = 'active' | 'hidden';

/** Table `messages` — messages TEXTE (1-2000 caractères) d'une conversation.
 * Pas de pièces jointes au CP2.3. */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  /** Modération backoffice (CP2.5 — D67). */
  status: MessageStatus;
  createdAt: Date;
}

// ────────────────────────────────────────────────────────────────────────────
// Deals contractuels + avis (Lot 2 — CP2.4, décision D64)
// ────────────────────────────────────────────────────────────────────────────

/** Statut d'un deal — machine à états D64 :
 * proposed → active (accepté) | declined | cancelled (retiré avant accord) ;
 * active → completed (AUTOMATIQUE : tout validé) | cancelled (annulation
 * amiable en deux temps) | disputed (unilatéral). Depuis le CP2.5 (D66),
 * 'disputed' n'est plus terminal : l'arbitrage backoffice tranche vers
 * cancelled/completed/active (issue tracée par disputeResolution*). */
export type DealStatus =
  | 'proposed'
  | 'active'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'disputed';

/** Issue d'un arbitrage de litige (CP2.5 — D66) : le deal est annulé, conclu
 * (les avis s'ouvrent) ou repris (le litige est jugé non fondé, le deal
 * redevient 'active'). */
export type DealDisputeResolution = 'cancelled' | 'completed' | 'resumed';

/** Nature d'un élément de deal (mockup 07 : Service / Paiement / bien). */
export type DealItemKind = 'service' | 'good' | 'money';

/** Nature d'un ajustement en cours de deal. */
export type DealAdjustmentKind = 'add' | 'modify' | 'remove';

/** Cycle de vie d'un ajustement (décision de la CONTREPARTIE). */
export type DealAdjustmentStatus = 'pending' | 'accepted' | 'rejected';

/** Table `deals` — contrat d'échange lié à une annonce. Le stepper 5 étapes
 * du mockup 07 est DÉRIVÉ (status + état des sous-éléments), jamais stocké. */
export interface Deal {
  id: string;
  /** Numéro lisible « Deal 345 » (séquence). */
  dealNumber: number;
  listingId: string;
  /** Fil de conversation lié (créé avec le deal si absent — D63/D64). */
  conversationId: string | null;
  proposerId: string;
  recipientId: string;
  status: DealStatus;
  /** Échéance indicative (« Non définie » possible). */
  dueDate: Date | null;
  /** Annulation amiable en deux temps : qui l'a demandée (null = personne). */
  cancellationRequestedBy: string | null;
  disputedBy: string | null;
  disputeReason: string | null;
  /** Arbitrage du litige (CP2.5 — D66) : modérateur qui a tranché (null =
   * litige non arbitré). Miroir du pattern reports.handledBy/handledAt. */
  disputeResolvedBy: string | null;
  disputeResolvedAt: Date | null;
  /** Issue de l'arbitrage (null tant que le litige n'est pas tranché). */
  disputeResolution: DealDisputeResolution | null;
  /** Note de décision du modérateur, montrée aux DEUX parties. */
  disputeResolutionNote: string | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
  /** Clôture d'un état terminal non conclu (declined/cancelled/disputed). */
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Table `deal_items` — élément fourni par UNE des deux parties. Son badge
 * (À fournir / Validation partielle / En attente de validation / Honoré) est
 * DÉRIVÉ de ses sous-éléments. */
export interface DealItem {
  id: string;
  dealId: string;
  /** Le FOURNISSEUR (proposerId ou recipientId du deal). */
  providerId: string;
  kind: DealItemKind;
  title: string;
  description: string;
  /** Valeur estimée en euros entiers (≥ 0). */
  value: number;
  position: number;
  createdAt: Date;
}

/** Table `deal_item_steps` — sous-élément validable : le FOURNISSEUR pose
 * honoredAt, la CONTREPARTIE pose validatedAt (jamais sans honoredAt). */
export interface DealItemStep {
  id: string;
  itemId: string;
  label: string;
  position: number;
  honoredAt: Date | null;
  validatedAt: Date | null;
}

/** Payload d'un ajustement 'add' : élément complet à créer. */
export interface DealAdjustmentAddPayload {
  providerId: string;
  kind: DealItemKind;
  title: string;
  description?: string;
  value: number;
  steps?: string[];
}

/** Payload d'un ajustement 'modify' : champs modifiés de l'élément visé. */
export interface DealAdjustmentModifyPayload {
  kind?: DealItemKind;
  title?: string;
  description?: string;
  value?: number;
}

/** Table `deal_adjustments` — négociation en cours de deal (phase 'active'),
 * appliquée TRANSACTIONNELLEMENT à l'acceptation par la contrepartie. */
export interface DealAdjustment {
  id: string;
  dealId: string;
  proposedBy: string;
  kind: DealAdjustmentKind;
  /** Élément visé (modify/remove) — null pour add ou élément disparu. */
  itemId: string | null;
  payload: Record<string, unknown>;
  description: string;
  status: DealAdjustmentStatus;
  decidedAt: Date | null;
  createdAt: Date;
}

/** Table `deal_notes` — timeline « Suivi du deal » (notes utilisateur). */
export interface DealNote {
  id: string;
  dealId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}

/** Table `deal_reviews` — avis détaillé (D59/D64) sur un deal CONCLU :
 * 3 critères 1-5 (mockup 05), note globale = moyenne à la lecture. */
export interface DealReview {
  id: string;
  dealId: string;
  reviewerId: string;
  revieweeId: string;
  ratingHonesty: number;
  ratingConformity: number;
  ratingKindness: number;
  comment: string | null;
  createdAt: Date;
}

import {
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
} from '../../database/domain/entities';
import { PostAuthor } from './post.mapper';

/**
 * Projections « annonce » du contrat d'API Dealplace (CP2.1) — source UNIQUE
 * des formes LISTING (détail) et LISTING_CARD (listes) : aucun module ne
 * reconstruit ces objets à la main.
 *
 * La forme AUTEUR est mutualisée avec le module posts (PostAuthor / toPostAuthor
 * de post.mapper.ts) : un utilisateur a la même projection publique partout.
 *
 * L'assemblage PAR LOT (auteurs, médias, tags d'une page complète) est fait par
 * ListingAssembler (modules/dealplace/listing.assembler.ts) au-dessus de ces
 * projections pures.
 */

/** Forme CATEGORY imbriquée dans une annonce (détail LISTING). */
export interface ListingCategoryView {
  slug: string;
  labelFr: string;
  family: ListingFamily;
  moderationLevel: ModerationLevel;
}

/** Forme CATEGORY allégée des cartes (LISTING_CARD) — sans moderationLevel. */
export interface ListingCardCategoryView {
  slug: string;
  labelFr: string;
  family: ListingFamily;
}

/** Forme SUBCATEGORY imbriquée dans une annonce. */
export interface ListingSubcategoryView {
  slug: string;
  labelFr: string;
}

/** Forme TAG imbriquée dans une annonce ({ slug, labelFr }). */
export interface ListingTagView {
  slug: string;
  labelFr: string;
}

/** Forme MEDIA d'une annonce (miroir de la forme MEDIA des posts + position). */
export interface ListingMediaView {
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  mediaType: ListingMediaType;
  position: number;
}

/** Forme LISTING du contrat — projection UNIQUE d'une annonce en détail. */
export interface ListingView {
  id: string;
  ownerId: string;
  owner: PostAuthor;
  listingType: ListingFamily;
  title: string;
  description: string;
  category: ListingCategoryView;
  subcategory: ListingSubcategoryView;
  valueKind: ListingValueKind;
  valueMin: number;
  valueMax: number | null;
  currency: string;
  city: string;
  location: GeoPoint | null;
  exchangePrefs: ExchangePref[];
  externalLinks: ListingExternalLink[];
  media: ListingMediaView[];
  tags: ListingTagView[];
  urlSlug: string;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Forme LISTING_CARD du contrat — sous-ensemble servi dans les listes. */
export interface ListingCardView {
  id: string;
  ownerId: string;
  owner: PostAuthor;
  listingType: ListingFamily;
  title: string;
  category: ListingCardCategoryView;
  subcategory: ListingSubcategoryView;
  valueKind: ListingValueKind;
  valueMin: number;
  valueMax: number | null;
  currency: string;
  city: string;
  /** Premier média (position la plus basse) ou null. */
  coverMedia: ListingMediaView | null;
  tags: ListingTagView[];
  urlSlug: string;
  createdAt: Date;
}

/** Projette une entité ListingCategory vers la forme CATEGORY du détail. */
export function toListingCategoryView(
  category: ListingCategory,
): ListingCategoryView {
  return {
    slug: category.slug,
    labelFr: category.labelFr,
    family: category.family,
    moderationLevel: category.moderationLevel,
  };
}

/** Projette une entité ListingCategory vers la forme CATEGORY allégée (carte). */
export function toListingCardCategoryView(
  category: ListingCategory,
): ListingCardCategoryView {
  return {
    slug: category.slug,
    labelFr: category.labelFr,
    family: category.family,
  };
}

/** Projette une entité ListingSubcategory vers la forme SUBCATEGORY. */
export function toListingSubcategoryView(
  subcategory: ListingSubcategory,
): ListingSubcategoryView {
  return { slug: subcategory.slug, labelFr: subcategory.labelFr };
}

/** Projette une entité ListingTag vers la forme TAG. */
export function toListingTagView(tag: ListingTag): ListingTagView {
  return { slug: tag.slug, labelFr: tag.labelFr };
}

/** Projette une entité ListingMedia vers la forme MEDIA du contrat. */
export function toListingMediaView(media: ListingMedia): ListingMediaView {
  return {
    url: media.url,
    thumbnailUrl: media.thumbnailUrl,
    width: media.width,
    height: media.height,
    mediaType: media.mediaType,
    position: media.position,
  };
}

/** Données contextuelles d'un LISTING (calculées PAR LOT par l'assembler). */
export interface ListingViewContext {
  owner: PostAuthor;
  category: ListingCategory;
  subcategory: ListingSubcategory;
  media: ListingMediaView[];
  tags: ListingTagView[];
}

/** Données contextuelles d'un LISTING_CARD (sous-ensemble du détail). */
export interface ListingCardContext {
  owner: PostAuthor;
  category: ListingCategory;
  subcategory: ListingSubcategory;
  coverMedia: ListingMediaView | null;
  tags: ListingTagView[];
}

/** Projette une entité Listing + son contexte vers la forme LISTING. */
export function toListingView(
  listing: Listing,
  context: ListingViewContext,
): ListingView {
  return {
    id: listing.id,
    ownerId: listing.ownerId,
    owner: context.owner,
    listingType: listing.listingType,
    title: listing.title,
    description: listing.description,
    category: toListingCategoryView(context.category),
    subcategory: toListingSubcategoryView(context.subcategory),
    valueKind: listing.valueKind,
    valueMin: listing.valueMin,
    valueMax: listing.valueMax,
    currency: listing.currency,
    city: listing.city,
    location: listing.location,
    exchangePrefs: listing.exchangePrefs,
    externalLinks: listing.externalLinks,
    media: context.media,
    tags: context.tags,
    urlSlug: listing.urlSlug,
    status: listing.status,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}

/** Projette une entité Listing + son contexte vers la forme LISTING_CARD. */
export function toListingCardView(
  listing: Listing,
  context: ListingCardContext,
): ListingCardView {
  return {
    id: listing.id,
    ownerId: listing.ownerId,
    owner: context.owner,
    listingType: listing.listingType,
    title: listing.title,
    category: toListingCardCategoryView(context.category),
    subcategory: toListingSubcategoryView(context.subcategory),
    valueKind: listing.valueKind,
    valueMin: listing.valueMin,
    valueMax: listing.valueMax,
    currency: listing.currency,
    city: listing.city,
    coverMedia: context.coverMedia,
    tags: context.tags,
    urlSlug: listing.urlSlug,
    createdAt: listing.createdAt,
  };
}

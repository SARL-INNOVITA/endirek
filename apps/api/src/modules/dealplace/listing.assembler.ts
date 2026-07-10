import { Inject, Injectable } from '@nestjs/common';
import { PostAuthor, toPostAuthor } from '../../common/mappers/post.mapper';
import {
  ListingCardView,
  ListingMediaView,
  ListingTagView,
  ListingView,
  toListingCardView,
  toListingMediaView,
  toListingTagView,
  toListingView,
} from '../../common/mappers/listing.mapper';
import {
  LISTING_TAXONOMY_REPOSITORY,
  LISTINGS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import {
  Listing,
  ListingCategory,
  ListingSubcategory,
} from '../../database/domain/entities';
import {
  ListingsRepository,
  ListingTaxonomyRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';

/**
 * Assembleur UNIQUE des formes LISTING (détail) et LISTING_CARD (listes) du
 * contrat Dealplace — mutualisé entre l'annuaire public, le détail, les listes
 * de profil et le backoffice : les modules l'importent au lieu de réassembler
 * la forme à la main.
 *
 * Toutes les données contextuelles d'une PAGE sont chargées PAR LOT (un appel
 * repository par famille : propriétaires, médias, tags ; catégories et
 * sous-catégories résolues depuis la taxonomie complète, petite et mise en
 * cache par appel) — jamais de N+1 par annonce.
 */
@Injectable()
export class ListingAssembler {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    @Inject(LISTINGS_REPOSITORY)
    private readonly listingsRepository: ListingsRepository,
    @Inject(LISTING_TAXONOMY_REPOSITORY)
    private readonly taxonomyRepository: ListingTaxonomyRepository,
  ) {}

  /** Assemble une PAGE d'annonces vers la forme LISTING (ordre préservé). */
  async assemble(listings: Listing[]): Promise<ListingView[]> {
    if (listings.length === 0) {
      return [];
    }
    const ctx = await this.loadContext(listings);
    return listings.map((listing) =>
      toListingView(listing, {
        owner:
          ctx.owners.get(listing.ownerId) ??
          toPostAuthor(listing.ownerId, null),
        category: ctx.categories.get(listing.categorySlug)!,
        subcategory: ctx.subcategories.get(listing.subcategorySlug)!,
        media: ctx.mediaByListing.get(listing.id) ?? [],
        tags: this.resolveTags(ctx.tagSlugsByListing[listing.id], ctx.tags),
      }),
    );
  }

  /** Assemble UNE annonce (détail, retour de création/modification). */
  async assembleOne(listing: Listing): Promise<ListingView> {
    const [assembled] = await this.assemble([listing]);
    return assembled;
  }

  /** Assemble une PAGE d'annonces vers la forme LISTING_CARD (listes). */
  async assembleCards(listings: Listing[]): Promise<ListingCardView[]> {
    if (listings.length === 0) {
      return [];
    }
    const ctx = await this.loadContext(listings);
    return listings.map((listing) => {
      const media = ctx.mediaByListing.get(listing.id) ?? [];
      return toListingCardView(listing, {
        owner:
          ctx.owners.get(listing.ownerId) ??
          toPostAuthor(listing.ownerId, null),
        category: ctx.categories.get(listing.categorySlug)!,
        subcategory: ctx.subcategories.get(listing.subcategorySlug)!,
        // coverMedia = premier média (les médias arrivent déjà triés par
        // position croissante depuis le repository).
        coverMedia: media.length > 0 ? media[0] : null,
        tags: this.resolveTags(ctx.tagSlugsByListing[listing.id], ctx.tags),
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Chargement PAR LOT du contexte d'une page
  // ──────────────────────────────────────────────────────────────────────────

  private async loadContext(listings: Listing[]): Promise<{
    owners: Map<string, PostAuthor>;
    categories: Map<string, ListingCategory>;
    subcategories: Map<string, ListingSubcategory>;
    mediaByListing: Map<string, ListingMediaView[]>;
    tagSlugsByListing: Record<string, string[]>;
    tags: Map<string, ListingTagView>;
  }> {
    const listingIds = listings.map((l) => l.id);
    const ownerIds = [...new Set(listings.map((l) => l.ownerId))];

    const [owners, mediaRows, tagSlugsByListing, categoryList, tagList] =
      await Promise.all([
        this.loadOwners(ownerIds),
        this.listingsRepository.listMediaByListingIds(listingIds),
        this.listingsRepository.listTagsByListingIds(listingIds),
        // Taxonomie complète (catégories + tags, actifs OU non) : petite et
        // pilotée par le backoffice — la résoudre en un appel évite un N+1 et
        // couvre les annonces d'une catégorie devenue inactive (elles restent
        // affichées avec leur libellé).
        this.taxonomyRepository.listCategories(false),
        this.taxonomyRepository.listTags(false),
      ]);

    const categories = new Map(categoryList.map((c) => [c.slug, c]));
    const tags = new Map(
      tagList.map((t) => [t.slug, toListingTagView(t)] as const),
    );

    // Sous-catégories nécessaires : uniquement celles référencées par la page
    // (résolues par lot en parcourant les catégories présentes).
    const subcategories = await this.loadSubcategories(
      new Set(listings.map((l) => l.subcategorySlug)),
      new Set(listings.map((l) => l.categorySlug)),
    );

    const mediaByListing = new Map<string, ListingMediaView[]>();
    for (const media of mediaRows) {
      const list = mediaByListing.get(media.listingId) ?? [];
      list.push(toListingMediaView(media));
      mediaByListing.set(media.listingId, list);
    }

    return {
      owners,
      categories,
      subcategories,
      mediaByListing,
      tagSlugsByListing,
      tags,
    };
  }

  /** Propriétaires par lot vers la forme AUTEUR (source unique post.mapper). */
  private async loadOwners(ownerIds: string[]): Promise<Map<string, PostAuthor>> {
    const users = await this.usersRepository.findByIds(ownerIds);
    return new Map(users.map((user) => [user.id, toPostAuthor(user.id, user)]));
  }

  /**
   * Résout les sous-catégories d'une page en parcourant les catégories
   * présentes (listSubcategories par catégorie, actives ET inactives) — au
   * plus une requête par catégorie distincte de la page (typiquement 1-3).
   */
  private async loadSubcategories(
    _wantedSubSlugs: Set<string>,
    categorySlugs: Set<string>,
  ): Promise<Map<string, ListingSubcategory>> {
    const result = new Map<string, ListingSubcategory>();
    const lists = await Promise.all(
      [...categorySlugs].map((slug) =>
        this.taxonomyRepository.listSubcategories(slug, false),
      ),
    );
    for (const list of lists) {
      for (const sub of list) {
        result.set(sub.slug, sub);
      }
    }
    return result;
  }

  /** Slugs de tags d'une annonce → formes TAG (ignore les slugs inconnus). */
  private resolveTags(
    slugs: string[] | undefined,
    tags: Map<string, ListingTagView>,
  ): ListingTagView[] {
    if (!slugs || slugs.length === 0) {
      return [];
    }
    const views: ListingTagView[] = [];
    for (const slug of slugs) {
      const view = tags.get(slug);
      if (view) {
        views.push(view);
      }
    }
    return views;
  }
}

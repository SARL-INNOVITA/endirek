import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  ListingCardView,
  ListingView,
} from '../../common/mappers/listing.mapper';
import { AppConfig } from '../../config/configuration';
import {
  LISTING_TAXONOMY_REPOSITORY,
  LISTINGS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import {
  Listing,
  ListingCategory,
  ListingFamily,
  ListingStatus,
  ListingSubcategory,
} from '../../database/domain/entities';
import {
  CreateListingMediaSpec,
  ListingsRepository,
  ListingTaxonomyRepository,
  UpdateListingPatch,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { findCommuneByName } from '../../database/seed/communes';
import { randomSlugSuffix, slugify } from '../posts/slug.util';
import { CreateListingDto, ListingMediaInputDto } from './dto/create-listing.dto';
import { ListListingsQueryDto } from './dto/list-listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingAssembler } from './listing.assembler';

/** Nombre de tentatives de génération d'un urlSlug unique (cf. posts). */
const SLUG_MAX_ATTEMPTS = 5;

/** Élément de taxonomie du contrat : catégorie active avec ses sous-catégories
 * actives et sa famille/niveau de modération. */
export interface TaxonomyCategoryView {
  slug: string;
  family: 'good' | 'service';
  labelFr: string;
  moderationLevel: 'standard' | 'sensitive' | 'forbidden';
  subcategories: { slug: string; labelFr: string }[];
}

/** Réponse de GET /dealplace/taxonomy. */
export interface TaxonomyView {
  categories: TaxonomyCategoryView[];
  tags: { slug: string; labelFr: string }[];
}

/** Liste paginée de LISTING_CARD. */
export interface PagedListingCards {
  items: ListingCardView[];
  total: number;
}

/** LISTING_CARD enrichi du statut — servi UNIQUEMENT au propriétaire
 * (GET /users/me/listings) pour distinguer ses annonces masquées par la
 * modération (même enrichissement que la liste backoffice). */
export interface OwnerListingCard extends ListingCardView {
  status: ListingStatus;
}

/** Liste paginée de cartes du propriétaire (LISTING_CARD + status). */
export interface PagedOwnerListingCards {
  items: OwnerListingCard[];
  total: number;
}

/**
 * Service Dealplace (CP2.1) — taxonomie + annonces (listings).
 *
 * Règles métier appliquées ICI (le repository ne garantit que les contraintes
 * structurelles) :
 * - valeur cohérente : fixed → valueMin ; range → valueMin ≤ valueMax ;
 * - PHOTO obligatoire pour un bien (listingType='good', ≥ 1 média), facultative
 *   pour un service ;
 * - commune obligatoire et présente dans le référentiel des communes (l'adresse
 *   exacte n'est jamais stockée ; location = centre de la commune) ;
 * - catégorie + sous-catégorie obligatoires et cohérentes (la sous-catégorie
 *   appartient à la catégorie, la catégorie est de la bonne famille) — repli
 *   « autres-<cat> » autorisé ;
 * - catégorie 'forbidden' → création REFUSÉE (400) ; 'sensitive' → autorisée ;
 * - exchangePrefs non vide ;
 * - urlSlug généré (slug du titre + suffixe), unicité garantie par retry ;
 * - médias : URLs issues de l'upload Endirek uniquement (400 sinon).
 *
 * Visibilité d'une annonce (miroir des posts) :
 * - 'active'  : visible de tous ;
 * - 'hidden'  : 404 pour tous SAUF le propriétaire et moderator/super_admin ;
 * - 'deleted' : 404 pour tout le monde (soft-delete).
 */
@Injectable()
export class DealplaceService {
  constructor(
    @Inject(LISTINGS_REPOSITORY)
    private readonly listingsRepository: ListingsRepository,
    @Inject(LISTING_TAXONOMY_REPOSITORY)
    private readonly taxonomyRepository: ListingTaxonomyRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    private readonly assembler: ListingAssembler,
    private readonly configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Taxonomie
  // ──────────────────────────────────────────────────────────────────────────

  /** Taxonomie ACTIVE (GET /dealplace/taxonomy) : catégories actives triées par
   * position, chacune avec ses sous-catégories actives, + tags actifs. */
  async getTaxonomy(): Promise<TaxonomyView> {
    const categories = await this.taxonomyRepository.listCategories(true);
    const [subLists, tags] = await Promise.all([
      Promise.all(
        categories.map((c) =>
          this.taxonomyRepository.listSubcategories(c.slug, true),
        ),
      ),
      this.taxonomyRepository.listTags(true),
    ]);
    return {
      categories: categories.map((category, index) => ({
        slug: category.slug,
        family: category.family,
        labelFr: category.labelFr,
        moderationLevel: category.moderationLevel,
        subcategories: subLists[index].map((s) => ({
          slug: s.slug,
          labelFr: s.labelFr,
        })),
      })),
      tags: tags.map((t) => ({ slug: t.slug, labelFr: t.labelFr })),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Création
  // ──────────────────────────────────────────────────────────────────────────

  /** Crée une annonce (POST /dealplace/listings) — toutes les règles métier. */
  async create(userId: string, dto: CreateListingDto): Promise<ListingView> {
    // Valeur cohérente (fixed/range) — 400 métier avant toute écriture.
    this.assertValueConsistent(dto.valueKind, dto.valueMin, dto.valueMax);

    // Catégorie + sous-catégorie cohérentes, famille correcte, non 'forbidden'.
    const { category, subcategory } = await this.resolveTaxonomy(
      dto.categorySlug,
      dto.subcategorySlug,
      dto.listingType,
    );
    if (category.moderationLevel === 'forbidden') {
      throw new BadRequestException(
        `La catégorie « ${category.labelFr} » n'autorise pas la publication d'annonces`,
      );
    }

    // Photo obligatoire pour un bien, facultative pour un service.
    const mediaInput = dto.media ?? [];
    if (dto.listingType === 'good' && mediaInput.length === 0) {
      throw new BadRequestException(
        'Au moins une photo est obligatoire pour une annonce de bien',
      );
    }
    this.assertUploadedMediaUrls(mediaInput);

    // Commune du référentiel — l'adresse exacte n'est jamais stockée ;
    // location = centre de la commune.
    const commune = findCommuneByName(dto.city);
    if (!commune) {
      throw new BadRequestException(
        `Commune inconnue : « ${dto.city} » — choisissez une commune de La Réunion`,
      );
    }

    // Tags : chaque slug doit exister et être actif (400 sinon). Dédoublonnés.
    const tagSlugs = await this.resolveTagSlugs(dto.tags ?? []);

    const media = this.toMediaSpecs(mediaInput);
    const urlSlug = await this.generateUniqueSlug(dto.title);

    const listing = await this.listingsRepository.create({
      ownerId: userId,
      listingType: dto.listingType,
      title: dto.title,
      description: dto.description,
      categorySlug: category.slug,
      subcategorySlug: subcategory.slug,
      valueKind: dto.valueKind,
      valueMin: dto.valueMin,
      valueMax: dto.valueKind === 'range' ? (dto.valueMax as number) : null,
      currency: dto.currency?.toUpperCase() ?? 'EUR',
      city: commune.name,
      location: { lat: commune.lat, lng: commune.lng },
      exchangePrefs: dto.exchangePrefs,
      externalLinks: dto.externalLinks ?? [],
      urlSlug,
      media,
      tagSlugs,
    });
    return this.assembler.assembleOne(listing);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lecture
  // ──────────────────────────────────────────────────────────────────────────

  /** Annuaire public paginé (GET /dealplace/listings) — annonces 'active'. */
  async listPublic(query: ListListingsQueryDto): Promise<PagedListingCards> {
    if (
      query.valueMin !== undefined &&
      query.valueMax !== undefined &&
      query.valueMin > query.valueMax
    ) {
      throw new BadRequestException(
        'valueMin ne peut pas être supérieur à valueMax',
      );
    }
    const page = await this.listingsRepository.listPublic({
      family: query.family,
      categorySlug: query.category,
      subcategorySlug: query.subcategory,
      city: query.city,
      valueMin: query.valueMin,
      valueMax: query.valueMax,
      tagSlugs: query.tags,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
    return {
      items: await this.assembler.assembleCards(page.items),
      total: page.total,
    };
  }

  /** Détail d'une annonce par id (GET /dealplace/listings/:id). */
  async getById(viewer: AuthenticatedUser, id: string): Promise<ListingView> {
    const listing = await this.listingsRepository.findById(id);
    return this.assembler.assembleOne(this.assertVisible(listing, viewer));
  }

  /** Détail par urlSlug (GET /dealplace/listings/slug/:slug). */
  async getBySlug(
    viewer: AuthenticatedUser,
    slug: string,
  ): Promise<ListingView> {
    const listing = await this.listingsRepository.findByUrlSlug(slug);
    return this.assembler.assembleOne(this.assertVisible(listing, viewer));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Modification / suppression (propriétaire uniquement)
  // ──────────────────────────────────────────────────────────────────────────

  /** Modifie une annonce (PATCH /dealplace/listings/:id) — PROPRIÉTAIRE. */
  async update(
    viewer: AuthenticatedUser,
    id: string,
    dto: UpdateListingDto,
  ): Promise<ListingView> {
    const listing = await this.loadOwnListing(viewer, id);

    // Valeur résultante (après patch) cohérente.
    const nextValueKind = dto.valueKind ?? listing.valueKind;
    const nextValueMin = dto.valueMin ?? listing.valueMin;
    const nextValueMax =
      dto.valueMax !== undefined ? dto.valueMax : listing.valueMax;
    this.assertValueConsistent(
      nextValueKind,
      nextValueMin,
      nextValueKind === 'range' ? nextValueMax ?? undefined : undefined,
    );

    // Catégorie / sous-catégorie résultantes cohérentes (famille figée = le
    // type d'annonce, non modifiable au CP2.1).
    const patch: UpdateListingPatch = {};
    if (dto.categorySlug !== undefined || dto.subcategorySlug !== undefined) {
      const nextCategorySlug = dto.categorySlug ?? listing.categorySlug;
      const nextSubcategorySlug =
        dto.subcategorySlug ?? listing.subcategorySlug;
      const { category, subcategory } = await this.resolveTaxonomy(
        nextCategorySlug,
        nextSubcategorySlug,
        listing.listingType,
      );
      if (category.moderationLevel === 'forbidden') {
        throw new BadRequestException(
          `La catégorie « ${category.labelFr} » n'autorise pas la publication d'annonces`,
        );
      }
      patch.categorySlug = category.slug;
      patch.subcategorySlug = subcategory.slug;
    }

    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.valueKind !== undefined) patch.valueKind = dto.valueKind;
    if (dto.valueMin !== undefined) patch.valueMin = dto.valueMin;
    if (dto.valueMax !== undefined) patch.valueMax = dto.valueMax;
    if (dto.valueKind === 'fixed') patch.valueMax = null;
    if (dto.exchangePrefs !== undefined) patch.exchangePrefs = dto.exchangePrefs;
    if (dto.externalLinks !== undefined) patch.externalLinks = dto.externalLinks;

    // Tags : si fournis, remplacent intégralement l'ensemble (chaque slug
    // validé actif). On applique via replaceTags puis on met à jour le reste.
    if (dto.tags !== undefined) {
      const tagSlugs = await this.resolveTagSlugs(dto.tags);
      await this.listingsRepository.setTags(id, tagSlugs);
    }

    const updated = await this.listingsRepository.update(id, patch);
    return this.assembler.assembleOne(updated);
  }

  /** Supprime une annonce (DELETE /dealplace/listings/:id) — PROPRIÉTAIRE,
   * soft-delete (status='deleted' + deletedAt). */
  async remove(viewer: AuthenticatedUser, id: string): Promise<void> {
    await this.loadOwnListing(viewer, id);
    await this.listingsRepository.setStatus(id, 'deleted');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Listes de profil
  // ──────────────────────────────────────────────────────────────────────────

  /** Annonces 'active' d'un profil visible (GET /users/:id/listings) —
   * 404 si le compte n'existe pas, est supprimé ou suspendu. `family`
   * facultatif : sections Services / Biens du profil Dealplace (CP2.2). */
  async listOwnerActive(
    ownerId: string,
    limit: number,
    offset: number,
    family?: ListingFamily,
  ): Promise<PagedListingCards> {
    const user = await this.usersRepository.findById(ownerId);
    if (!user || user.status !== 'active') {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return this.pageOwnerListings(ownerId, ['active'], limit, offset, family);
  }

  /** Mes annonces 'active' + 'hidden' (GET /users/me/listings) — cartes
   * enrichies du STATUT : le propriétaire distingue ses annonces masquées
   * (le repository préserve l'ordre : statut ré-associé par index, comme au
   * backoffice). `family` facultatif (sections du profil — CP2.2). */
  async listMine(
    viewer: AuthenticatedUser,
    limit: number,
    offset: number,
    family?: ListingFamily,
  ): Promise<PagedOwnerListingCards> {
    const page = await this.listingsRepository.listByOwner(viewer.userId, {
      statuses: ['active', 'hidden'],
      family,
      limit,
      offset,
    });
    const cards = await this.assembler.assembleCards(page.items);
    const items: OwnerListingCard[] = cards.map((card, index) => ({
      ...card,
      status: page.items[index].status,
    }));
    return { items, total: page.total };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  private async pageOwnerListings(
    ownerId: string,
    statuses: ListingStatus[],
    limit: number,
    offset: number,
    family?: ListingFamily,
  ): Promise<PagedListingCards> {
    const page = await this.listingsRepository.listByOwner(ownerId, {
      statuses,
      family,
      limit,
      offset,
    });
    return {
      items: await this.assembler.assembleCards(page.items),
      total: page.total,
    };
  }

  /** Valeur cohérente : fixed → pas de max ; range → max ≥ min. */
  private assertValueConsistent(
    valueKind: 'fixed' | 'range',
    valueMin: number,
    valueMax: number | undefined,
  ): void {
    if (valueKind === 'fixed') {
      if (valueMax !== undefined && valueMax !== null) {
        throw new BadRequestException(
          "Une valeur « fixed » ne peut pas définir de borne haute (valueMax)",
        );
      }
      return;
    }
    // range
    if (valueMax === undefined || valueMax === null) {
      throw new BadRequestException(
        'Une valeur « range » exige une borne haute (valueMax)',
      );
    }
    if (valueMax < valueMin) {
      throw new BadRequestException(
        'valueMax doit être supérieur ou égal à valueMin (fourchette)',
      );
    }
  }

  /**
   * Résout et vérifie la cohérence catégorie ↔ sous-catégorie ↔ famille :
   * - la catégorie existe ET est active (400 sinon — comme les types de posts
   *   du Lot 1 et les tags : une entrée désactivée au backoffice n'accepte
   *   plus de NOUVELLE annonce ; les annonces existantes restent affichées) ;
   * - sa famille correspond au type d'annonce attendu (400 sinon) ;
   * - la sous-catégorie existe, est active ET appartient à cette catégorie
   *   (400 sinon).
   */
  private async resolveTaxonomy(
    categorySlug: string,
    subcategorySlug: string,
    listingType: 'good' | 'service',
  ): Promise<{ category: ListingCategory; subcategory: ListingSubcategory }> {
    const category = await this.taxonomyRepository.findCategory(categorySlug);
    if (!category || !category.isActive) {
      throw new BadRequestException(
        `Catégorie inconnue ou inactive : « ${categorySlug} »`,
      );
    }
    if (category.family !== listingType) {
      throw new BadRequestException(
        `La catégorie « ${category.labelFr} » n'appartient pas à la famille « ${listingType} »`,
      );
    }
    const subcategory =
      await this.taxonomyRepository.findSubcategory(subcategorySlug);
    if (!subcategory || !subcategory.isActive) {
      throw new BadRequestException(
        `Sous-catégorie inconnue ou inactive : « ${subcategorySlug} »`,
      );
    }
    if (subcategory.categorySlug !== category.slug) {
      throw new BadRequestException(
        `La sous-catégorie « ${subcategory.labelFr} » n'appartient pas à la catégorie « ${category.labelFr} »`,
      );
    }
    return { category, subcategory };
  }

  /** Dédoublonne et vérifie que chaque tag existe ET est actif (400 sinon). */
  private async resolveTagSlugs(tags: string[]): Promise<string[]> {
    const unique = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    for (const slug of unique) {
      const tag = await this.taxonomyRepository.findTag(slug);
      if (!tag || !tag.isActive) {
        throw new BadRequestException(`Tag inconnu ou inactif : « ${slug} »`);
      }
    }
    return unique;
  }

  private toMediaSpecs(
    media: ListingMediaInputDto[],
  ): CreateListingMediaSpec[] {
    return media.map((item, index) => ({
      mediaType: item.mediaType ?? 'image',
      url: item.url,
      thumbnailUrl: item.thumbnailUrl ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      position: item.position ?? index,
    }));
  }

  /**
   * Refuse (400) tout média dont l'url ou la thumbnailUrl ne provient pas de
   * l'upload Endirek (base `${app.publicUrl}/uploads/`) — miroir strict de la
   * garde des posts (PostsService.assertUploadedMediaUrls).
   */
  private assertUploadedMediaUrls(media: ListingMediaInputDto[]): void {
    if (media.length === 0) {
      return;
    }
    const { publicUrl } = this.configService.getOrThrow<AppConfig>('app');
    const allowedBase = `${publicUrl.replace(/\/+$/, '')}/uploads/`;
    for (const item of media) {
      const urls = [item.url, item.thumbnailUrl].filter(
        (value): value is string => value !== undefined,
      );
      if (urls.some((value) => !value.startsWith(allowedBase))) {
        throw new BadRequestException(
          "Les médias doivent provenir de l'upload Endirek (/media/upload)",
        );
      }
    }
  }

  /** Génère un urlSlug unique : base lisible + suffixe aléatoire, retry sur
   * collision (contrainte UNIQUE). Miroir de PostsService.generateUniqueSlug. */
  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    for (let attempt = 0; attempt < SLUG_MAX_ATTEMPTS; attempt++) {
      const candidate = `${base}-${randomSlugSuffix()}`;
      if (!(await this.listingsRepository.findByUrlSlug(candidate))) {
        return candidate;
      }
    }
    return `${base}-${randomSlugSuffix()}${randomSlugSuffix()}`;
  }

  /**
   * Règles de visibilité (miroir des posts) : null ou 'deleted' → 404 ;
   * 'hidden' → 404 sauf propriétaire et rôles moderator/super_admin.
   */
  private assertVisible(
    listing: Listing | null,
    viewer: AuthenticatedUser,
  ): Listing {
    if (!listing || listing.status === 'deleted') {
      throw new NotFoundException('Annonce introuvable');
    }
    if (
      listing.status === 'hidden' &&
      listing.ownerId !== viewer.userId &&
      viewer.role !== 'moderator' &&
      viewer.role !== 'super_admin'
    ) {
      throw new NotFoundException('Annonce introuvable');
    }
    return listing;
  }

  /**
   * Charge une annonce pour une MUTATION par son propriétaire : 404 si absente,
   * supprimée ou masquée-et-viewer-tiers ; 403 si le viewer n'en est pas le
   * propriétaire (miroir de PostsService.loadOwnPost).
   */
  private async loadOwnListing(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<Listing> {
    const listing = await this.listingsRepository.findById(id);
    if (!listing || listing.status === 'deleted') {
      throw new NotFoundException('Annonce introuvable');
    }
    if (listing.status === 'hidden' && listing.ownerId !== viewer.userId) {
      throw new NotFoundException('Annonce introuvable');
    }
    if (listing.ownerId !== viewer.userId) {
      throw new ForbiddenException(
        "Seul le propriétaire peut modifier ou supprimer cette annonce",
      );
    }
    return listing;
  }
}

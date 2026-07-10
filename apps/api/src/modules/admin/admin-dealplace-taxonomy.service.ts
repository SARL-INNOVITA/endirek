import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LISTING_TAXONOMY_REPOSITORY } from '../../database/database.tokens';
import {
  ListingCategory,
  ListingSubcategory,
  ListingTag,
} from '../../database/domain/entities';
import { ListingTaxonomyRepository } from '../../database/repositories/interfaces';
import {
  CreateListingCategoryDto,
  CreateListingSubcategoryDto,
  CreateListingTagDto,
  UpdateListingCategoryDto,
  UpdateListingSubcategoryDto,
  UpdateListingTagDto,
} from './dto/dealplace-taxonomy.dto';

/**
 * Service taxonomie Dealplace du backoffice (CP2.1) — réservé aux rôles
 * moderator et super_admin (RolesGuard sur le contrôleur).
 *
 * Vocabulaire pilotable (comme post_types) : catégories, sous-catégories et
 * tags — création, lecture (actifs ET inactifs) et mise à jour. Le SLUG est la
 * clé métier : immuable après création (aucun endpoint ne le change ; family
 * d'une catégorie et categorySlug d'une sous-catégorie sont figés eux aussi).
 * moderation_level d'une catégorie est éditable. Aucune suppression au CP2.1
 * (désactivation via isActive=false).
 */
@Injectable()
export class AdminDealplaceTaxonomyService {
  constructor(
    @Inject(LISTING_TAXONOMY_REPOSITORY)
    private readonly taxonomyRepository: ListingTaxonomyRepository,
  ) {}

  // ── Catégories ─────────────────────────────────────────────────────────────

  /** Toutes les catégories (actives ET inactives), triées par position. */
  listCategories(): Promise<ListingCategory[]> {
    return this.taxonomyRepository.listCategories(false);
  }

  async createCategory(
    dto: CreateListingCategoryDto,
  ): Promise<ListingCategory> {
    const existing = await this.taxonomyRepository.findCategory(dto.slug);
    if (existing) {
      throw new ConflictException(
        `La catégorie « ${dto.slug} » existe déjà`,
      );
    }
    return this.taxonomyRepository.createCategory({
      slug: dto.slug,
      family: dto.family,
      labelFr: dto.labelFr.trim(),
      position: dto.position,
      moderationLevel: dto.moderationLevel,
      isActive: dto.isActive,
    });
  }

  async updateCategory(
    slug: string,
    dto: UpdateListingCategoryDto,
  ): Promise<ListingCategory> {
    const existing = await this.taxonomyRepository.findCategory(slug);
    if (!existing) {
      throw new NotFoundException('Catégorie introuvable');
    }
    return this.taxonomyRepository.updateCategory(slug, {
      ...(dto.labelFr !== undefined ? { labelFr: dto.labelFr.trim() } : {}),
      ...(dto.position !== undefined ? { position: dto.position } : {}),
      ...(dto.moderationLevel !== undefined
        ? { moderationLevel: dto.moderationLevel }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  // ── Sous-catégories ─────────────────────────────────────────────────────────

  /** Toutes les sous-catégories d'une catégorie (actives ET inactives) —
   * la catégorie doit exister (404 sinon). */
  async listSubcategories(
    categorySlug: string,
  ): Promise<ListingSubcategory[]> {
    const category = await this.taxonomyRepository.findCategory(categorySlug);
    if (!category) {
      throw new NotFoundException('Catégorie introuvable');
    }
    return this.taxonomyRepository.listSubcategories(categorySlug, false);
  }

  async createSubcategory(
    dto: CreateListingSubcategoryDto,
  ): Promise<ListingSubcategory> {
    const existing = await this.taxonomyRepository.findSubcategory(dto.slug);
    if (existing) {
      throw new ConflictException(
        `La sous-catégorie « ${dto.slug} » existe déjà`,
      );
    }
    const category = await this.taxonomyRepository.findCategory(
      dto.categorySlug,
    );
    if (!category) {
      throw new BadRequestException(
        `Catégorie parente inconnue : « ${dto.categorySlug} »`,
      );
    }
    return this.taxonomyRepository.createSubcategory({
      slug: dto.slug,
      categorySlug: dto.categorySlug,
      labelFr: dto.labelFr.trim(),
      position: dto.position,
      isActive: dto.isActive,
    });
  }

  async updateSubcategory(
    slug: string,
    dto: UpdateListingSubcategoryDto,
  ): Promise<ListingSubcategory> {
    const existing = await this.taxonomyRepository.findSubcategory(slug);
    if (!existing) {
      throw new NotFoundException('Sous-catégorie introuvable');
    }
    return this.taxonomyRepository.updateSubcategory(slug, {
      ...(dto.labelFr !== undefined ? { labelFr: dto.labelFr.trim() } : {}),
      ...(dto.position !== undefined ? { position: dto.position } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  // ── Tags ────────────────────────────────────────────────────────────────────

  /** Tous les tags (actifs ET inactifs), triés par slug. */
  listTags(): Promise<ListingTag[]> {
    return this.taxonomyRepository.listTags(false);
  }

  async createTag(dto: CreateListingTagDto): Promise<ListingTag> {
    const existing = await this.taxonomyRepository.findTag(dto.slug);
    if (existing) {
      throw new ConflictException(`Le tag « ${dto.slug} » existe déjà`);
    }
    return this.taxonomyRepository.createTag({
      slug: dto.slug,
      labelFr: dto.labelFr.trim(),
      isActive: dto.isActive,
    });
  }

  async updateTag(
    slug: string,
    dto: UpdateListingTagDto,
  ): Promise<ListingTag> {
    const existing = await this.taxonomyRepository.findTag(slug);
    if (!existing) {
      throw new NotFoundException('Tag introuvable');
    }
    return this.taxonomyRepository.updateTag(slug, {
      ...(dto.labelFr !== undefined ? { labelFr: dto.labelFr.trim() } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }
}

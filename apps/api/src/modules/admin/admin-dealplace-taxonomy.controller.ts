import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  ListingCategory,
  ListingSubcategory,
  ListingTag,
} from '../../database/domain/entities';
import { AdminDealplaceTaxonomyService } from './admin-dealplace-taxonomy.service';
import {
  CreateListingCategoryDto,
  CreateListingSubcategoryDto,
  CreateListingTagDto,
  UpdateListingCategoryDto,
  UpdateListingSubcategoryDto,
  UpdateListingTagDto,
} from './dto/dealplace-taxonomy.dto';

/**
 * Contrôleur taxonomie Dealplace du backoffice (CP2.1) — catégories,
 * sous-catégories et tags (GET tous statuts, POST, PATCH).
 *
 * Double protection : guard JWT GLOBAL (401) + RolesGuard +
 * @Roles('moderator','super_admin') (403 pour un utilisateur simple).
 *
 * Le SLUG est immuable (aucun PATCH ne le modifie). moderation_level d'une
 * catégorie est éditable ; family (catégorie) et categorySlug (sous-catégorie)
 * sont figés.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/dealplace')
export class AdminDealplaceTaxonomyController {
  constructor(private readonly service: AdminDealplaceTaxonomyService) {}

  // ── Catégories ─────────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({
    summary: 'Lister les catégories (actives ET inactives)',
    description:
      'Toutes les catégories triées par position. GET /dealplace/taxonomy ' +
      'reste public et ne sert que les catégories actives au formulaire mobile.',
  })
  @ApiResponse({ status: 200, description: 'Liste des catégories' })
  listCategories(): Promise<ListingCategory[]> {
    return this.service.listCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Créer une catégorie' })
  @ApiResponse({ status: 201, description: 'Catégorie créée' })
  @ApiResponse({ status: 409, description: 'Slug déjà utilisé' })
  createCategory(
    @Body() dto: CreateListingCategoryDto,
  ): Promise<ListingCategory> {
    return this.service.createCategory(dto);
  }

  @Patch('categories/:slug')
  @ApiOperation({
    summary: 'Modifier une catégorie (label, position, moderationLevel, isActive)',
    description: 'Le slug et la famille sont immuables.',
  })
  @ApiParam({ name: 'slug', description: 'Slug de la catégorie' })
  @ApiResponse({ status: 200, description: 'Catégorie mise à jour' })
  @ApiResponse({ status: 404, description: 'Catégorie introuvable' })
  updateCategory(
    @Param('slug') slug: string,
    @Body() dto: UpdateListingCategoryDto,
  ): Promise<ListingCategory> {
    return this.service.updateCategory(slug, dto);
  }

  // ── Sous-catégories ─────────────────────────────────────────────────────────

  @Get('subcategories')
  @ApiOperation({
    summary: "Lister les sous-catégories d'une catégorie (actives ET inactives)",
  })
  @ApiQuery({ name: 'category', description: 'Slug de la catégorie parente' })
  @ApiResponse({ status: 200, description: 'Liste des sous-catégories' })
  @ApiResponse({ status: 404, description: 'Catégorie introuvable' })
  listSubcategories(
    @Query('category') categorySlug: string,
  ): Promise<ListingSubcategory[]> {
    return this.service.listSubcategories(categorySlug);
  }

  @Post('subcategories')
  @ApiOperation({ summary: 'Créer une sous-catégorie' })
  @ApiResponse({ status: 201, description: 'Sous-catégorie créée' })
  @ApiResponse({ status: 400, description: 'Catégorie parente inconnue' })
  @ApiResponse({ status: 409, description: 'Slug déjà utilisé' })
  createSubcategory(
    @Body() dto: CreateListingSubcategoryDto,
  ): Promise<ListingSubcategory> {
    return this.service.createSubcategory(dto);
  }

  @Patch('subcategories/:slug')
  @ApiOperation({
    summary: 'Modifier une sous-catégorie (label, position, isActive)',
    description: 'Le slug et la catégorie parente sont immuables.',
  })
  @ApiParam({ name: 'slug', description: 'Slug de la sous-catégorie' })
  @ApiResponse({ status: 200, description: 'Sous-catégorie mise à jour' })
  @ApiResponse({ status: 404, description: 'Sous-catégorie introuvable' })
  updateSubcategory(
    @Param('slug') slug: string,
    @Body() dto: UpdateListingSubcategoryDto,
  ): Promise<ListingSubcategory> {
    return this.service.updateSubcategory(slug, dto);
  }

  // ── Tags ────────────────────────────────────────────────────────────────────

  @Get('tags')
  @ApiOperation({ summary: 'Lister les tags (actifs ET inactifs)' })
  @ApiResponse({ status: 200, description: 'Liste des tags' })
  listTags(): Promise<ListingTag[]> {
    return this.service.listTags();
  }

  @Post('tags')
  @ApiOperation({ summary: 'Créer un tag' })
  @ApiResponse({ status: 201, description: 'Tag créé' })
  @ApiResponse({ status: 409, description: 'Slug déjà utilisé' })
  createTag(@Body() dto: CreateListingTagDto): Promise<ListingTag> {
    return this.service.createTag(dto);
  }

  @Patch('tags/:slug')
  @ApiOperation({
    summary: 'Modifier un tag (label, isActive)',
    description: 'Le slug est immuable.',
  })
  @ApiParam({ name: 'slug', description: 'Slug du tag' })
  @ApiResponse({ status: 200, description: 'Tag mis à jour' })
  @ApiResponse({ status: 404, description: 'Tag introuvable' })
  updateTag(
    @Param('slug') slug: string,
    @Body() dto: UpdateListingTagDto,
  ): Promise<ListingTag> {
    return this.service.updateTag(slug, dto);
  }
}

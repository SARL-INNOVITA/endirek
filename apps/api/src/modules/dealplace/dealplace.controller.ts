import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  ListingCardView,
  ListingView,
} from '../../common/mappers/listing.mapper';
import {
  DealplaceService,
  PagedListingCards,
  TaxonomyView,
} from './dealplace.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListListingsQueryDto } from './dto/list-listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

/**
 * Contrôleur Dealplace (CP2.1) — taxonomie et annonces (listings) publiques et
 * du propriétaire.
 *
 * Toutes les routes exigent un jeton (guard JWT global). Les routes statiques
 * (taxonomy, slug/...) sont déclarées AVANT ':id' pour ne jamais être capturées
 * par le paramètre dynamique.
 */
@ApiTags('dealplace')
@ApiBearerAuth()
@Controller('dealplace')
export class DealplaceController {
  constructor(private readonly dealplaceService: DealplaceService) {}

  @Get('taxonomy')
  @ApiOperation({
    summary: 'Taxonomie Dealplace active (catégories + sous-catégories + tags)',
    description:
      'Catégories actives triées par position (chacune avec sa famille, son ' +
      'niveau de modération et ses sous-catégories actives) + tags actifs. ' +
      'Table de référence pilotable par le backoffice — le mobile construit ' +
      'son formulaire de dépôt avec cette liste.',
  })
  @ApiResponse({ status: 200, description: '{ categories[], tags[] }' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  getTaxonomy(): Promise<TaxonomyView> {
    return this.dealplaceService.getTaxonomy();
  }

  @Get('listings')
  @ApiOperation({
    summary: 'Annuaire public des annonces (filtres + pagination)',
    description:
      'Annonces « active » uniquement, antéchronologiques (tie-break id). ' +
      'Filtres : ?family=&category=&subcategory=&city=&valueMin=&valueMax=' +
      '&tags=&search=. Chaque élément est un LISTING_CARD.',
  })
  @ApiResponse({ status: 200, description: '{ items: LISTING_CARD[], total }' })
  @ApiResponse({ status: 400, description: 'Paramètres invalides' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listListings(
    @Query() query: ListListingsQueryDto,
  ): Promise<PagedListingCards> {
    return this.dealplaceService.listPublic(query);
  }

  @Post('listings')
  @ApiOperation({
    summary: 'Créer une annonce',
    description:
      'Règles : valeur cohérente (fixed → valueMin ; range → valueMin ≤ ' +
      'valueMax) ; PHOTO obligatoire pour un bien (≥ 1 média), facultative ' +
      'pour un service ; commune du référentiel ; catégorie + sous-catégorie ' +
      'cohérentes (famille correcte) ; catégorie « forbidden » refusée (400) ; ' +
      'exchangePrefs non vide ; médias issus de POST /media/upload uniquement. ' +
      'urlSlug généré unique.',
  })
  @ApiResponse({ status: 201, description: 'LISTING créé' })
  @ApiResponse({
    status: 400,
    description:
      'Données invalides, catégorie interdite, photo manquante (bien) ou média externe',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateListingDto,
  ): Promise<ListingView> {
    return this.dealplaceService.create(user.userId, dto);
  }

  @Get('listings/slug/:slug')
  @ApiOperation({
    summary: "Détail d'une annonce par urlSlug",
    description:
      "Mêmes règles de visibilité que GET /dealplace/listings/:id : " +
      "'deleted' → 404 ; 'hidden' → 404 sauf propriétaire et rôles " +
      'moderator/super_admin.',
  })
  @ApiParam({ name: 'slug', description: "urlSlug public de l'annonce" })
  @ApiResponse({ status: 200, description: 'LISTING' })
  @ApiResponse({ status: 404, description: 'Annonce introuvable' })
  getBySlug(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ): Promise<ListingView> {
    return this.dealplaceService.getBySlug(user, slug);
  }

  @Get('listings/:id')
  @ApiOperation({
    summary: "Détail d'une annonce",
    description:
      "'deleted' → 404 ; 'hidden' → 404 sauf pour le propriétaire et les " +
      'rôles moderator/super_admin.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'annonce" })
  @ApiResponse({ status: 200, description: 'LISTING' })
  @ApiResponse({ status: 404, description: 'Annonce introuvable' })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ListingView> {
    return this.dealplaceService.getById(user, id);
  }

  @Patch('listings/:id')
  @ApiOperation({
    summary: 'Modifier une annonce (propriétaire uniquement)',
    description:
      'Champs modifiables : title, description, value*, category, ' +
      'subcategory, exchangePrefs, externalLinks, tags. Le type d\'annonce, ' +
      'la commune et les médias ne sont pas modifiables au CP2.1. La ' +
      'cohérence valeur/catégorie est revérifiée (400 sinon).',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'annonce" })
  @ApiResponse({ status: 200, description: 'LISTING mis à jour' })
  @ApiResponse({ status: 400, description: 'Données incohérentes' })
  @ApiResponse({ status: 403, description: "Le viewer n'est pas le propriétaire" })
  @ApiResponse({ status: 404, description: 'Annonce introuvable' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ): Promise<ListingView> {
    return this.dealplaceService.update(user, id, dto);
  }

  @Delete('listings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une annonce (propriétaire uniquement — soft-delete)',
    description:
      "status='deleted' : la ligne reste (audit), l'annonce disparaît de " +
      "l'annuaire et du détail (404).",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'annonce" })
  @ApiResponse({ status: 204, description: 'Annonce supprimée' })
  @ApiResponse({ status: 403, description: "Le viewer n'est pas le propriétaire" })
  @ApiResponse({ status: 404, description: 'Annonce introuvable' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.dealplaceService.remove(user, id);
  }
}

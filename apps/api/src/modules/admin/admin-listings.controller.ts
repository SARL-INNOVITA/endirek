import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminListingCard,
  AdminListingDetail,
  AdminListingsService,
  PagedAdminListingCards,
} from './admin-listings.service';
import { AdminListListingsQueryDto } from './dto/admin-list-listings-query.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';

/**
 * Contrôleur annonces du backoffice (CP2.1).
 *
 * Double protection : guard JWT GLOBAL (401 sans jeton) + RolesGuard +
 * @Roles('moderator','super_admin') (403 pour un utilisateur simple).
 *
 * Forme renvoyée : LISTING_CARD + status (liste) et LISTING complet (détail),
 * assemblés par ListingAssembler — MÊME source unique que l'annuaire public.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/dealplace/listings')
export class AdminListingsController {
  constructor(private readonly service: AdminListingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les annonces (backoffice)',
    description:
      'Liste paginée, TOUS statuts confondus (active, hidden, deleted — ' +
      'audit). ?status= filtre par statut, ?family= par famille, ?category= ' +
      'par catégorie, ?flaggedOnly= par niveau de modération de la ' +
      'catégorie (CP2.5), ?search= cherche dans le titre, la description et ' +
      'le nom du propriétaire (insensible à la casse). Chaque élément est ' +
      'un LISTING_CARD enrichi du statut et du nombre de signalements ' +
      'ouverts (openReportsCount — CP2.5).',
  })
  @ApiResponse({
    status: 200,
    description: '{ items: LISTING_CARD + status, total }',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  listListings(
    @Query() query: AdminListListingsQueryDto,
  ): Promise<PagedAdminListingCards> {
    return this.service.listListings(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détail d'une annonce (backoffice)",
    description:
      'LISTING complet quel que soit le statut (y compris hidden et ' +
      'deleted) + les signalements liés (reports, openReportsCount — ' +
      'CP2.5) — 404 uniquement si l\'identifiant n\'existe pas.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'annonce" })
  @ApiResponse({ status: 200, description: 'LISTING + reports' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Annonce introuvable' })
  getListing(@Param('id') id: string): Promise<AdminListingDetail> {
    return this.service.getListing(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Masquer ou republier une annonce (backoffice)',
    description:
      'Statuts posables : « active » et « hidden » UNIQUEMENT. La ' +
      'suppression appartient au propriétaire (DELETE) ou au flux RGPD ' +
      '(400). Une annonce « deleted » n\'est jamais restaurée (409).',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'annonce" })
  @ApiResponse({ status: 200, description: 'LISTING_CARD + status à jour' })
  @ApiResponse({
    status: 400,
    description: 'Statut invalide, ou « deleted » demandé (refusé)',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Annonce introuvable' })
  @ApiResponse({ status: 409, description: 'Annonce supprimée : statut définitif' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateListingStatusDto,
  ): Promise<AdminListingCard> {
    return this.service.updateStatus(id, dto);
  }
}

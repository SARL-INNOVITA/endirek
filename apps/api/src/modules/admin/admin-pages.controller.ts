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
  AdminPageDetail,
  AdminPagesService,
  PagedAdminPageCards,
} from './admin-pages.service';
import { AdminListPagesQueryDto } from './dto/admin-list-pages-query.dto';
import {
  UpdatePageStatusDto,
  UpdatePageVerifiedDto,
} from './dto/update-page-status.dto';

/**
 * Contrôleur pages du backoffice (Lot 3 — D76) — rôles moderator et
 * super_admin uniquement. Module PRD §13 « Pages : validation, modification,
 * statut » : liste tous statuts, détail avec signalements liés,
 * masquer/republier, badge vérifié. Le « changement de propriétaire » reste
 * V2 (documenté).
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/pages')
export class AdminPagesController {
  constructor(private readonly adminPagesService: AdminPagesService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste backoffice des pages (tous statuts)',
    description:
      'Filtres pageType/status/verified/flaggedOnly + recherche ' +
      'nom/commune/propriétaire. Chaque carte porte le compteur de ' +
      'signalements ouverts (pattern des annonces).',
  })
  @ApiResponse({ status: 200, description: '{ items: AdminPageCard[], total }' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  listPages(
    @Query() query: AdminListPagesQueryDto,
  ): Promise<PagedAdminPageCards> {
    return this.adminPagesService.listPages(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détail backoffice d'une page",
    description:
      'PAGE complète (tous statuts) + compteurs de contenus + historique ' +
      'des offres/événements + signalements liés.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: 'AdminPageDetail' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  getPage(@Param('id') id: string): Promise<AdminPageDetail> {
    return this.adminPagesService.getPage(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Masquer ou republier une page',
    description:
      "« active » ou « hidden » uniquement — masquer retire aussi les " +
      'publications de la page du feed et de la carte (D69). « deleted » ' +
      'est refusé (400) ; une page supprimée ne se restaure pas (409).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: 'AdminPageDetail à jour' })
  @ApiResponse({ status: 400, description: 'Statut « deleted » refusé' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  @ApiResponse({
    status: 409,
    description: 'Cette page a été supprimée : son statut ne peut plus être modifié',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePageStatusDto,
  ): Promise<AdminPageDetail> {
    return this.adminPagesService.updateStatus(id, dto);
  }

  @Patch(':id/verified')
  @ApiOperation({
    summary: 'Accorder ou retirer le badge vérifié',
    description:
      'Le badge ✓ du mockup 08 — « validation légère » a posteriori (D69). ' +
      'Idempotent.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: 'AdminPageDetail à jour' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  @ApiResponse({
    status: 409,
    description: 'Cette page a été supprimée : son badge ne peut plus être modifié',
  })
  updateVerified(
    @Param('id') id: string,
    @Body() dto: UpdatePageVerifiedDto,
  ): Promise<AdminPageDetail> {
    return this.adminPagesService.updateVerified(id, dto);
  }
}

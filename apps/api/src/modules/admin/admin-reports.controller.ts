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
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminReportsService,
  AdminReportView,
  PagedAdminReports,
} from './admin-reports.service';
import { AdminListReportsQueryDto } from './dto/admin-list-reports-query.dto';
import { HandleReportDto } from './dto/handle-report.dto';

/**
 * Contrôleur signalements du backoffice (file de modération) — contrat
 * d'API étape 4.
 *
 * Double protection sur TOUT le contrôleur :
 * 1. le guard JWT GLOBAL (AuthModule) authentifie le porteur du jeton
 *    (aucune route n'est @Public) → 401 sans jeton valide ;
 * 2. RolesGuard + @Roles('moderator', 'super_admin') exige un rôle
 *    d'administration → 403 pour un utilisateur simple.
 *
 * Rappel d'équivalence documentée : le statut « open » correspond au
 * « pending » de la spécification produit.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get()
  @ApiOperation({
    summary: 'File des signalements (backoffice)',
    description:
      'Liste paginée antéchronologique. ?status= filtre par statut (open, ' +
      'reviewed, action_taken, dismissed), ?targetType= par type de cible ' +
      '(post, comment, user). Chaque signalement embarque son auteur ' +
      '(forme AUTEUR) et un EXTRAIT de la cible (corps ≤ 140 caractères ; ' +
      'null si la cible est introuvable).',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ items: [{ id, targetType, targetId, reasonCode, message, status, ' +
      'createdAt, reporter, target }], total }',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  listReports(
    @Query() query: AdminListReportsQueryDto,
  ): Promise<PagedAdminReports> {
    return this.adminReportsService.listReports(query);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Traiter un signalement (backoffice)',
    description:
      'Pose la décision (« reviewed », « action_taken » ou « dismissed ») ' +
      'avec handledBy = administrateur courant, handledAt = maintenant et ' +
      'la note de résolution éventuelle. Le CONTENU visé n’est pas ' +
      'modifié : le masquer est une action séparée ' +
      '(PATCH /admin/posts/:id/status).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du signalement' })
  @ApiResponse({ status: 200, description: 'Signalement à jour' })
  @ApiResponse({ status: 400, description: 'Statut de décision invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Signalement introuvable' })
  handleReport(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: HandleReportDto,
  ): Promise<AdminReportView> {
    return this.adminReportsService.handleReport(admin, id, dto);
  }
}

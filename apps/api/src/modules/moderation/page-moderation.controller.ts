import { Body, Controller, Param, Post } from '@nestjs/common';
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
import { CreateReportDto } from './dto/create-report.dto';
import { CreatedReport, ModerationService } from './moderation.service';

/**
 * Signalement d'une page professionnelle (Lot 3 — D76) — route ancrée sous
 * /pages/:id (« :id/report » a deux segments : aucune collision avec « :id »
 * de PagesController). Mêmes règles que les posts et les annonces.
 */
@ApiTags('moderation')
@ApiBearerAuth()
@Controller('pages')
export class PageModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post(':id/report')
  @ApiOperation({
    summary: 'Signaler une page professionnelle',
    description:
      'La page signalée RESTE active tant que la modération n’a pas statué ' +
      '(masquage via le backoffice — PATCH /admin/pages/:id/status). Un ' +
      'même utilisateur ne peut signaler la même page qu’une seule fois ' +
      '(409 sinon). Signaler sa PROPRE page est refusé (400 — le ' +
      'propriétaire peut la supprimer). Statut initial « open ».',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 201, description: "{ id, status: 'open' }" })
  @ApiResponse({
    status: 400,
    description: 'Sa propre page ou motif invalide',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  @ApiResponse({ status: 409, description: 'Vous avez déjà signalé ce contenu' })
  reportPage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReportDto,
  ): Promise<CreatedReport> {
    return this.moderationService.reportPage(user, id, dto);
  }
}

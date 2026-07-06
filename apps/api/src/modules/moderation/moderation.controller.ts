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
 * Signalement d'une publication — route ancrée sous /posts/:id
 * (« :id/report » a deux segments : aucune collision avec « :id » de
 * PostsController). La file de traitement backoffice arrive à l'étape 6.
 */
@ApiTags('moderation')
@ApiBearerAuth()
@Controller('posts')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post(':id/report')
  @ApiOperation({
    summary: 'Signaler une publication',
    description:
      'Le post signalé RESTE actif tant que la modération n’a pas statué. ' +
      'Un même utilisateur ne peut signaler la même publication qu’une ' +
      'seule fois (409 sinon). Signaler sa PROPRE publication est refusé ' +
      '(400 — décision produit : l’auteur peut supprimer son post). ' +
      'Statut initial « open » (= « pending » de la spécification produit).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({ status: 201, description: "{ id, status: 'open' }" })
  @ApiResponse({
    status: 400,
    description: 'Motif invalide ou signalement de sa propre publication',
  })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  @ApiResponse({ status: 409, description: 'Contenu déjà signalé' })
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReportDto,
  ): Promise<CreatedReport> {
    return this.moderationService.reportPost(user, id, dto);
  }
}

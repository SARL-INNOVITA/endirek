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
 * Signalement d'une annonce Dealplace (CP2.5 — D65) — route ancrée sous
 * /dealplace/listings/:id (« :id/report » a deux segments : aucune collision
 * avec « :id » de DealplaceController). Mêmes règles que les posts.
 */
@ApiTags('moderation')
@ApiBearerAuth()
@Controller('dealplace/listings')
export class ListingModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post(':id/report')
  @ApiOperation({
    summary: 'Signaler une annonce Dealplace',
    description:
      'L’annonce signalée RESTE active tant que la modération n’a pas ' +
      'statué (masquage via le backoffice). Un même utilisateur ne peut ' +
      'signaler la même annonce qu’une seule fois (409 sinon). Signaler sa ' +
      'PROPRE annonce est refusé (400 — le propriétaire peut la supprimer). ' +
      'Statut initial « open » (= « pending » de la spécification produit).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de l’annonce' })
  @ApiResponse({ status: 201, description: "{ id, status: 'open' }" })
  @ApiResponse({
    status: 400,
    description: 'Motif invalide ou signalement de sa propre annonce',
  })
  @ApiResponse({ status: 404, description: 'Annonce introuvable' })
  @ApiResponse({ status: 409, description: 'Contenu déjà signalé' })
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReportDto,
  ): Promise<CreatedReport> {
    return this.moderationService.reportListing(user, id, dto);
  }
}

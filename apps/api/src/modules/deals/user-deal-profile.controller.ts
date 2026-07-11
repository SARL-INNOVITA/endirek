import { Controller, Get, Param } from '@nestjs/common';
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
import { DealProfileView, DealsService } from './deals.service';

/**
 * Stats Dealplace d'un profil — route /users/... déclarée ICI (le module
 * deals possède les agrégats d'avis et de deals conclus), comme
 * UserListingsController côté annonces. 'me/deal-profile' AVANT
 * ':id/deal-profile' pour ne pas être capturé.
 */
@ApiTags('deals')
@ApiBearerAuth()
@Controller('users')
export class UserDealProfileController {
  constructor(private readonly dealsService: DealsService) {}

  @Get('me/deal-profile')
  @ApiOperation({
    summary: 'MES stats Dealplace (deals réalisés, avis reçus, deals conclus)',
  })
  @ApiResponse({ status: 200, description: 'DEAL_PROFILE' })
  myDealProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealProfileView> {
    return this.dealsService.dealProfile(user, user.userId);
  }

  @Get(':id/deal-profile')
  @ApiOperation({
    summary:
      "Stats Dealplace publiques d'un profil (mockup 05) : deals réalisés, " +
      'moyennes des 3 critères + note globale, derniers avis, deals conclus',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'DEAL_PROFILE' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  dealProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DealProfileView> {
    return this.dealsService.dealProfile(user, id);
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
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
  DealplaceService,
  PagedListingCards,
  PagedOwnerListingCards,
} from './dealplace.service';
import { OwnerListingsQueryDto } from './dto/owner-listings-query.dto';

/**
 * Listes d'annonces d'un profil — routes /users/... déclarées ICI (le module
 * dealplace possède la forme LISTING_CARD), sans collision avec le module
 * users ni le module posts : les segments « :id/listings » et « me/listings »
 * ne sont capturés par aucune autre route. 'me/listings' est déclaré AVANT
 * ':id/listings' pour ne pas être capturé.
 */
@ApiTags('dealplace')
@ApiBearerAuth()
@Controller('users')
export class UserListingsController {
  constructor(private readonly dealplaceService: DealplaceService) {}

  @Get('me/listings')
  @ApiOperation({
    summary: "Mes annonces ('active' + 'hidden', jamais 'deleted')",
    description:
      'Le statut figure dans chaque carte — un propriétaire voit ses annonces ' +
      'masquées par la modération.',
  })
  @ApiResponse({
    status: 200,
    description: '{ items: (LISTING_CARD + status)[], total }',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listMyListings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OwnerListingsQueryDto,
  ): Promise<PagedOwnerListingCards> {
    return this.dealplaceService.listMine(
      user,
      query.limit,
      query.offset,
      query.family,
    );
  }

  @Get(':id/listings')
  @ApiOperation({
    summary: "Annonces 'active' d'un profil visible",
    description:
      "404 si le compte n'existe pas, est supprimé ou est suspendu.",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 200, description: '{ items: LISTING_CARD[], total }' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  listUserListings(
    @Param('id') id: string,
    @Query() query: OwnerListingsQueryDto,
  ): Promise<PagedListingCards> {
    return this.dealplaceService.listOwnerActive(
      id,
      query.limit,
      query.offset,
      query.family,
    );
  }
}

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
import {
  OwnerPagesView,
  PagesService,
  PublicPagesView,
} from './pages.service';

/**
 * Routes de PROFIL des pages (Lot 3 — D69) — déclarées dans le module pages
 * car il « possède » la forme PAGE_CARD (pattern UserListingsController).
 * `me/pages` est déclaré AVANT `:id/pages`.
 */
@ApiTags('pages')
@ApiBearerAuth()
@Controller('users')
export class UserPagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get('me/pages')
  @ApiOperation({
    summary: 'Mes pages (« Mes pages » du profil)',
    description:
      'Toutes mes pages active + hidden (miroir D61 : je distingue mes ' +
      'pages masquées par la modération), de la plus ancienne à la plus ' +
      'récente. Cartes OwnerPageCard (PAGE_CARD + status).',
  })
  @ApiResponse({ status: 200, description: '{ items: OwnerPageCard[] }' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<OwnerPagesView> {
    return this.pagesService.listMine(user);
  }

  @Get(':id/pages')
  @ApiOperation({
    summary: "Pages ACTIVES d'un utilisateur",
    description:
      "Cartes PAGE_CARD des pages actives d'un compte visible (404 si le " +
      'compte est suspendu/supprimé/inexistant).',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 200, description: '{ items: PAGE_CARD[] }' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  listByUser(@Param('id') id: string): Promise<PublicPagesView> {
    return this.pagesService.listByUser(id);
  }
}

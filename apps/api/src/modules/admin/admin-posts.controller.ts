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
  AdminFeedPost,
  AdminPostDetail,
  AdminPostsService,
  PagedAdminFeedPosts,
} from './admin-posts.service';
import { AdminListPostsQueryDto } from './dto/admin-list-posts-query.dto';
import { UpdatePostStatusDto } from './dto/update-post-status.dto';

/**
 * Contrôleur publications du backoffice — contrat d'API étape 4.
 *
 * Double protection sur TOUT le contrôleur :
 * 1. le guard JWT GLOBAL (AuthModule) authentifie le porteur du jeton
 *    (aucune route n'est @Public) → 401 sans jeton valide ;
 * 2. RolesGuard + @Roles('moderator', 'super_admin') exige un rôle
 *    d'administration → 403 pour un utilisateur simple.
 *
 * Forme renvoyée : FEED_POST (assemblé par FeedPostAssembler — la MÊME
 * source unique que le feed public) + openReportsCount, et les signalements
 * liés dans le détail.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/posts')
export class AdminPostsController {
  constructor(private readonly adminPostsService: AdminPostsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les publications (backoffice)',
    description:
      'Liste paginée, TOUS statuts confondus (active, hidden, deleted — ' +
      'audit). ?typeSlug= filtre par type, ?status= par statut, ?search= ' +
      'cherche dans le titre, le corps et le nom affiché de l’auteur ' +
      '(insensible à la casse). Chaque élément est un FEED_POST enrichi ' +
      'de openReportsCount (signalements ouverts).',
  })
  @ApiResponse({
    status: 200,
    description: '{ items: FEED_POST + openReportsCount, total }',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  listPosts(
    @CurrentUser() admin: AuthenticatedUser,
    @Query() query: AdminListPostsQueryDto,
  ): Promise<PagedAdminFeedPosts> {
    return this.adminPostsService.listPosts(admin, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détail d'une publication (backoffice)",
    description:
      'FEED_POST quel que soit le statut (y compris hidden et deleted) + ' +
      'les signalements liés { id, reasonCode, message, status, createdAt, ' +
      'reporter } — 404 uniquement si l’identifiant n’existe pas.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({
    status: 200,
    description: 'FEED_POST + openReportsCount + reports liés',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  getPost(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<AdminPostDetail> {
    return this.adminPostsService.getPost(admin, id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Masquer ou republier une publication (backoffice)',
    description:
      'Statuts posables : « active » et « hidden » UNIQUEMENT — la ' +
      'suppression appartient à l’auteur (DELETE /posts/:id) ou au flux ' +
      'RGPD, jamais au backoffice (400). Une publication masquée disparaît ' +
      'du feed, de la carte et du détail public mais reste visible de son ' +
      'auteur et des modérateurs.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({
    status: 200,
    description: 'FEED_POST + openReportsCount à jour',
  })
  @ApiResponse({
    status: 400,
    description: 'Statut invalide, ou « deleted » demandé (refusé)',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  @ApiResponse({
    status: 409,
    description: 'Publication supprimée (auteur/RGPD) : statut définitif',
  })
  updateStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePostStatusDto,
  ): Promise<AdminFeedPost> {
    return this.adminPostsService.updateStatus(admin, id, dto);
  }
}

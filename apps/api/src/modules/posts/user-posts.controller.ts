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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PagedFeedPosts, PostsService } from './posts.service';

/**
 * Listes de publications d'un profil — routes /users/... déclarées ICI (le
 * module posts possède la forme FEED_POST), sans collision avec le module
 * users : ses routes /users/:id, /users/:id/followers... ne capturent pas
 * les chemins « :id/posts » ni « me/posts » (segments différents).
 * 'me/posts' est déclaré AVANT ':id/posts' pour ne pas être capturé.
 */
@ApiTags('posts')
@ApiBearerAuth()
@Controller('users')
export class UserPostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('me/posts')
  @ApiOperation({
    summary: "Mes publications ('active' + 'hidden', jamais 'deleted')",
    description:
      'Le statut figure dans chaque FEED_POST — un auteur voit ses posts ' +
      'masqués par la modération.',
  })
  @ApiResponse({ status: 200, description: '{ items: FEED_POST[], total }' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listMyPosts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PagedFeedPosts> {
    return this.postsService.listMyPosts(user, {
      limit: pagination.limit,
      offset: pagination.offset,
    });
  }

  @Get(':id/posts')
  @ApiOperation({
    summary: "Publications 'active' d'un profil visible",
    description:
      "404 si le compte n'existe pas, est supprimé ou est suspendu.",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 200, description: '{ items: FEED_POST[], total }' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  listUserPosts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PagedFeedPosts> {
    return this.postsService.listUserPosts(user, id, {
      limit: pagination.limit,
      offset: pagination.offset,
    });
  }
}

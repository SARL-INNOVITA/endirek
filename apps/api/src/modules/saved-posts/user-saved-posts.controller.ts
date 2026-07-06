import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PagedFeedPosts } from '../posts/posts.service';
import { SavedPostsService } from './saved-posts.service';

/**
 * GET /users/me/saved-posts — déclaré ICI (module saved-posts) plutôt que
 * dans le contrôleur users : la forme servie est FEED_POST (elle appartient
 * à la couche posts, pas aux profils) et la logique vit dans ce module.
 * Aucune collision de routes : « me/saved-posts » a deux segments, jamais
 * capturé par « :id » de UsersController — même schéma éprouvé que
 * UserPostsController (modules/posts/user-posts.controller.ts).
 */
@ApiTags('saved-posts')
@ApiBearerAuth()
@Controller('users')
export class UserSavedPostsController {
  constructor(private readonly savedPostsService: SavedPostsService) {}

  @Get('me/saved-posts')
  @ApiOperation({
    summary: 'Mes publications enregistrées',
    description:
      'Du plus récemment enregistré au plus ancien, forme FEED_POST ' +
      '(viewerSaved true). Les posts devenus hidden/deleted sont exclus.',
  })
  @ApiResponse({ status: 200, description: '{ items: FEED_POST[], total }' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listMySavedPosts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PagedFeedPosts> {
    return this.savedPostsService.listMySavedPosts(user, {
      limit: pagination.limit,
      offset: pagination.offset,
    });
  }
}

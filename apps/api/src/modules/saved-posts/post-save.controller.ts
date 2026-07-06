import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { SavedPostsService } from './saved-posts.service';

/**
 * Enregistrement d'un post — routes ancrées sous /posts/:id (« :id/save »
 * a deux segments : aucune collision avec « :id » de PostsController).
 */
@ApiTags('saved-posts')
@ApiBearerAuth()
@Controller('posts')
export class PostSaveController {
  constructor(private readonly savedPostsService: SavedPostsService) {}

  @Post(':id/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Enregistrer une publication (collection « Général »)',
    description:
      'Idempotent : ré-enregistrer un post déjà enregistré rend 204. La ' +
      'collection par défaut « Général » est créée au besoin. ' +
      "L'enregistrement est privé (invisible pour l'auteur du post).",
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({ status: 204, description: 'Publication enregistrée' })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.savedPostsService.save(user, id);
  }

  @Delete(':id/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Retirer une publication de ses enregistrements",
    description: 'Idempotent : retirer un post non enregistré rend 204.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({ status: 204, description: 'Publication retirée' })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  async unsave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.savedPostsService.unsave(user, id);
  }
}

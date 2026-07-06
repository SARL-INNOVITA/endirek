import {
  Body,
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
import { ReactDto } from './dto/react.dto';
import {
  PostReactionsSummary,
  ReactionsService,
} from './reactions.service';

/**
 * Réactions sur les publications — routes ancrées sous /posts/:id
 * (« :id/reactions » a deux segments : aucune collision avec « :id » de
 * PostsController). Les deux verbes répondent 200 avec l'état À JOUR
 * { reactionCount, reactionsTop, viewerReaction } pour rafraîchir l'UI
 * sans second appel.
 */
@ApiTags('reactions')
@ApiBearerAuth()
@Controller('posts')
export class PostReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post(':id/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réagir à une publication (upsert)',
    description:
      'Une seule réaction par utilisateur et par publication : réagir avec ' +
      'un autre emoji REMPLACE la réaction. Emoji validé contre la table ' +
      'reaction_types (400 avec la liste des emojis valides sinon).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({
    status: 200,
    description: '{ reactionCount, reactionsTop, viewerReaction }',
  })
  @ApiResponse({ status: 400, description: 'Emoji hors palette' })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  react(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReactDto,
  ): Promise<PostReactionsSummary> {
    return this.reactionsService.reactToPost(user, id, dto.emoji);
  }

  @Delete(':id/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retirer sa réaction sur une publication (idempotent)',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({
    status: 200,
    description: '{ reactionCount, reactionsTop, viewerReaction: null }',
  })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  unreact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PostReactionsSummary> {
    return this.reactionsService.unreactFromPost(user, id);
  }
}

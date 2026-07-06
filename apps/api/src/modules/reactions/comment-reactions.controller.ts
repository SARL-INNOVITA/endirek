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
  CommentReactionsSummary,
  ReactionsService,
} from './reactions.service';

/**
 * Réactions sur les commentaires — mêmes règles que sur les posts
 * (upsert, retrait idempotent, palette reaction_types), réponse réduite
 * à { reactionCount, viewerReaction } (pas de reactionsTop au contrat).
 */
@ApiTags('reactions')
@ApiBearerAuth()
@Controller('comments')
export class CommentReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post(':id/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réagir à un commentaire (upsert)',
    description:
      'Une seule réaction par utilisateur et par commentaire : réagir avec ' +
      'un autre emoji REMPLACE la réaction. Emoji validé contre la table ' +
      'reaction_types (400 avec la liste des emojis valides sinon).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du commentaire' })
  @ApiResponse({
    status: 200,
    description: '{ reactionCount, viewerReaction }',
  })
  @ApiResponse({ status: 400, description: 'Emoji hors palette' })
  @ApiResponse({ status: 404, description: 'Commentaire introuvable' })
  react(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReactDto,
  ): Promise<CommentReactionsSummary> {
    return this.reactionsService.reactToComment(user, id, dto.emoji);
  }

  @Delete(':id/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retirer sa réaction sur un commentaire (idempotent)',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du commentaire' })
  @ApiResponse({
    status: 200,
    description: '{ reactionCount, viewerReaction: null }',
  })
  @ApiResponse({ status: 404, description: 'Commentaire introuvable' })
  unreact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CommentReactionsSummary> {
    return this.reactionsService.unreactFromComment(user, id);
  }
}

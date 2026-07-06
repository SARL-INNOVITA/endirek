import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CommentsService, CommentView, PagedComments } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

/**
 * Routes commentaires ancrées sous /posts/:id — déclarées dans le module
 * comments (qui possède la logique), sans collision avec PostsController :
 * « :id/comments » a deux segments, jamais capturé par « :id ».
 */
@ApiTags('comments')
@ApiBearerAuth()
@Controller('posts')
export class PostCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get(':id/comments')
  @ApiOperation({
    summary: "Fil de commentaires d'une publication",
    description:
      'Racines paginées triées created ASC, réponses actives imbriquées ' +
      '(option A : deux niveaux). Une racine supprimée qui garde des ' +
      "réponses actives est servie avec isDeleted true et un corps vide ; " +
      'sans réponse active, elle est exclue.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({ status: 200, description: '{ items, total (racines) }' })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PagedComments> {
    return this.commentsService.listForPost(user, id, {
      limit: pagination.limit,
      offset: pagination.offset,
    });
  }

  @Post(':id/comments')
  @ApiOperation({
    summary: 'Commenter une publication (ou répondre à un commentaire)',
    description:
      'parentCommentId : identifiant d’un commentaire PRINCIPAL du même ' +
      'post → réponse (depth 1). Répondre à une réponse est refusé (400, ' +
      'option A). Notifications in-app : « comment » pour l’auteur du ' +
      'post, « reply » pour l’auteur du parent — jamais à soi-même.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({ status: 201, description: 'Commentaire créé' })
  @ApiResponse({ status: 400, description: 'Données invalides ou niveau 2+' })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentView> {
    return this.commentsService.create(user, id, dto);
  }
}

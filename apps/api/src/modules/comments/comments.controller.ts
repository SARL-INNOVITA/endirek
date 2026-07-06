import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
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
import { CommentsService } from './comments.service';

/** Routes /comments/:id — actions sur un commentaire existant. */
@ApiTags('comments')
@ApiBearerAuth()
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Supprimer un commentaire (auteur du commentaire OU auteur du post)',
    description:
      "Soft-delete : la ligne reste (RGPD/audit), le commentCount du post " +
      'est recalculé. Une racine supprimée qui garde des réponses actives ' +
      'reste affichée en emplacement isDeleted avec un corps vide.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du commentaire' })
  @ApiResponse({ status: 204, description: 'Commentaire supprimé' })
  @ApiResponse({ status: 403, description: 'Ni auteur du commentaire ni du post' })
  @ApiResponse({ status: 404, description: 'Commentaire introuvable' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.commentsService.remove(user, id);
  }
}

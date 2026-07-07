import {
  Body,
  Controller,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminCommentView,
  AdminCommentsService,
} from './admin-comments.service';
import { UpdateCommentStatusDto } from './dto/update-comment-status.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/comments')
export class AdminCommentsController {
  constructor(private readonly service: AdminCommentsService) {}

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Masquer, reactiver ou soft-delete un commentaire',
    description:
      'Action de moderation. Une racine hidden/deleted qui conserve des ' +
      'reponses actives reste servie au public sous forme d’emplacement vide.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du commentaire' })
  @ApiResponse({ status: 200, description: 'Commentaire mis a jour' })
  @ApiResponse({ status: 404, description: 'Commentaire introuvable' })
  @ApiResponse({ status: 409, description: 'Commentaire deja supprime' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCommentStatusDto,
  ): Promise<AdminCommentView> {
    return this.service.updateStatus(id, dto);
  }
}

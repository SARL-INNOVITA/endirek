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
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  AdminConversationsService,
  AdminMessageView,
  PagedAdminConversationCards,
  PagedAdminMessages,
} from './admin-conversations.service';
import { AdminListConversationsQueryDto } from './dto/admin-list-conversations-query.dto';
import { UpdateMessageStatusDto } from './dto/update-message-status.dto';

/**
 * Contrôleur conversations/messages du backoffice (CP2.5 — D67).
 *
 * Double protection : guard JWT GLOBAL (401 sans jeton) + RolesGuard +
 * @Roles('moderator','super_admin') (403 pour un utilisateur simple).
 *
 * Base 'admin/dealplace' (comme la taxonomie) : routes 'conversations',
 * 'conversations/:id/messages' et 'messages/:id/status' — aucune collision
 * avec les routes taxonomie (categories/subcategories/tags) ni listings.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/dealplace')
export class AdminConversationsController {
  constructor(private readonly service: AdminConversationsService) {}

  @Get('conversations')
  @ApiOperation({
    summary: 'Lister les conversations (backoffice)',
    description:
      'Liste paginée de TOUTES les conversations, triées par activité ' +
      'décroissante. ?search= cherche dans le nom des participants et le ' +
      'titre de l’annonce liée (insensible à la casse). Les corps de ' +
      'messages sont servis EN CLAIR (la modération doit lire pour statuer).',
  })
  @ApiResponse({
    status: 200,
    description: '{ items: ADMIN_CONVERSATION_CARD, total }',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  listConversations(
    @Query() query: AdminListConversationsQueryDto,
  ): Promise<PagedAdminConversationCards> {
    return this.service.listConversations(query);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({
    summary: "Messages d'un fil (backoffice)",
    description:
      'Messages du plus récent au plus ancien, corps RÉELS (y compris les ' +
      'messages masqués — status « hidden »). 404 si le fil n’existe pas.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la conversation' })
  @ApiResponse({
    status: 200,
    description: '{ items: ADMIN_MESSAGE, total }',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Conversation introuvable' })
  listMessages(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PagedAdminMessages> {
    return this.service.listMessages(id, {
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Patch('messages/:id/status')
  @ApiOperation({
    summary: 'Masquer ou réactiver un message (backoffice)',
    description:
      '« hidden » : le message RESTE dans le fil mais son corps est ' +
      'remplacé pour les participants (« Message masqué par la ' +
      'modération. ») ; « active » : le message redevient visible. ' +
      'Idempotent — le fil des participants se resynchronise à sa ' +
      'réouverture (pas d’event socket de modération — D67).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du message' })
  @ApiResponse({ status: 200, description: 'ADMIN_MESSAGE à jour' })
  @ApiResponse({ status: 400, description: 'Statut invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Message introuvable' })
  updateMessageStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMessageStatusDto,
  ): Promise<AdminMessageView> {
    return this.service.updateMessageStatus(id, dto);
  }
}

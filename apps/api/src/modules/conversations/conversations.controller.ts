import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import {
  ConversationsService,
  ConversationView,
  MessageView,
  PagedConversations,
  PagedMessages,
} from './conversations.service';
import { SendMessageDto } from './dto/send-message.dto';
import { StartConversationDto } from './dto/start-conversation.dto';

/**
 * Contrôleur conversations 1-to-1 (Lot 2 — CP2.3).
 *
 * Toutes les routes exigent un jeton (guard JWT global) et sont STRICTEMENT
 * réservées aux participants du fil (404 sinon — ne rien divulguer). Les
 * routes statiques ('unread-count', 'listing/...') sont déclarées AVANT ':id'
 * pour ne jamais être capturées par le paramètre dynamique.
 */
@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Mes conversations (triées par activité décroissante)',
    description:
      'Chaque élément est une forme CONVERSATION : annonce (référence ' +
      'légère), interlocuteur (forme AUTEUR), dernier message, nombre de ' +
      'non-lus. `unreadConversations` alimente le badge du header.',
  })
  @ApiResponse({
    status: 200,
    description: '{ items: CONVERSATION[], total, unreadConversations }',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PagedConversations> {
    return this.conversationsService.listMine(user, {
      limit: pagination.limit,
      offset: pagination.offset,
    });
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Badge messagerie : nombre de conversations avec non-lus',
    description:
      'Polling de repli du badge (le temps réel pousse déjà ' +
      "'message.created' avec ce compteur à jour).",
  })
  @ApiResponse({ status: 200, description: '{ unreadConversations }' })
  unreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ unreadConversations: number }> {
    return this.conversationsService.unreadCount(user);
  }

  @Get('listing/:listingId')
  @ApiOperation({
    summary: 'Ma conversation existante sur une annonce',
    description:
      "404 si je n'ai pas encore ouvert de fil sur cette annonce — le " +
      'mobile propose alors la saisie du premier message (POST /conversations).',
  })
  @ApiParam({ name: 'listingId', description: "Identifiant de l'annonce" })
  @ApiResponse({ status: 200, description: 'CONVERSATION' })
  @ApiResponse({ status: 404, description: 'Conversation introuvable' })
  findMineForListing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId') listingId: string,
  ): Promise<ConversationView> {
    return this.conversationsService.findMineForListing(user, listingId);
  }

  @Get('page/:pageId')
  @ApiOperation({
    summary: 'Ma conversation existante avec une page (Lot 3 — D75)',
    description:
      "404 si je n'ai pas encore ouvert de fil avec cette page — le mobile " +
      'propose alors la saisie du premier message (POST /conversations).',
  })
  @ApiParam({ name: 'pageId', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: 'CONVERSATION' })
  @ApiResponse({ status: 404, description: 'Conversation introuvable' })
  findMineForPage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
  ): Promise<ConversationView> {
    return this.conversationsService.findMineForPage(user, pageId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Démarrer (ou reprendre) une conversation sur une annonce ou une page',
    description:
      'Get-or-create sur (cible, moi) + envoi du PREMIER message — ' +
      'exactement UNE cible parmi listingId (D63) et pageId (Lot 3 — D75). ' +
      "La cible doit être 'active' (404 sinon) et ne pas m'appartenir " +
      '(400). Le destinataire reçoit le message en temps réel ' +
      "(event 'message.created').",
  })
  @ApiResponse({ status: 201, description: '{ conversation, message }' })
  @ApiResponse({
    status: 400,
    description:
      'Sa propre annonce/page, cible manquante ou double, ou corps invalide',
  })
  @ApiResponse({ status: 404, description: 'Annonce ou page introuvable' })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartConversationDto,
  ): Promise<{ conversation: ConversationView; message: MessageView }> {
    return this.conversationsService.start(user, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détail d'une conversation (participants uniquement)",
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la conversation' })
  @ApiResponse({ status: 200, description: 'CONVERSATION' })
  @ApiResponse({ status: 404, description: 'Conversation introuvable' })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ConversationView> {
    return this.conversationsService.getById(user, id);
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: "Messages d'une conversation (du plus récent au plus ancien)",
    description:
      'Paginé — le client inverse la page pour l’affichage chronologique.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la conversation' })
  @ApiResponse({ status: 200, description: '{ items: MESSAGE[], total }' })
  @ApiResponse({ status: 404, description: 'Conversation introuvable' })
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PagedMessages> {
    return this.conversationsService.listMessages(user, id, {
      limit: pagination.limit,
      offset: pagination.offset,
    });
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Envoyer un message dans un fil existant',
    description:
      'Persiste puis pousse au destinataire (room user:<id>, event ' +
      "'message.created' avec son badge à jour).",
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la conversation' })
  @ApiResponse({ status: 201, description: 'MESSAGE créé' })
  @ApiResponse({ status: 400, description: 'Corps invalide' })
  @ApiResponse({ status: 404, description: 'Conversation introuvable' })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageView> {
    return this.conversationsService.sendMessage(user, id, dto);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marquer le fil comme lu (idempotent)',
    description:
      'Pose MON jalon de lecture à maintenant ; retourne le badge global à ' +
      'jour pour resynchroniser le client.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la conversation' })
  @ApiResponse({ status: 200, description: '{ unreadConversations }' })
  @ApiResponse({ status: 404, description: 'Conversation introuvable' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ unreadConversations: number }> {
    return this.conversationsService.markRead(user, id);
  }
}

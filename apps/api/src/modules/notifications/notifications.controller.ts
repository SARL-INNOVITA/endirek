import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  NotificationsService,
  PagedNotifications,
} from './notifications.service';

/**
 * Contrôleur notifications (authentifié — guard JWT global) : toutes les
 * routes ne servent QUE les notifications de l'utilisateur courant.
 *
 * NB : l'ordre des routes compte — /unread-count et /read-all sont déclarées
 * AVANT :id/read (segments littéraux) pour qu'un chemin comme
 * « /notifications/read-all » ne soit jamais capté comme un « :id ».
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Mes notifications (antéchronologiques, paginées)',
    description:
      'Liste des notifications de l’utilisateur courant, de la plus récente ' +
      'à la plus ancienne. Renvoie aussi le total et le nombre de non-lues.',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ items: [{ id, type, payload, readAt, createdAt }], total, ' +
      'unreadCount }',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PagedNotifications> {
    return this.notificationsService.listMine(user, {
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Nombre de notifications non lues',
    description:
      'Compteur léger — utilisé par le badge de l’app et par le POLLING de ' +
      'repli quand le socket temps réel est indisponible.',
  })
  @ApiResponse({ status: 200, description: '{ unreadCount }' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  unreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ unreadCount: number }> {
    return this.notificationsService.unreadCount(user);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Marquer toutes mes notifications comme lues',
  })
  @ApiResponse({ status: 204, description: 'Notifications marquées comme lues' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.notificationsService.markAllRead(user);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Marquer une notification comme lue (idempotent)',
    description:
      '404 « Notification introuvable » si la notification n’appartient pas ' +
      'à l’utilisateur courant (on ne révèle pas l’existence d’une ' +
      'notification d’autrui).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la notification' })
  @ApiResponse({ status: 204, description: 'Notification marquée comme lue' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 404, description: 'Notification introuvable' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.notificationsService.markRead(user, id);
  }
}

import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminNotificationsService,
  AdminSystemNotificationResult,
} from './admin-notifications.service';
import { CreateSystemNotificationDto } from './dto/create-system-notification.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly service: AdminNotificationsService) {}

  @Post('system')
  @ApiOperation({
    summary: 'Creer une notification systeme',
    description:
      'Outil dev/mock du Lot 1 : envoi a un utilisateur actif ou a tous les ' +
      'comptes actifs, via le meme service que les notifications in-app.',
  })
  @ApiResponse({ status: 201, description: 'Notifications creees' })
  @ApiResponse({ status: 400, description: 'Ciblage invalide' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  create(
    @Body() dto: CreateSystemNotificationDto,
  ): Promise<AdminSystemNotificationResult> {
    return this.service.createSystemNotification(dto);
  }
}

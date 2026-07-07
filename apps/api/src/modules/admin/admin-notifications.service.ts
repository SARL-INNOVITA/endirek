import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { USERS_REPOSITORY } from '../../database/database.tokens';
import { User } from '../../database/domain/entities';
import { UsersRepository } from '../../database/repositories/interfaces';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSystemNotificationDto } from './dto/create-system-notification.dto';

export interface AdminSystemNotificationResult {
  createdCount: number;
  userIds: string[];
}

@Injectable()
export class AdminNotificationsService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createSystemNotification(
    dto: CreateSystemNotificationDto,
  ): Promise<AdminSystemNotificationResult> {
    const broadcast = dto.broadcast === true;
    const userId = dto.userId?.trim();
    if (broadcast === (userId !== undefined && userId !== '')) {
      throw new BadRequestException(
        'Choisissez un destinataire OU un envoi a tous les comptes actifs',
      );
    }

    const targets = broadcast
      ? await this.activeUsers()
      : [await this.singleActiveUser(userId as string)];

    const payload = {
      title: dto.title?.trim() || null,
      message: dto.message.trim(),
      source: 'admin',
      broadcast,
    };

    for (const user of targets) {
      await this.notificationsService.create({
        userId: user.id,
        type: 'system',
        payload,
      });
    }

    return {
      createdCount: targets.length,
      userIds: targets.map((user) => user.id),
    };
  }

  private async singleActiveUser(userId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (user.status !== 'active') {
      throw new BadRequestException(
        'Les notifications systeme ne ciblent que les comptes actifs',
      );
    }
    return user;
  }

  private async activeUsers(): Promise<User[]> {
    const page = await this.usersRepository.list({
      status: 'active',
      limit: Number.MAX_SAFE_INTEGER,
      offset: 0,
    });
    return page.items;
  }
}

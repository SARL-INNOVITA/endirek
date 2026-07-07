import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { NOTIFICATIONS_REPOSITORY } from '../../database/database.tokens';
import {
  Notification,
  NotificationType,
} from '../../database/domain/entities';
import {
  NotificationsRepository,
  PageParams,
} from '../../database/repositories/interfaces';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/** Forme NOTIFICATION du contrat (GET /notifications, event temps réel). */
export interface NotificationView {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

/** Liste paginée de notifications ({ items, total, unreadCount }). */
export interface PagedNotifications {
  items: NotificationView[];
  total: number;
  unreadCount: number;
}

/** Données de création centralisée d'une notification. */
export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  payload?: Record<string, unknown>;
}

/**
 * Service notifications (Lot 1 étape 5) — point d'entrée UNIQUE de la création
 * et de la lecture des notifications in-app.
 *
 * `create` PERSISTE puis ÉMET en temps réel (RealtimeGateway) : tous les
 * producteurs (commentaires, réponses, réactions, traitement de signalement)
 * passent par ici plutôt que par le repository direct — une seule source pour
 * la persistance ET la diffusion. La règle « jamais à soi-même » reste de la
 * responsabilité de l'appelant (il connaît l'émetteur de l'événement).
 *
 * Lecture STRICTEMENT limitée aux notifications du user courant : listByUser /
 * unreadCount filtrent par userId côté repository ; markRead vérifie
 * l'ownership (404 « Notification introuvable » si elle appartient à un autre
 * — ne rien révéler). markAllRead ne touche que les siennes.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly notificationsRepository: NotificationsRepository,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Crée une notification (persistance) PUIS l'émet en temps réel vers la room
   * privée du destinataire, avec son compteur de non-lues à jour. Retourne la
   * notification créée (rarement utile aux appelants, mais cohérent).
   */
  async create(params: CreateNotificationParams): Promise<Notification> {
    const notification = await this.notificationsRepository.create({
      userId: params.userId,
      type: params.type,
      payload: params.payload,
    });
    const unreadCount = await this.notificationsRepository.unreadCount(
      params.userId,
    );
    this.realtime.emitNotification(params.userId, {
      notification: this.toView(notification),
      unreadCount,
    });
    return notification;
  }

  /** Mes notifications, antéchronologiques, paginées (GET /notifications). */
  async listMine(
    viewer: AuthenticatedUser,
    params: PageParams,
  ): Promise<PagedNotifications> {
    const [items, unreadCount, all] = await Promise.all([
      this.notificationsRepository.listByUser(viewer.userId, {
        limit: params.limit,
        offset: params.offset,
      }),
      this.notificationsRepository.unreadCount(viewer.userId),
      // `total` = nombre total de notifications de l'utilisateur. Le mock ne
      // renvoie pas de total paginé pour cette table (volume faible, borné par
      // utilisateur) : on lit une page « large » pour compter. Le driver
      // postgres remplacera par un COUNT(*).
      this.notificationsRepository.listByUser(viewer.userId, {
        limit: Number.MAX_SAFE_INTEGER,
        offset: 0,
      }),
    ]);
    return {
      items: items.map((n) => this.toView(n)),
      total: all.length,
      unreadCount,
    };
  }

  /** Compteur de non-lues (GET /notifications/unread-count). */
  async unreadCount(viewer: AuthenticatedUser): Promise<{ unreadCount: number }> {
    return {
      unreadCount: await this.notificationsRepository.unreadCount(
        viewer.userId,
      ),
    };
  }

  /**
   * Marque une notification comme lue (PATCH /notifications/:id/read) —
   * IDEMPOTENT. Contrôle d'ownership : 404 « Notification introuvable » si
   * elle n'existe pas OU n'appartient pas au user courant (ne pas divulguer
   * l'existence d'une notification d'autrui).
   */
  async markRead(viewer: AuthenticatedUser, id: string): Promise<void> {
    const notification = await this.notificationsRepository.findById(id);
    if (!notification || notification.userId !== viewer.userId) {
      throw new NotFoundException('Notification introuvable');
    }
    await this.notificationsRepository.markRead(id);
  }

  /** Marque toutes MES notifications comme lues (PATCH /notifications/read-all). */
  async markAllRead(viewer: AuthenticatedUser): Promise<void> {
    await this.notificationsRepository.markAllRead(viewer.userId);
  }

  /** Projette une entité Notification vers la forme NOTIFICATION du contrat. */
  private toView(notification: Notification): NotificationView {
    return {
      id: notification.id,
      type: notification.type,
      payload: notification.payload,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}

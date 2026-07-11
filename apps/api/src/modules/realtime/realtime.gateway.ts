import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthConfig } from '../../config/configuration';
import { USERS_REPOSITORY } from '../../database/database.tokens';
import { UsersRepository } from '../../database/repositories/interfaces';

/** Préfixe des rooms par utilisateur (« user:<id> ») — une room privée par
 * compte, cible des événements de notification temps réel. */
const USER_ROOM_PREFIX = 'user:';

/** Room commune de la carte : les clients qui affichent la carte la
 * rejoignent pour recevoir les événements légers « map.updated ». */
const MAP_ROOM = 'map';

/** Payload minimal attendu d'un access token ({ sub } — contrat étape 3). */
interface AccessTokenPayload {
  sub?: string;
}

/**
 * Gateway temps réel (socket.io) sur le NAMESPACE PAR DÉFAUT — canal minimal
 * du Lot 1, PAS de messagerie.
 *
 * Authentification au HANDSHAKE : le client fournit son access token dans
 * `handshake.auth.token` (ou `?token=` en query). La gateway :
 * 1. vérifie la signature/expiration du jeton (secret auth.jwtSecret) ;
 * 2. recharge l'utilisateur et refuse la connexion (disconnect) s'il est
 *    introuvable, supprimé ('deleted') ou suspendu ('suspended') — même
 *    politique que le guard JWT HTTP, sans liste de révocation ;
 * 3. joint la room privée « user:<id> » (notifications) — la carte rejoint
 *    « map » à la demande via l'événement 'map.subscribe'.
 *
 * Émission : NotificationsService pousse 'notification.created' vers la room
 * de l'utilisateur ; la création d'un post visible carte pousse 'map.updated'
 * (voir emitMapUpdated). Aucun message entrant n'est traité au Lot 1 hormis
 * l'abonnement carte.
 *
 * Fallback documenté : si le socket est indisponible (réseau, proxy), le
 * client retombe sur du POLLING (GET /notifications/unread-count) — le temps
 * réel est un CONFORT, jamais une source de vérité.
 *
 * CORS : la politique d'origines (app.corsOrigins) est appliquée au boot par
 * RealtimeIoAdapter (main.ts) — le décorateur, évalué au chargement de la
 * classe, ne peut pas lire la config injectée, on ne fixe donc rien ici.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger('RealtimeGateway');

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  /** Authentifie le handshake, rejette les connexions invalides et joint la
   * room privée de l'utilisateur. */
  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.reject(client, 'Authentification requise');
      return;
    }

    const { jwtSecret } = this.configService.getOrThrow<AuthConfig>('auth');
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: jwtSecret,
      });
    } catch {
      this.reject(client, 'Session invalide ou expirée');
      return;
    }
    if (!payload.sub) {
      this.reject(client, 'Session invalide ou expirée');
      return;
    }

    // Rechargement + revérification du statut (miroir du guard JWT HTTP).
    const user = await this.usersRepository.findById(payload.sub);
    if (!user || user.status !== 'active') {
      this.reject(client, 'Session invalide ou expirée');
      return;
    }

    await client.join(this.userRoom(user.id));
    // L'écran carte s'abonne aux rafraîchissements légers en émettant
    // 'map.subscribe' (rejoint la room commune 'map').
    client.on('map.subscribe', () => {
      void client.join(MAP_ROOM);
    });
    client.on('map.unsubscribe', () => {
      void client.leave(MAP_ROOM);
    });
  }

  /**
   * Pousse une notification vers la room privée de son destinataire.
   * Appelé par NotificationsService.create APRÈS persistance : la
   * notification existe déjà en base, l'émission n'est qu'un confort direct.
   */
  emitNotification(
    userId: string,
    payload: { notification: unknown; unreadCount: number },
  ): void {
    // `server` peut être indéfini si aucune connexion n'a encore été établie
    // (adapter socket.io non initialisé) — on ne casse jamais le flux métier.
    if (!this.server) {
      return;
    }
    this.server
      .to(this.userRoom(userId))
      .emit('notification.created', payload);
  }

  /**
   * Pousse un nouveau message de conversation (CP2.3) vers la room privée de
   * son DESTINATAIRE. Appelé par ConversationsService APRÈS persistance —
   * comme les notifications, l'émission n'est qu'un confort : le REST
   * (GET /conversations/:id/messages, polling du badge) reste la source de
   * vérité.
   */
  emitMessageCreated(
    recipientId: string,
    payload: {
      conversationId: string;
      message: unknown;
      unreadConversations: number;
    },
  ): void {
    if (!this.server) {
      return;
    }
    this.server
      .to(this.userRoom(recipientId))
      .emit('message.created', payload);
  }

  /**
   * Pousse un événement LÉGER de rafraîchissement d'un deal (CP2.4) vers la
   * room privée d'un participant : le client qui affiche la page du deal la
   * recharge via GET /deals/:id. Émis APRÈS persistance, jamais une source
   * de vérité.
   */
  emitDealUpdated(userId: string, payload: { dealId: string }): void {
    if (!this.server) {
      return;
    }
    this.server.to(this.userRoom(userId)).emit('deal.updated', payload);
  }

  /**
   * Diffuse un événement LÉGER de rafraîchissement carte (le client recharge
   * ses marqueurs via GET /map/overview). Émis à la room 'map' pour ne
   * déranger que les clients qui affichent la carte.
   */
  emitMapUpdated(reason: 'post.created'): void {
    if (!this.server) {
      return;
    }
    this.server.to(MAP_ROOM).emit('map.updated', { reason });
  }

  /** Room privée d'un utilisateur. */
  private userRoom(userId: string): string {
    return `${USER_ROOM_PREFIX}${userId}`;
  }

  /** Extrait le token du handshake (auth.token prioritaire, puis query). */
  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      return queryToken;
    }
    return null;
  }

  /** Notifie l'erreur au client puis coupe la connexion. */
  private reject(client: Socket, message: string): void {
    client.emit('error', { message });
    client.disconnect(true);
  }
}

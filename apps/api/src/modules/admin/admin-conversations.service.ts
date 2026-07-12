import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PostAuthor, toPostAuthor } from '../../common/mappers/post.mapper';
import {
  CONVERSATIONS_REPOSITORY,
  LISTINGS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import {
  Conversation,
  Message,
  MessageStatus,
} from '../../database/domain/entities';
import {
  ConversationsRepository,
  ListingsRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { AdminListConversationsQueryDto } from './dto/admin-list-conversations-query.dto';
import { UpdateMessageStatusDto } from './dto/update-message-status.dto';

/** Référence légère de l'annonce d'une conversation (backoffice). */
export interface AdminConversationListingRef {
  id: string;
  title: string;
  urlSlug: string;
  status: string;
}

/** Message vu du BACKOFFICE (CP2.5 — D67) : le corps est TOUJOURS le corps
 * RÉEL (les modérateurs doivent lire le contenu pour statuer), contrairement
 * à la forme MESSAGE des participants dont le corps masqué est remplacé. */
export interface AdminMessageView {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  status: MessageStatus;
  createdAt: Date;
}

/** Carte CONVERSATION du backoffice : les DEUX participants nommés. */
export interface AdminConversationCard {
  id: string;
  listing: AdminConversationListingRef;
  initiator: PostAuthor;
  owner: PostAuthor;
  /** Dernier message (corps réel) ou null (jamais le cas en pratique :
   * pas de fil vide — D63). */
  lastMessage: AdminMessageView | null;
  lastMessageAt: Date | null;
  createdAt: Date;
}

/** Liste backoffice paginée de conversations. */
export interface PagedAdminConversationCards {
  items: AdminConversationCard[];
  total: number;
}

/** Page de messages d'un fil, vue backoffice (du plus récent au plus ancien). */
export interface PagedAdminMessages {
  items: AdminMessageView[];
  total: number;
}

/**
 * Service conversations du backoffice (CP2.5 — D67) — réservé aux rôles
 * moderator et super_admin (RolesGuard sur le contrôleur).
 *
 * - la liste couvre TOUTES les conversations (tri par activité décroissante,
 *   comme la liste des participants), recherche par participant ou annonce ;
 * - les corps de messages sont servis EN CLAIR (y compris masqués) : la
 *   modération doit lire le contenu pour statuer ;
 * - masquer un message est un SOFT (status 'hidden', réversible) : le
 *   message reste dans le fil, son corps est remplacé pour les participants
 *   par le service conversations. Pas de suppression (D63).
 */
@Injectable()
export class AdminConversationsService {
  constructor(
    @Inject(CONVERSATIONS_REPOSITORY)
    private readonly conversationsRepository: ConversationsRepository,
    @Inject(LISTINGS_REPOSITORY)
    private readonly listingsRepository: ListingsRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  /** Liste backoffice paginée (GET /admin/dealplace/conversations). */
  async listConversations(
    query: AdminListConversationsQueryDto,
  ): Promise<PagedAdminConversationCards> {
    const page = await this.conversationsRepository.listAdmin({
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
    return {
      items: await this.assembleCards(page.items),
      total: page.total,
    };
  }

  /** Messages d'un fil, corps RÉELS (GET .../conversations/:id/messages) —
   * du plus récent au plus ancien, 404 si le fil n'existe pas. */
  async listMessages(
    conversationId: string,
    params: { limit: number; offset: number },
  ): Promise<PagedAdminMessages> {
    const conversation =
      await this.conversationsRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }
    const page = await this.conversationsRepository.listMessages(
      conversationId,
      params,
    );
    return {
      items: page.items.map((m) => this.toAdminMessageView(m)),
      total: page.total,
    };
  }

  /** Masque ou réactive un message (PATCH /admin/dealplace/messages/:id/status).
   * Idempotent — 404 si le message n'existe pas. */
  async updateMessageStatus(
    id: string,
    dto: UpdateMessageStatusDto,
  ): Promise<AdminMessageView> {
    const message = await this.conversationsRepository.findMessageById(id);
    if (!message) {
      throw new NotFoundException('Message introuvable');
    }
    const updated = await this.conversationsRepository.setMessageStatus(
      id,
      dto.status,
    );
    return this.toAdminMessageView(updated);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Cartes backoffice : annonces, participants et derniers messages chargés
   * PAR LOT (anti N+1). */
  private async assembleCards(
    conversations: Conversation[],
  ): Promise<AdminConversationCard[]> {
    if (conversations.length === 0) {
      return [];
    }
    const listingIds = [...new Set(conversations.map((c) => c.listingId))];
    const participantIds = [
      ...new Set(conversations.flatMap((c) => [c.initiatorId, c.ownerId])),
    ];
    const conversationIds = conversations.map((c) => c.id);
    const [listings, participants, lastMessages] = await Promise.all([
      this.listingsRepository.findByIds(listingIds),
      this.usersRepository.findByIds(participantIds),
      this.conversationsRepository.lastMessagesByConversationIds(
        conversationIds,
      ),
    ]);
    const listingsById = new Map(listings.map((l) => [l.id, l]));
    const participantsById = new Map(participants.map((u) => [u.id, u]));

    return conversations.map((conversation) => {
      const listing = listingsById.get(conversation.listingId) ?? null;
      const last = lastMessages[conversation.id] ?? null;
      return {
        id: conversation.id,
        listing: listing
          ? {
              id: listing.id,
              title: listing.title,
              urlSlug: listing.urlSlug,
              status: listing.status,
            }
          : {
              id: conversation.listingId,
              title: 'Annonce supprimée',
              urlSlug: '',
              status: 'deleted',
            },
        initiator: toPostAuthor(
          conversation.initiatorId,
          participantsById.get(conversation.initiatorId) ?? null,
        ),
        owner: toPostAuthor(
          conversation.ownerId,
          participantsById.get(conversation.ownerId) ?? null,
        ),
        lastMessage: last ? this.toAdminMessageView(last) : null,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
      };
    });
  }

  /** Forme MESSAGE backoffice — corps RÉEL, jamais remplacé (D67). */
  private toAdminMessageView(message: Message): AdminMessageView {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      status: message.status,
      createdAt: message.createdAt,
    };
  }
}

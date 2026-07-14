import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PostAuthor, toPostAuthor } from '../../common/mappers/post.mapper';
import {
  CONVERSATIONS_REPOSITORY,
  LISTINGS_REPOSITORY,
  PAGES_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import {
  Conversation,
  Listing,
  Message,
  MessageStatus,
  Page,
  PageType,
} from '../../database/domain/entities';
import {
  ConversationsRepository,
  ListingsRepository,
  PageParams,
  PagesRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SendMessageDto } from './dto/send-message.dto';
import { StartConversationDto } from './dto/start-conversation.dto';

/** Référence LÉGÈRE de l'annonce d'une conversation (en-tête de fil, carte de
 * liste) — pas la forme LISTING_CARD complète : juste de quoi afficher et
 * naviguer. `status` permet au client de griser une annonce disparue. */
export interface ConversationListingRef {
  id: string;
  title: string;
  urlSlug: string;
  status: string;
  /** Vignette (thumbnail du 1er média) ou null. */
  coverThumbnailUrl: string | null;
}

/** Forme MESSAGE du contrat (liste, envoi, event temps réel). Un message
 * masqué par la modération (CP2.5 — D67) sort avec status 'hidden' et un
 * corps REMPLACÉ (« Message masqué par la modération. ») : le contenu réel
 * n'atteint jamais les participants. */
export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  status: MessageStatus;
  createdAt: Date;
}

/** Corps substitué aux messages masqués pour les participants (D67). */
export const HIDDEN_MESSAGE_BODY = 'Message masqué par la modération.';

/** Référence LÉGÈRE de la page d'une conversation (Lot 3 — D75) : bandeau du
 * fil « Message » d'une page. `status` permet au client de griser une page
 * disparue (miroir de ConversationListingRef). */
export interface ConversationPageRef {
  id: string;
  name: string;
  urlSlug: string;
  pageType: PageType;
  avatarUrl: string | null;
  status: string;
}

/** Forme CONVERSATION du contrat — carte de la liste ET en-tête du fil.
 * Exactement UNE cible non nulle : `listing` (fil d'annonce — D63) ou
 * `page` (fil de page — Lot 3, D75). */
export interface ConversationView {
  id: string;
  listing: ConversationListingRef | null;
  /** Page liée (Lot 3 — D75) — null pour un fil d'annonce. */
  page: ConversationPageRef | null;
  /** L'AUTRE participant (forme AUTEUR publique — jamais d'email). */
  otherParticipant: PostAuthor;
  lastMessage: MessageView | null;
  /** Mes messages non lus dans CE fil. */
  unreadCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
}

/** Liste paginée de conversations (+ badge global). */
export interface PagedConversations {
  items: ConversationView[];
  total: number;
  /** Nombre de MES conversations avec au moins un non-lu (badge header). */
  unreadConversations: number;
}

/** Page de messages d'un fil (du plus récent au plus ancien). */
export interface PagedMessages {
  items: MessageView[];
  total: number;
}

/**
 * Service conversations 1-to-1 (Lot 2 — CP2.3) — messagerie privée LIÉE À UNE
 * ANNONCE (décision D63) OU À UNE PAGE (Lot 3 — décision D75).
 *
 * Règles métier appliquées ICI :
 * - démarrage : exactement UNE cible (listingId XOR pageId — 400 sinon) ;
 *   cible VISIBLE par l'appelant (active — hidden/deleted → 404 comme le
 *   détail public), jamais sur SA PROPRE annonce/page (400) ;
 *   get-or-create sur (cible, initiateur) + PREMIER message obligatoire ;
 * - accès à un fil STRICTEMENT réservé à ses deux participants (404 sinon —
 *   ne rien divulguer, miroir des notifications) ;
 * - messages texte 1-2000 caractères (trim au DTO) ;
 * - PAS de ligne de notification in-app par message (anti-flood, D63) : le
 *   badge messagerie est alimenté par countUnreadConversations + l'événement
 *   socket 'message.created' émis au DESTINATAIRE après persistance.
 */
@Injectable()
export class ConversationsService {
  constructor(
    @Inject(CONVERSATIONS_REPOSITORY)
    private readonly conversationsRepository: ConversationsRepository,
    @Inject(LISTINGS_REPOSITORY)
    private readonly listingsRepository: ListingsRepository,
    @Inject(PAGES_REPOSITORY)
    private readonly pagesRepository: PagesRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Démarrage / liste / détail
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Démarre (ou reprend) la conversation de l'appelant sur une annonce OU une
   * page (exactement une cible — D75) et envoie le PREMIER message
   * (POST /conversations). Get-or-create : si le fil existe déjà, le message
   * y est simplement ajouté.
   */
  async start(
    viewer: AuthenticatedUser,
    dto: StartConversationDto,
  ): Promise<{ conversation: ConversationView; message: MessageView }> {
    const hasListing = dto.listingId !== undefined;
    const hasPage = dto.pageId !== undefined;
    if (hasListing === hasPage) {
      throw new BadRequestException(
        'Indiquez une annonce (listingId) ou une page (pageId) — exactement une des deux',
      );
    }

    let conversation: Conversation | null;
    let ownerId: string;
    if (hasListing) {
      const listing = await this.listingsRepository.findById(
        dto.listingId as string,
      );
      // Miroir de la visibilité publique du détail : hidden/deleted → 404.
      if (!listing || listing.status !== 'active') {
        throw new NotFoundException('Annonce introuvable');
      }
      if (listing.ownerId === viewer.userId) {
        throw new BadRequestException(
          'Vous ne pouvez pas ouvrir une conversation sur votre propre annonce',
        );
      }
      ownerId = listing.ownerId;
      conversation =
        await this.conversationsRepository.findByListingAndInitiator(
          dto.listingId as string,
          viewer.userId,
        );
    } else {
      const page = await this.pagesRepository.findById(dto.pageId as string);
      // Miroir de la visibilité publique de la page : hidden/deleted → 404.
      if (!page || page.status !== 'active') {
        throw new NotFoundException('Page introuvable');
      }
      if (page.ownerId === viewer.userId) {
        throw new BadRequestException(
          'Vous ne pouvez pas ouvrir une conversation avec votre propre page',
        );
      }
      ownerId = page.ownerId;
      conversation = await this.conversationsRepository.findByPageAndInitiator(
        dto.pageId as string,
        viewer.userId,
      );
    }
    if (!conversation) {
      conversation = await this.conversationsRepository.create({
        listingId: dto.listingId ?? null,
        pageId: dto.pageId ?? null,
        initiatorId: viewer.userId,
        ownerId,
      });
    }

    const message = await this.sendInConversation(
      conversation,
      viewer.userId,
      dto.body,
    );
    return {
      conversation: await this.assembleOne(conversation.id, viewer.userId),
      message,
    };
  }

  /** Mes conversations, triées par activité (GET /conversations). */
  async listMine(
    viewer: AuthenticatedUser,
    params: PageParams,
  ): Promise<PagedConversations> {
    const [page, unreadConversations] = await Promise.all([
      this.conversationsRepository.listByParticipant(viewer.userId, params),
      this.conversationsRepository.countUnreadConversations(viewer.userId),
    ]);
    return {
      items: await this.assemble(page.items, viewer.userId),
      total: page.total,
      unreadConversations,
    };
  }

  /** Badge messagerie (GET /conversations/unread-count). */
  async unreadCount(
    viewer: AuthenticatedUser,
  ): Promise<{ unreadConversations: number }> {
    return {
      unreadConversations:
        await this.conversationsRepository.countUnreadConversations(
          viewer.userId,
        ),
    };
  }

  /** Ma conversation existante sur une annonce (GET /conversations/listing/:id)
   * — 404 si je n'en ai pas encore ouvert (le mobile sait alors proposer un
   * premier message). */
  async findMineForListing(
    viewer: AuthenticatedUser,
    listingId: string,
  ): Promise<ConversationView> {
    const conversation =
      await this.conversationsRepository.findByListingAndInitiator(
        listingId,
        viewer.userId,
      );
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }
    return this.assembleOne(conversation.id, viewer.userId);
  }

  /** Ma conversation existante avec une page (GET /conversations/page/:id) —
   * 404 si je n'en ai pas encore ouvert (Lot 3 — D75, miroir du fil
   * d'annonce). */
  async findMineForPage(
    viewer: AuthenticatedUser,
    pageId: string,
  ): Promise<ConversationView> {
    const conversation =
      await this.conversationsRepository.findByPageAndInitiator(
        pageId,
        viewer.userId,
      );
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }
    return this.assembleOne(conversation.id, viewer.userId);
  }

  /** Détail d'un fil (GET /conversations/:id) — participants uniquement. */
  async getById(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<ConversationView> {
    await this.loadOwnConversation(viewer, id);
    return this.assembleOne(id, viewer.userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Messages
  // ──────────────────────────────────────────────────────────────────────────

  /** Messages d'un fil, du plus récent au plus ancien
   * (GET /conversations/:id/messages) — participants uniquement. */
  async listMessages(
    viewer: AuthenticatedUser,
    id: string,
    params: PageParams,
  ): Promise<PagedMessages> {
    await this.loadOwnConversation(viewer, id);
    const page = await this.conversationsRepository.listMessages(id, params);
    return {
      items: page.items.map((m) => this.toMessageView(m)),
      total: page.total,
    };
  }

  /** Envoie un message dans un fil existant
   * (POST /conversations/:id/messages) — participants uniquement. */
  async sendMessage(
    viewer: AuthenticatedUser,
    id: string,
    dto: SendMessageDto,
  ): Promise<MessageView> {
    const conversation = await this.loadOwnConversation(viewer, id);
    return this.sendInConversation(conversation, viewer.userId, dto.body);
  }

  /** Marque le fil comme LU pour l'appelant (PATCH /conversations/:id/read) —
   * idempotent ; retourne le badge global à jour (resynchronisation client). */
  async markRead(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<{ unreadConversations: number }> {
    await this.loadOwnConversation(viewer, id);
    await this.conversationsRepository.markRead(id, viewer.userId, new Date());
    return this.unreadCount(viewer);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Persiste un message puis l'émet au DESTINATAIRE (room user:<id>) avec son
   * badge à jour — même séquence que NotificationsService.create. */
  private async sendInConversation(
    conversation: Conversation,
    senderId: string,
    body: string,
  ): Promise<MessageView> {
    const message = await this.conversationsRepository.createMessage({
      conversationId: conversation.id,
      senderId,
      body,
    });
    const recipientId =
      conversation.initiatorId === senderId
        ? conversation.ownerId
        : conversation.initiatorId;
    const { unreadConversations } = {
      unreadConversations:
        await this.conversationsRepository.countUnreadConversations(
          recipientId,
        ),
    };
    const view = this.toMessageView(message);
    this.realtime.emitMessageCreated(recipientId, {
      conversationId: conversation.id,
      message: view,
      unreadConversations,
    });
    return view;
  }

  /** Charge un fil pour l'appelant : 404 s'il n'existe pas OU si l'appelant
   * n'en est pas participant (ne rien divulguer — miroir notifications). */
  private async loadOwnConversation(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findById(id);
    if (
      !conversation ||
      (conversation.initiatorId !== viewer.userId &&
        conversation.ownerId !== viewer.userId)
    ) {
      throw new NotFoundException('Conversation introuvable');
    }
    return conversation;
  }

  /** Assemble UNE conversation (relue pour refléter lastMessageAt à jour). */
  private async assembleOne(
    id: string,
    viewerId: string,
  ): Promise<ConversationView> {
    const conversation = await this.conversationsRepository.findById(id);
    const [assembled] = await this.assemble(
      [conversation as Conversation],
      viewerId,
    );
    return assembled;
  }

  /**
   * Assemble une PAGE de conversations vers la forme CONVERSATION — tout est
   * chargé PAR LOT (annonces, vignettes, interlocuteurs, derniers messages,
   * non-lus) : jamais de N+1 par fil.
   */
  private async assemble(
    conversations: Conversation[],
    viewerId: string,
  ): Promise<ConversationView[]> {
    if (conversations.length === 0) {
      return [];
    }
    const conversationIds = conversations.map((c) => c.id);
    const listingIds = [
      ...new Set(
        conversations
          .map((c) => c.listingId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const pageIds = [
      ...new Set(
        conversations
          .map((c) => c.pageId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const otherIds = [
      ...new Set(
        conversations.map((c) =>
          c.initiatorId === viewerId ? c.ownerId : c.initiatorId,
        ),
      ),
    ];

    const [listings, media, pages, others, lastMessages, unreadCounts] =
      await Promise.all([
        this.listingsRepository.findByIds(listingIds),
        this.listingsRepository.listMediaByListingIds(listingIds),
        this.pagesRepository.findByIds(pageIds),
        this.usersRepository.findByIds(otherIds),
        this.conversationsRepository.lastMessagesByConversationIds(
          conversationIds,
        ),
        this.conversationsRepository.unreadCountsByConversationIds(
          conversationIds,
          viewerId,
        ),
      ]);

    const listingsById = new Map(listings.map((l) => [l.id, l]));
    const pagesById = new Map(pages.map((pa) => [pa.id, pa]));
    const othersById = new Map(others.map((u) => [u.id, u]));
    // Vignette = thumbnail (sinon url) du 1er média de chaque annonce (les
    // médias arrivent triés par position croissante).
    const coverByListing = new Map<string, string>();
    for (const m of media) {
      if (!coverByListing.has(m.listingId)) {
        coverByListing.set(m.listingId, m.thumbnailUrl ?? m.url);
      }
    }

    return conversations.map((conversation) => {
      const otherId =
        conversation.initiatorId === viewerId
          ? conversation.ownerId
          : conversation.initiatorId;
      const last = lastMessages[conversation.id];
      return {
        id: conversation.id,
        listing:
          conversation.listingId === null
            ? null
            : this.toListingRef(
                conversation.listingId,
                listingsById.get(conversation.listingId),
                coverByListing.get(conversation.listingId) ?? null,
              ),
        page:
          conversation.pageId === null
            ? null
            : this.toPageRef(
                conversation.pageId,
                pagesById.get(conversation.pageId),
              ),
        otherParticipant: toPostAuthor(otherId, othersById.get(otherId) ?? null),
        lastMessage: last ? this.toMessageView(last) : null,
        unreadCount: unreadCounts[conversation.id] ?? 0,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
      };
    });
  }

  /** Référence légère d'annonce — repli neutre si l'annonce a disparu
   * (soft-delete : le fil reste consultable). */
  private toListingRef(
    listingId: string,
    listing: Listing | undefined,
    coverThumbnailUrl: string | null,
  ): ConversationListingRef {
    if (!listing) {
      return {
        id: listingId,
        title: 'Annonce supprimée',
        urlSlug: '',
        status: 'deleted',
        coverThumbnailUrl: null,
      };
    }
    return {
      id: listing.id,
      title: listing.title,
      urlSlug: listing.urlSlug,
      status: listing.status,
      coverThumbnailUrl,
    };
  }

  /** Référence légère de page — repli neutre si la page a disparu
   * (soft-delete : le fil reste consultable, miroir de toListingRef). */
  private toPageRef(
    pageId: string,
    page: Page | undefined,
  ): ConversationPageRef {
    if (!page) {
      return {
        id: pageId,
        name: 'Page supprimée',
        urlSlug: '',
        pageType: 'business',
        avatarUrl: null,
        status: 'deleted',
      };
    }
    return {
      id: page.id,
      name: page.name,
      urlSlug: page.urlSlug,
      pageType: page.pageType,
      avatarUrl: page.avatarUrl,
      status: page.status,
    };
  }

  private toMessageView(message: Message): MessageView {
    // D67 : le corps d'un message masqué est REMPLACÉ côté serveur — le
    // contenu modéré n'atteint jamais les participants (le backoffice, lui,
    // lit le corps réel via le repository).
    const hidden = message.status === 'hidden';
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: hidden ? HIDDEN_MESSAGE_BODY : message.body,
      status: message.status,
      createdAt: message.createdAt,
    };
  }
}

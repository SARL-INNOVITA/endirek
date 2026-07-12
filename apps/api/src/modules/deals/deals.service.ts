import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PostAuthor, toPostAuthor } from '../../common/mappers/post.mapper';
import {
  CONVERSATIONS_REPOSITORY,
  DEALS_REPOSITORY,
  LISTINGS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import {
  Deal,
  DealAdjustment,
  DealAdjustmentAddPayload,
  DealAdjustmentModifyPayload,
  DealDisputeResolution,
  DealItem,
  DealItemStep,
  DealNote,
  DealReview,
  DealStatus,
} from '../../database/domain/entities';
import {
  AdminListDealsParams,
  ConversationsRepository,
  CreateDealItemSpec,
  DealsRepository,
  ListingsRepository,
  PageParams,
  UpdateDealPatch,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DealItemDto, ProposeDealDto } from './dto/propose-deal.dto';
import { ProposeAdjustmentDto } from './dto/propose-adjustment.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';

/** Étape du stepper 5 positions du mockup 07 — DÉRIVÉE, jamais stockée. */
export type DealStage =
  | 'discussion'
  | 'agreement'
  | 'in_progress'
  | 'validations'
  | 'concluded'
  | 'closed';

/** Badge d'un élément — DÉRIVÉ de ses sous-éléments (mockup 07). */
export type DealItemBadge =
  | 'to_provide'
  | 'partial'
  | 'awaiting_validation'
  | 'honored';

/** Forme STEP du contrat. */
export interface DealStepView {
  id: string;
  label: string;
  position: number;
  honoredAt: Date | null;
  validatedAt: Date | null;
}

/** Forme ITEM du contrat (badge dérivé + sous-éléments). */
export interface DealItemView {
  id: string;
  providerId: string;
  kind: string;
  title: string;
  description: string;
  value: number;
  position: number;
  badge: DealItemBadge;
  steps: DealStepView[];
}

/** Forme AJUSTEMENT du contrat. */
export interface DealAdjustmentView {
  id: string;
  proposedBy: string;
  kind: string;
  itemId: string | null;
  payload: Record<string, unknown>;
  description: string;
  status: string;
  decidedAt: Date | null;
  createdAt: Date;
}

/** Forme NOTE du contrat (timeline « Suivi du deal »). */
export interface DealNoteView {
  id: string;
  author: PostAuthor;
  body: string;
  createdAt: Date;
}

/** Forme AVIS du contrat (note globale = moyenne des 3 critères). */
export interface DealReviewView {
  id: string;
  reviewer: PostAuthor;
  revieweeId: string;
  ratingHonesty: number;
  ratingConformity: number;
  ratingKindness: number;
  overall: number;
  comment: string | null;
  createdAt: Date;
}

/** Référence légère de l'annonce du deal. */
export interface DealListingRef {
  id: string;
  title: string;
  urlSlug: string;
  status: string;
}

/** Forme DEAL_CARD (liste « Mes deals », profil). */
export interface DealCardView {
  id: string;
  dealNumber: number;
  status: DealStatus;
  stage: DealStage;
  otherParticipant: PostAuthor;
  listing: DealListingRef;
  /** Résumés « j'offre ⇄ il offre » (premiers titres de chaque côté). */
  myOfferSummary: string;
  theirOfferSummary: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

/** Forme DEAL complète (page de deal — mockup 07). */
export interface DealView {
  id: string;
  dealNumber: number;
  status: DealStatus;
  stage: DealStage;
  listing: DealListingRef;
  conversationId: string | null;
  proposerId: string;
  recipientId: string;
  otherParticipant: PostAuthor;
  dueDate: Date | null;
  cancellationRequestedBy: string | null;
  disputedBy: string | null;
  disputeReason: string | null;
  /** Issue de l'arbitrage du litige (CP2.5 — D66), null tant que non tranché.
   * L'IDENTITÉ du modérateur n'est jamais exposée aux parties (seuls l'issue,
   * la note de décision et la date le sont). */
  disputeResolution: DealDisputeResolution | null;
  disputeResolutionNote: string | null;
  disputeResolvedAt: Date | null;
  items: DealItemView[];
  adjustments: DealAdjustmentView[];
  notes: DealNoteView[];
  reviews: DealReviewView[];
  /** L'appelant a-t-il déjà déposé son avis (deal conclu) ? */
  myReviewSubmitted: boolean;
  acceptedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Carte DEAL du BACKOFFICE (CP2.5 — D66) : les DEUX parties nommées (la
 * forme n'est pas viewer-centrique, contrairement à DealCardView). */
export interface AdminDealCardView {
  id: string;
  dealNumber: number;
  status: DealStatus;
  stage: DealStage;
  listing: DealListingRef;
  proposer: PostAuthor;
  recipient: PostAuthor;
  /** Résumés « ce que fournit chaque partie » (premiers titres). */
  proposerOfferSummary: string;
  recipientOfferSummary: string;
  disputedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

/** Liste paginée de cartes deal backoffice. */
export interface PagedAdminDealCards {
  items: AdminDealCardView[];
  total: number;
}

/** Page DEAL complète du BACKOFFICE (CP2.5 — D66) : les deux parties, le
 * litige et son éventuel arbitrage (y compris l'identité du modérateur —
 * jamais exposée aux parties). */
export interface AdminDealView {
  id: string;
  dealNumber: number;
  status: DealStatus;
  stage: DealStage;
  listing: DealListingRef;
  conversationId: string | null;
  proposer: PostAuthor;
  recipient: PostAuthor;
  dueDate: Date | null;
  cancellationRequestedBy: string | null;
  disputedBy: string | null;
  disputeReason: string | null;
  disputeResolvedBy: string | null;
  disputeResolvedAt: Date | null;
  disputeResolution: DealDisputeResolution | null;
  disputeResolutionNote: string | null;
  items: DealItemView[];
  adjustments: DealAdjustmentView[];
  notes: DealNoteView[];
  reviews: DealReviewView[];
  acceptedAt: Date | null;
  completedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Profil Dealplace public (mockup 05 — active les placeholders du CP2.2). */
export interface DealProfileView {
  dealsCompleted: number;
  reviews: {
    count: number;
    avgHonesty: number | null;
    avgConformity: number | null;
    avgKindness: number | null;
    /** Moyenne des trois critères (2 décimales), null sans avis. */
    overall: number | null;
    latest: DealReviewView[];
  };
  /** Deals conclus (les plus récents) : résumés d'échange. */
  concludedDeals: Array<{
    dealNumber: number;
    offeredByUser: string;
    receivedByUser: string;
    completedAt: Date | null;
  }>;
}

/**
 * Service deals contractuels (Lot 2 — CP2.4, décision D64).
 *
 * MACHINE À ÉTATS (le repository ne la connaît pas) :
 * - proposition : annonce 'active', jamais avec soi-même, UN SEUL deal ouvert
 *   (proposed|active) par (annonce, paire) — 409 sinon ; chaque élément a un
 *   fournisseur ∈ {proposeur, destinataire} et AU MOINS un sous-élément (step
 *   automatique portant le titre sinon) ; conversation liée créée si absente
 *   (avec message automatique du proposeur — D63 : pas de fil vide) ;
 * - accept/decline : DESTINATAIRE uniquement ; retrait : PROPOSEUR (proposed) ;
 * - édition des éléments : PROPOSEUR, phase 'proposed' uniquement (l'accord
 *   FIGE la proposition — ensuite tout passe par les ajustements) ;
 * - honorer un step : son FOURNISSEUR ; valider : la CONTREPARTIE (et
 *   seulement si honoré) — quand TOUT est validé le deal passe à 'completed'
 *   AUTOMATIQUEMENT ;
 * - ajustements ('active') : proposés par l'un, décidés par L'AUTRE ;
 *   acceptés → payload APPLIQUÉ (add/modify/remove d'élément) ;
 * - annulation amiable EN DEUX TEMPS ; litige unilatéral (terminal CP2.4) ;
 * - avis : deal 'completed', un par partie, non modifiable.
 *
 * NOTIFICATIONS in-app type 'deal' sur les JALONS uniquement (proposition,
 * acceptation, refus, annulation demandée/confirmée, litige, conclusion,
 * avis reçu) — pas de notif par step/note/ajustement (anti-flood) ; l'event
 * socket `deal.updated` rafraîchit la page ouverte de la contrepartie.
 */
@Injectable()
export class DealsService {
  constructor(
    @Inject(DEALS_REPOSITORY)
    private readonly dealsRepository: DealsRepository,
    @Inject(LISTINGS_REPOSITORY)
    private readonly listingsRepository: ListingsRepository,
    @Inject(CONVERSATIONS_REPOSITORY)
    private readonly conversationsRepository: ConversationsRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Proposition / liste / détail
  // ──────────────────────────────────────────────────────────────────────────

  /** Propose un deal (POST /deals). */
  async propose(
    viewer: AuthenticatedUser,
    dto: ProposeDealDto,
  ): Promise<DealView> {
    const listing = await this.listingsRepository.findById(dto.listingId);
    if (!listing || listing.status !== 'active') {
      throw new NotFoundException('Annonce introuvable');
    }
    // Contrepartie : le propriétaire de l'annonce par défaut ; si JE suis le
    // propriétaire, recipientId est obligatoire (je propose à un contact).
    let recipientId: string;
    if (listing.ownerId === viewer.userId) {
      if (!dto.recipientId) {
        throw new BadRequestException(
          'recipientId est obligatoire pour proposer un deal sur sa propre annonce',
        );
      }
      recipientId = dto.recipientId;
    } else {
      recipientId = dto.recipientId ?? listing.ownerId;
    }
    if (recipientId === viewer.userId) {
      throw new BadRequestException(
        'Vous ne pouvez pas proposer un deal à vous-même',
      );
    }
    const recipient = await this.usersRepository.findById(recipientId);
    if (!recipient || recipient.status !== 'active') {
      throw new NotFoundException('Utilisateur introuvable');
    }
    // Un seul deal OUVERT par (annonce, paire) — dans les deux sens.
    const open = await this.dealsRepository.findOpenBetween(
      dto.listingId,
      viewer.userId,
      recipientId,
    );
    if (open) {
      throw new ConflictException(
        `Un deal est déjà ouvert sur cette annonce avec ce partenaire (Deal ${open.dealNumber})`,
      );
    }

    const items = this.toItemSpecs(viewer.userId, recipientId, dto.items);

    // Conversation liée : celle du demandeur (l'initiateur du fil est celui
    // des deux qui N'EST PAS propriétaire de l'annonce) — créée avec un
    // message automatique du proposeur si absente (D63 : pas de fil vide).
    const initiatorId =
      listing.ownerId === viewer.userId ? recipientId : viewer.userId;
    let conversation =
      await this.conversationsRepository.findByListingAndInitiator(
        dto.listingId,
        initiatorId,
      );
    if (!conversation) {
      conversation = await this.conversationsRepository.create({
        listingId: dto.listingId,
        initiatorId,
        ownerId: listing.ownerId,
      });
      await this.conversationsRepository.createMessage({
        conversationId: conversation.id,
        senderId: viewer.userId,
        body: `Je vous ai proposé un deal sur « ${listing.title} » — retrouvez le détail dans la page du deal.`,
      });
    }

    const deal = await this.dealsRepository.create({
      listingId: dto.listingId,
      conversationId: conversation.id,
      proposerId: viewer.userId,
      recipientId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      items,
    });

    await this.notifyDeal(deal, recipientId, viewer.userId, {
      event: 'proposed',
      title: `Nouvelle proposition de deal (Deal ${deal.dealNumber})`,
      message: `Une proposition de deal vous attend sur « ${listing.title} ».`,
    });
    return this.assembleOne(deal.id, viewer.userId);
  }

  /** Mes deals (GET /deals), triés par activité. */
  async listMine(
    viewer: AuthenticatedUser,
    params: PageParams & { status?: DealStatus },
  ): Promise<{ items: DealCardView[]; total: number }> {
    const page = await this.dealsRepository.listByParticipant(viewer.userId, {
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    });
    return {
      items: await this.assembleCards(page.items, viewer.userId),
      total: page.total,
    };
  }

  /** Deal OUVERT lié à une conversation (bandeau du fil — GET
   * /deals/conversation/:conversationId, 404 si aucun). */
  async findOpenForConversation(
    viewer: AuthenticatedUser,
    conversationId: string,
  ): Promise<DealCardView> {
    const deal = await this.dealsRepository.findOpenByConversation(
      conversationId,
    );
    if (
      !deal ||
      (deal.proposerId !== viewer.userId && deal.recipientId !== viewer.userId)
    ) {
      throw new NotFoundException('Deal introuvable');
    }
    const [card] = await this.assembleCards([deal], viewer.userId);
    return card;
  }

  /** Page de deal (GET /deals/:id) — participants uniquement. */
  async getById(viewer: AuthenticatedUser, id: string): Promise<DealView> {
    await this.loadOwnDeal(viewer, id);
    return this.assembleOne(id, viewer.userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Transitions de la proposition
  // ──────────────────────────────────────────────────────────────────────────

  /** Accepte la proposition (DESTINATAIRE) → 'active'. */
  async accept(viewer: AuthenticatedUser, id: string): Promise<DealView> {
    const deal = await this.loadOwnDeal(viewer, id);
    this.assertStatus(deal, 'proposed');
    if (deal.recipientId !== viewer.userId) {
      throw new ForbiddenException(
        'Seul le destinataire de la proposition peut l’accepter',
      );
    }
    const updated = await this.dealsRepository.update(id, {
      status: 'active',
      acceptedAt: new Date(),
    });
    await this.notifyDeal(updated, deal.proposerId, viewer.userId, {
      event: 'accepted',
      title: `Deal ${deal.dealNumber} accepté`,
      message: 'Votre proposition a été acceptée — le deal est en cours !',
    });
    return this.assembleOne(id, viewer.userId);
  }

  /** Refuse la proposition (DESTINATAIRE) → 'declined' (terminal). */
  async decline(viewer: AuthenticatedUser, id: string): Promise<DealView> {
    const deal = await this.loadOwnDeal(viewer, id);
    this.assertStatus(deal, 'proposed');
    if (deal.recipientId !== viewer.userId) {
      throw new ForbiddenException(
        'Seul le destinataire de la proposition peut la refuser',
      );
    }
    const updated = await this.dealsRepository.update(id, {
      status: 'declined',
      closedAt: new Date(),
    });
    await this.notifyDeal(updated, deal.proposerId, viewer.userId, {
      event: 'declined',
      title: `Deal ${deal.dealNumber} refusé`,
      message: 'Votre proposition de deal a été refusée.',
    });
    return this.assembleOne(id, viewer.userId);
  }

  /** Retire la proposition (PROPOSEUR, phase 'proposed') → 'cancelled'. */
  async withdraw(viewer: AuthenticatedUser, id: string): Promise<DealView> {
    const deal = await this.loadOwnDeal(viewer, id);
    this.assertStatus(deal, 'proposed');
    if (deal.proposerId !== viewer.userId) {
      throw new ForbiddenException(
        'Seul le proposeur peut retirer sa proposition',
      );
    }
    await this.dealsRepository.update(id, {
      status: 'cancelled',
      closedAt: new Date(),
    });
    this.realtime.emitDealUpdated(deal.recipientId, { dealId: id });
    return this.assembleOne(id, viewer.userId);
  }

  /** Remplace les éléments (PROPOSEUR, phase 'proposed' uniquement —
   * l'accord fige la proposition). */
  async replaceItems(
    viewer: AuthenticatedUser,
    id: string,
    items: DealItemDto[],
  ): Promise<DealView> {
    const deal = await this.loadOwnDeal(viewer, id);
    this.assertStatus(deal, 'proposed');
    if (deal.proposerId !== viewer.userId) {
      throw new ForbiddenException(
        'Seul le proposeur peut modifier sa proposition',
      );
    }
    const specs = this.toItemSpecs(deal.proposerId, deal.recipientId, items);
    await this.dealsRepository.replaceItems(id, specs);
    this.realtime.emitDealUpdated(deal.recipientId, { dealId: id });
    return this.assembleOne(id, viewer.userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Exécution : honorer / valider les sous-éléments
  // ──────────────────────────────────────────────────────────────────────────

  /** Marque un sous-élément comme HONORÉ (fournisseur de l'élément). */
  async honorStep(
    viewer: AuthenticatedUser,
    id: string,
    stepId: string,
  ): Promise<DealView> {
    const { deal, item } = await this.loadStepContext(viewer, id, stepId);
    this.assertStatus(deal, 'active');
    if (item.providerId !== viewer.userId) {
      throw new ForbiddenException(
        'Seul le fournisseur de cet élément peut le marquer comme honoré',
      );
    }
    await this.dealsRepository.honorStep(stepId, new Date());
    this.notifyOther(deal, viewer.userId);
    return this.assembleOne(id, viewer.userId);
  }

  /** VALIDE un sous-élément honoré (contrepartie du fournisseur). Le deal se
   * conclut AUTOMATIQUEMENT quand tout est validé. */
  async validateStep(
    viewer: AuthenticatedUser,
    id: string,
    stepId: string,
  ): Promise<DealView> {
    const { deal, item, step } = await this.loadStepContext(viewer, id, stepId);
    this.assertStatus(deal, 'active');
    if (item.providerId === viewer.userId) {
      throw new ForbiddenException(
        'Le fournisseur ne peut pas valider son propre élément — la contrepartie valide',
      );
    }
    if (step.honoredAt === null) {
      throw new BadRequestException(
        'Ce sous-élément doit d’abord être marqué comme honoré par son fournisseur',
      );
    }
    await this.dealsRepository.validateStep(stepId, new Date());

    // Conclusion automatique : tous les steps de tous les éléments validés.
    const items = await this.dealsRepository.listItems(id);
    const steps = await this.dealsRepository.listSteps(items.map((i) => i.id));
    const allValidated =
      steps.length > 0 && steps.every((s) => s.validatedAt !== null);
    if (allValidated) {
      const completed = await this.dealsRepository.update(id, {
        status: 'completed',
        completedAt: new Date(),
      });
      // Les DEUX parties sont notifiées de la conclusion.
      for (const partyId of [completed.proposerId, completed.recipientId]) {
        await this.notifyDeal(
          completed,
          partyId,
          partyId === viewer.userId ? completed.proposerId : viewer.userId,
          {
            event: 'completed',
            title: `Deal ${completed.dealNumber} conclu 🎉`,
            message:
              'Tous les éléments ont été validés — pensez à évaluer votre partenaire !',
          },
          // notifyDeal ignore déjà l'auto-notification ; ici on force l'envoi
          // aux deux en passant un émetteur différent du destinataire.
        );
      }
    } else {
      this.notifyOther(deal, viewer.userId);
    }
    return this.assembleOne(id, viewer.userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Ajustements (phase 'active')
  // ──────────────────────────────────────────────────────────────────────────

  /** Propose un ajustement (add/modify/remove d'un élément). */
  async proposeAdjustment(
    viewer: AuthenticatedUser,
    id: string,
    dto: ProposeAdjustmentDto,
  ): Promise<DealView> {
    const deal = await this.loadOwnDeal(viewer, id);
    this.assertStatus(deal, 'active');

    let payload: Record<string, unknown> = {};
    let itemId: string | null = null;
    if (dto.kind === 'add') {
      if (!dto.item) {
        throw new BadRequestException(
          "Un ajustement « add » exige l'élément à ajouter (item)",
        );
      }
      const provider = dto.item.providerId ?? viewer.userId;
      if (provider !== deal.proposerId && provider !== deal.recipientId) {
        throw new BadRequestException(
          "Le fournisseur de l'élément doit être une des deux parties du deal",
        );
      }
      const addPayload: DealAdjustmentAddPayload = {
        providerId: provider,
        kind: dto.item.kind,
        title: dto.item.title,
        description: dto.item.description ?? '',
        value: dto.item.value,
        steps:
          dto.item.steps && dto.item.steps.length > 0
            ? dto.item.steps
            : [dto.item.title],
      };
      payload = addPayload as unknown as Record<string, unknown>;
    } else {
      // modify / remove : l'élément visé doit appartenir à CE deal.
      if (!dto.itemId) {
        throw new BadRequestException(
          `Un ajustement « ${dto.kind} » exige l'élément visé (itemId)`,
        );
      }
      const item = await this.dealsRepository.findItemById(dto.itemId);
      if (!item || item.dealId !== id) {
        throw new NotFoundException('Élément introuvable dans ce deal');
      }
      itemId = item.id;
      if (dto.kind === 'modify') {
        const modifyPayload: DealAdjustmentModifyPayload = {
          ...(dto.item?.kind !== undefined ? { kind: dto.item.kind } : {}),
          ...(dto.item?.title !== undefined ? { title: dto.item.title } : {}),
          ...(dto.item?.description !== undefined
            ? { description: dto.item.description }
            : {}),
          ...(dto.item?.value !== undefined ? { value: dto.item.value } : {}),
        };
        if (Object.keys(modifyPayload).length === 0) {
          throw new BadRequestException(
            'Un ajustement « modify » exige au moins un champ modifié (item)',
          );
        }
        payload = modifyPayload as Record<string, unknown>;
      }
    }

    await this.dealsRepository.createAdjustment({
      dealId: id,
      proposedBy: viewer.userId,
      kind: dto.kind,
      itemId,
      payload,
      description: dto.description,
    });
    this.notifyOther(deal, viewer.userId);
    return this.assembleOne(id, viewer.userId);
  }

  /** Décide un ajustement (CONTREPARTIE du proposeur de l'ajustement) —
   * accepté → payload appliqué (add/modify/remove). */
  async decideAdjustment(
    viewer: AuthenticatedUser,
    id: string,
    adjustmentId: string,
    decision: 'accepted' | 'rejected',
  ): Promise<DealView> {
    const deal = await this.loadOwnDeal(viewer, id);
    this.assertStatus(deal, 'active');
    const adjustment =
      await this.dealsRepository.findAdjustmentById(adjustmentId);
    if (!adjustment || adjustment.dealId !== id) {
      throw new NotFoundException('Ajustement introuvable');
    }
    if (adjustment.status !== 'pending') {
      throw new ConflictException('Cet ajustement a déjà été décidé');
    }
    if (adjustment.proposedBy === viewer.userId) {
      throw new ForbiddenException(
        'La contrepartie décide de l’ajustement, pas son auteur',
      );
    }

    await this.dealsRepository.decideAdjustment(
      adjustmentId,
      decision,
      new Date(),
    );
    if (decision === 'accepted') {
      await this.applyAdjustment(deal, adjustment);
    }
    this.notifyOther(deal, viewer.userId);
    return this.assembleOne(id, viewer.userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Notes de suivi
  // ──────────────────────────────────────────────────────────────────────────

  /** Ajoute une note à la timeline (participants, deal non clos). */
  async addNote(
    viewer: AuthenticatedUser,
    id: string,
    body: string,
  ): Promise<DealView> {
    const deal = await this.loadOwnDeal(viewer, id);
    if (!['proposed', 'active'].includes(deal.status)) {
      throw new BadRequestException(
        'Les notes ne sont possibles que sur un deal en cours',
      );
    }
    await this.dealsRepository.createNote({
      dealId: id,
      authorId: viewer.userId,
      body,
    });
    this.notifyOther(deal, viewer.userId);
    return this.assembleOne(id, viewer.userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Actions sensibles : annulation amiable (2 temps) + litige
  // ──────────────────────────────────────────────────────────────────────────

  /** Propose (ou confirme) l'annulation amiable d'un deal ACTIF. */
  async requestCancellation(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<DealView> {
    const deal = await this.loadOwnDeal(viewer, id);
    this.assertStatus(deal, 'active');
    const other = this.otherParty(deal, viewer.userId);

    if (deal.cancellationRequestedBy === null) {
      // Premier temps : la demande est posée.
      const updated = await this.dealsRepository.update(id, {
        cancellationRequestedBy: viewer.userId,
      });
      await this.notifyDeal(updated, other, viewer.userId, {
        event: 'cancellation_requested',
        title: `Annulation proposée (Deal ${deal.dealNumber})`,
        message:
          'Votre partenaire propose une annulation amiable — confirmez ou poursuivez le deal.',
      });
      return this.assembleOne(id, viewer.userId);
    }
    if (deal.cancellationRequestedBy === viewer.userId) {
      throw new ConflictException(
        'Vous avez déjà proposé l’annulation — votre partenaire doit confirmer',
      );
    }
    // Second temps : la CONTREPARTIE confirme → annulé.
    const cancelled = await this.dealsRepository.update(id, {
      status: 'cancelled',
      closedAt: new Date(),
    });
    await this.notifyDeal(cancelled, other, viewer.userId, {
      event: 'cancelled',
      title: `Deal ${deal.dealNumber} annulé`,
      message: 'L’annulation amiable a été confirmée.',
    });
    return this.assembleOne(id, viewer.userId);
  }

  /** Renonce à SA demande d'annulation (le deal reste actif). */
  async withdrawCancellation(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<DealView> {
    const deal = await this.loadOwnDeal(viewer, id);
    this.assertStatus(deal, 'active');
    if (deal.cancellationRequestedBy !== viewer.userId) {
      throw new BadRequestException(
        'Aucune demande d’annulation de votre part à retirer',
      );
    }
    await this.dealsRepository.update(id, { cancellationRequestedBy: null });
    this.notifyOther(deal, viewer.userId);
    return this.assembleOne(id, viewer.userId);
  }

  /** Déclare un LITIGE (unilatéral, deal actif) — arbitré par la modération
   * backoffice depuis le CP2.5 (D66). */
  async dispute(
    viewer: AuthenticatedUser,
    id: string,
    reason: string,
  ): Promise<DealView> {
    const deal = await this.loadOwnDeal(viewer, id);
    this.assertStatus(deal, 'active');
    const disputed = await this.dealsRepository.update(id, {
      status: 'disputed',
      disputedBy: viewer.userId,
      disputeReason: reason,
      // Un deal REPRIS par arbitrage peut connaître un NOUVEAU litige : les
      // traces du précédent arbitrage sont effacées pour qu'un seul cycle
      // litige→arbitrage soit visible à la fois (D66).
      disputeResolvedBy: null,
      disputeResolvedAt: null,
      disputeResolution: null,
      disputeResolutionNote: null,
      closedAt: new Date(),
    });
    await this.notifyDeal(disputed, this.otherParty(deal, viewer.userId), viewer.userId, {
      event: 'disputed',
      title: `Litige déclaré (Deal ${deal.dealNumber})`,
      message:
        'Un litige a été déclaré sur ce deal — l’équipe de modération va l’examiner.',
    });
    return this.assembleOne(id, viewer.userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Avis (deal conclu)
  // ──────────────────────────────────────────────────────────────────────────

  /** Dépose MON avis sur le partenaire (deal 'completed', une seule fois). */
  async submitReview(
    viewer: AuthenticatedUser,
    id: string,
    dto: SubmitReviewDto,
  ): Promise<DealView> {
    const deal = await this.loadOwnDeal(viewer, id);
    this.assertStatus(deal, 'completed');
    const existing = await this.dealsRepository.listReviewsByDeal(id);
    if (existing.some((r) => r.reviewerId === viewer.userId)) {
      throw new ConflictException('Vous avez déjà évalué ce deal');
    }
    const revieweeId = this.otherParty(deal, viewer.userId);
    await this.dealsRepository.createReview({
      dealId: id,
      reviewerId: viewer.userId,
      revieweeId,
      ratingHonesty: dto.ratingHonesty,
      ratingConformity: dto.ratingConformity,
      ratingKindness: dto.ratingKindness,
      comment: dto.comment?.trim() ? dto.comment.trim() : null,
    });
    await this.notifyDeal(deal, revieweeId, viewer.userId, {
      event: 'review_received',
      title: 'Vous avez reçu un avis',
      message: `Votre partenaire du Deal ${deal.dealNumber} vous a évalué.`,
    });
    return this.assembleOne(id, viewer.userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Profil Dealplace (mockup 05 — stats publiques)
  // ──────────────────────────────────────────────────────────────────────────

  /** Stats Dealplace d'un profil (GET /users/:id/deal-profile) — 404 si le
   * compte n'existe pas ou n'est pas actif (sauf pour soi-même). */
  async dealProfile(
    viewer: AuthenticatedUser,
    userId: string,
  ): Promise<DealProfileView> {
    const user = await this.usersRepository.findById(userId);
    if (
      !user ||
      (user.status !== 'active' && userId !== viewer.userId)
    ) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    const [dealsCompleted, aggregates, latestPage, concludedPage] =
      await Promise.all([
        this.dealsRepository.countCompletedByParticipant(userId),
        this.dealsRepository.reviewAggregates(userId),
        this.dealsRepository.listReviewsForUser(userId, { limit: 3, offset: 0 }),
        this.dealsRepository.listCompletedByParticipant(userId, {
          limit: 10,
          offset: 0,
        }),
      ]);

    const latest = await this.assembleReviews(latestPage.items);
    const itemsByDeal = await this.dealsRepository.listItemsByDealIds(
      concludedPage.items.map((d) => d.id),
    );
    const concludedDeals = concludedPage.items.map((deal) => {
      const items = itemsByDeal[deal.id] ?? [];
      return {
        dealNumber: deal.dealNumber,
        offeredByUser: this.offerSummary(items, userId),
        receivedByUser: this.offerSummary(
          items,
          this.otherParty(deal, userId),
        ),
        completedAt: deal.completedAt,
      };
    });

    const overall =
      aggregates.count === 0
        ? null
        : Math.round(
            (((aggregates.avgHonesty ?? 0) +
              (aggregates.avgConformity ?? 0) +
              (aggregates.avgKindness ?? 0)) /
              3) *
              100,
          ) / 100;

    return {
      dealsCompleted,
      reviews: {
        count: aggregates.count,
        avgHonesty: aggregates.avgHonesty,
        avgConformity: aggregates.avgConformity,
        avgKindness: aggregates.avgKindness,
        overall,
        latest,
      },
      concludedDeals,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Backoffice (CP2.5 — D66) : la machine à états reste ICI, le module admin
  // délègue (pattern « service métier hôte », comme les caméras).
  // ──────────────────────────────────────────────────────────────────────────

  /** Liste BACKOFFICE des deals (tous statuts) — GET /admin/dealplace/deals. */
  async listAdminDeals(
    params: AdminListDealsParams,
  ): Promise<PagedAdminDealCards> {
    const page = await this.dealsRepository.listAdmin(params);
    return {
      items: await this.assembleAdminCards(page.items),
      total: page.total,
    };
  }

  /** Page DEAL complète backoffice (tous statuts, 404 si id inconnu). */
  async getAdminDeal(id: string): Promise<AdminDealView> {
    await this.loadAdminDeal(id);
    return this.assembleAdmin(id);
  }

  /**
   * ARBITRE un litige (D66) — deal 'disputed' uniquement (409 sinon) :
   * - 'cancelled' : le deal est ANNULÉ (closedAt du litige conservé) ;
   * - 'completed' : le deal est déclaré CONCLU — completedAt posé, les avis
   *   s'ouvrent et les stats de profil sont incrémentées (comme une
   *   conclusion normale) ;
   * - 'resumed'   : litige jugé non fondé, le deal REPREND ('active',
   *   closedAt effacé) — un nouveau litige reste possible (dispute() efface
   *   alors les traces de cet arbitrage).
   * L'issue, la note et la date sont montrées aux DEUX parties ; l'identité
   * du modérateur reste interne au backoffice. Un modérateur PARTIE PRENANTE
   * du deal ne peut pas l'arbitrer (403 — conflit d'intérêts).
   */
  async resolveDispute(
    admin: AuthenticatedUser,
    id: string,
    input: { outcome: DealDisputeResolution; note: string },
  ): Promise<AdminDealView> {
    const deal = await this.loadAdminDeal(id);
    if (
      admin.userId === deal.proposerId ||
      admin.userId === deal.recipientId
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez pas arbitrer un litige dont vous êtes partie prenante',
      );
    }
    this.assertStatus(deal, 'disputed');

    const now = new Date();
    const patch: UpdateDealPatch = {
      disputeResolvedBy: admin.userId,
      disputeResolvedAt: now,
      disputeResolution: input.outcome,
      disputeResolutionNote: input.note,
    };
    switch (input.outcome) {
      case 'cancelled':
        // closedAt (posé au litige) reste la date de clôture effective.
        patch.status = 'cancelled';
        break;
      case 'completed':
        // Miroir d'une conclusion normale : completedAt posé, closedAt
        // effacé (réservé aux terminaux non conclus).
        patch.status = 'completed';
        patch.completedAt = now;
        patch.closedAt = null;
        break;
      case 'resumed':
        // Le deal reprend son cours ; disputedBy/disputeReason sont CONSERVÉS
        // (audit du cycle litige→arbitrage affiché aux parties).
        patch.status = 'active';
        patch.closedAt = null;
        break;
    }
    const resolved = await this.dealsRepository.update(id, patch);

    const outcomeLabel: Record<DealDisputeResolution, string> = {
      cancelled: 'le deal est annulé',
      completed: 'le deal est déclaré conclu',
      resumed: 'le deal reprend son cours',
    };
    // Les DEUX parties sont notifiées (l'admin n'en est jamais une — vérifié
    // ci-dessus, donc aucune auto-notification possible).
    for (const userId of [deal.proposerId, deal.recipientId]) {
      await this.notifyDeal(resolved, userId, admin.userId, {
        event: 'dispute_resolved',
        title: `Litige tranché (Deal ${deal.dealNumber})`,
        message: `La modération a tranché le litige : ${outcomeLabel[input.outcome]}.`,
      });
    }
    return this.assembleAdmin(id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** 404 si le deal n'existe pas (backoffice : pas de filtre participant). */
  private async loadAdminDeal(id: string): Promise<Deal> {
    const deal = await this.dealsRepository.findById(id);
    if (!deal) {
      throw new NotFoundException('Deal introuvable');
    }
    return deal;
  }

  /** Cartes DEAL backoffice (deux parties nommées — PAR LOT, anti N+1). */
  private async assembleAdminCards(
    deals: Deal[],
  ): Promise<AdminDealCardView[]> {
    if (deals.length === 0) {
      return [];
    }
    const listingIds = [...new Set(deals.map((d) => d.listingId))];
    const partyIds = [
      ...new Set(deals.flatMap((d) => [d.proposerId, d.recipientId])),
    ];
    const [listings, parties, itemsByDeal] = await Promise.all([
      this.listingsRepository.findByIds(listingIds),
      this.usersRepository.findByIds(partyIds),
      this.dealsRepository.listItemsByDealIds(deals.map((d) => d.id)),
    ]);
    const allItems = Object.values(itemsByDeal).flat();
    const steps = await this.dealsRepository.listSteps(
      allItems.map((i) => i.id),
    );
    const stepsByItem = new Map<string, DealItemStep[]>();
    for (const step of steps) {
      (stepsByItem.get(step.itemId) ??
        stepsByItem.set(step.itemId, []).get(step.itemId)!).push(step);
    }
    const listingsById = new Map(listings.map((l) => [l.id, l]));
    const partiesById = new Map(parties.map((u) => [u.id, u]));

    return deals.map((deal) => {
      const items = itemsByDeal[deal.id] ?? [];
      const dealSteps: DealStepView[] = items.flatMap((item) =>
        (stepsByItem.get(item.id) ?? []).map((s) => ({
          id: s.id,
          label: s.label,
          position: s.position,
          honoredAt: s.honoredAt,
          validatedAt: s.validatedAt,
        })),
      );
      return {
        id: deal.id,
        dealNumber: deal.dealNumber,
        status: deal.status,
        stage: this.stage(deal, dealSteps),
        listing: this.toListingRef(
          deal.listingId,
          listingsById.get(deal.listingId) ?? null,
        ),
        proposer: toPostAuthor(
          deal.proposerId,
          partiesById.get(deal.proposerId) ?? null,
        ),
        recipient: toPostAuthor(
          deal.recipientId,
          partiesById.get(deal.recipientId) ?? null,
        ),
        proposerOfferSummary: this.offerSummary(items, deal.proposerId),
        recipientOfferSummary: this.offerSummary(items, deal.recipientId),
        disputedBy: deal.disputedBy,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
        completedAt: deal.completedAt,
      };
    });
  }

  /** Assemble la page DEAL backoffice (relue — reflète l'état à jour). */
  private async assembleAdmin(id: string): Promise<AdminDealView> {
    const deal = (await this.dealsRepository.findById(id)) as Deal;
    const [listing, items, adjustments, notes, reviews] = await Promise.all([
      this.listingsRepository.findById(deal.listingId),
      this.dealsRepository.listItems(id),
      this.dealsRepository.listAdjustments(id),
      this.dealsRepository.listNotes(id),
      this.dealsRepository.listReviewsByDeal(id),
    ]);
    const steps = await this.dealsRepository.listSteps(items.map((i) => i.id));
    const stepsByItem = new Map<string, DealStepView[]>();
    for (const step of steps) {
      (stepsByItem.get(step.itemId) ??
        stepsByItem.set(step.itemId, []).get(step.itemId)!).push({
        id: step.id,
        label: step.label,
        position: step.position,
        honoredAt: step.honoredAt,
        validatedAt: step.validatedAt,
      });
    }

    const authorIds = new Set<string>([deal.proposerId, deal.recipientId]);
    for (const note of notes) {
      authorIds.add(note.authorId);
    }
    for (const review of reviews) {
      authorIds.add(review.reviewerId);
    }
    const users = await this.usersRepository.findByIds([...authorIds]);
    const usersById = new Map(users.map((u) => [u.id, u]));
    const author = (userId: string): PostAuthor =>
      toPostAuthor(userId, usersById.get(userId) ?? null);

    const allStepViews = [...stepsByItem.values()].flat();

    return {
      id: deal.id,
      dealNumber: deal.dealNumber,
      status: deal.status,
      stage: this.stage(deal, allStepViews),
      listing: this.toListingRef(deal.listingId, listing),
      conversationId: deal.conversationId,
      proposer: author(deal.proposerId),
      recipient: author(deal.recipientId),
      dueDate: deal.dueDate,
      cancellationRequestedBy: deal.cancellationRequestedBy,
      disputedBy: deal.disputedBy,
      disputeReason: deal.disputeReason,
      disputeResolvedBy: deal.disputeResolvedBy,
      disputeResolvedAt: deal.disputeResolvedAt,
      disputeResolution: deal.disputeResolution,
      disputeResolutionNote: deal.disputeResolutionNote,
      items: items.map((item) => {
        const itemSteps = stepsByItem.get(item.id) ?? [];
        return {
          id: item.id,
          providerId: item.providerId,
          kind: item.kind,
          title: item.title,
          description: item.description,
          value: item.value,
          position: item.position,
          badge: this.itemBadge(itemSteps),
          steps: itemSteps,
        };
      }),
      adjustments: adjustments.map((a) => ({
        id: a.id,
        proposedBy: a.proposedBy,
        kind: a.kind,
        itemId: a.itemId,
        payload: a.payload,
        description: a.description,
        status: a.status,
        decidedAt: a.decidedAt,
        createdAt: a.createdAt,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        author: author(n.authorId),
        body: n.body,
        createdAt: n.createdAt,
      })),
      reviews: await this.assembleReviews(reviews),
      acceptedAt: deal.acceptedAt,
      completedAt: deal.completedAt,
      closedAt: deal.closedAt,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
    };
  }

  /** 404 si le deal n'existe pas OU si l'appelant n'en est pas partie. */
  private async loadOwnDeal(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<Deal> {
    const deal = await this.dealsRepository.findById(id);
    if (
      !deal ||
      (deal.proposerId !== viewer.userId && deal.recipientId !== viewer.userId)
    ) {
      throw new NotFoundException('Deal introuvable');
    }
    return deal;
  }

  /** 409 si le deal n'est pas dans le statut attendu par la transition. */
  private assertStatus(deal: Deal, expected: DealStatus): void {
    if (deal.status !== expected) {
      throw new ConflictException(
        `Cette action exige un deal « ${expected} » (statut actuel : ${deal.status})`,
      );
    }
  }

  /** L'autre partie du deal. */
  private otherParty(deal: Deal, userId: string): string {
    return deal.proposerId === userId ? deal.recipientId : deal.proposerId;
  }

  /** Charge le contexte d'un step : le deal (appartenance vérifiée),
   * l'élément et le step — 404 si le step n'appartient pas à ce deal. */
  private async loadStepContext(
    viewer: AuthenticatedUser,
    dealId: string,
    stepId: string,
  ): Promise<{ deal: Deal; item: DealItem; step: DealItemStep }> {
    const deal = await this.loadOwnDeal(viewer, dealId);
    const step = await this.dealsRepository.findStepById(stepId);
    if (!step) {
      throw new NotFoundException('Sous-élément introuvable');
    }
    const item = await this.dealsRepository.findItemById(step.itemId);
    if (!item || item.dealId !== dealId) {
      throw new NotFoundException('Sous-élément introuvable');
    }
    return { deal, item, step };
  }

  /** Convertit les DTO d'éléments en specs (fournisseur ∈ parties, step
   * automatique portant le titre si aucun fourni, ≥ 1 élément par partie NON
   * exigé — mais au moins 1 élément au total, garanti par le DTO). */
  private toItemSpecs(
    proposerId: string,
    recipientId: string,
    items: DealItemDto[],
  ): CreateDealItemSpec[] {
    return items.map((item, index) => {
      const providerId = item.providerId ?? proposerId;
      if (providerId !== proposerId && providerId !== recipientId) {
        throw new BadRequestException(
          "Le fournisseur de chaque élément doit être une des deux parties du deal",
        );
      }
      return {
        providerId,
        kind: item.kind,
        title: item.title,
        description: item.description ?? '',
        value: item.value,
        position: index,
        steps:
          item.steps && item.steps.length > 0 ? item.steps : [item.title],
      };
    });
  }

  /** Applique un ajustement ACCEPTÉ (add/modify/remove). */
  private async applyAdjustment(
    deal: Deal,
    adjustment: DealAdjustment,
  ): Promise<void> {
    if (adjustment.kind === 'add') {
      const p = adjustment.payload as unknown as DealAdjustmentAddPayload;
      await this.dealsRepository.addItem(deal.id, {
        providerId: p.providerId,
        kind: p.kind,
        title: p.title,
        description: p.description ?? '',
        value: p.value,
        steps: p.steps && p.steps.length > 0 ? p.steps : [p.title],
      });
      return;
    }
    // modify / remove : l'élément peut avoir disparu entre-temps (remove
    // accepté avant) — on ignore alors silencieusement (l'ajustement reste
    // tracé « accepté », l'état du deal fait foi).
    if (adjustment.itemId === null) {
      return;
    }
    const item = await this.dealsRepository.findItemById(adjustment.itemId);
    if (!item || item.dealId !== deal.id) {
      return;
    }
    if (adjustment.kind === 'remove') {
      await this.dealsRepository.removeItem(adjustment.itemId);
      return;
    }
    const p = adjustment.payload as DealAdjustmentModifyPayload;
    await this.dealsRepository.updateItem(adjustment.itemId, {
      ...(p.kind !== undefined ? { kind: p.kind } : {}),
      ...(p.title !== undefined ? { title: p.title } : {}),
      ...(p.description !== undefined ? { description: p.description } : {}),
      ...(p.value !== undefined ? { value: p.value } : {}),
    });
  }

  /** Notification in-app type 'deal' (jalon) + event socket au destinataire. */
  private async notifyDeal(
    deal: Deal,
    recipientId: string,
    actorId: string,
    content: { event: string; title: string; message: string },
  ): Promise<void> {
    // Jamais de notification à soi-même (règle générale du projet).
    if (recipientId !== actorId) {
      await this.notifications.create({
        userId: recipientId,
        type: 'deal',
        payload: {
          dealId: deal.id,
          dealNumber: deal.dealNumber,
          event: content.event,
          title: content.title,
          message: content.message,
        },
      });
    }
    this.realtime.emitDealUpdated(recipientId, { dealId: deal.id });
  }

  /** Event socket seul (pas de notification) vers l'autre partie — steps,
   * notes, ajustements : la page ouverte se rafraîchit, sans flood. */
  private notifyOther(deal: Deal, actorId: string): void {
    this.realtime.emitDealUpdated(this.otherParty(deal, actorId), {
      dealId: deal.id,
    });
  }

  /** Résumé « ce que fournit userId » : titre du 1er élément (+ « +N »). */
  private offerSummary(items: DealItem[], userId: string): string {
    const mine = items.filter((i) => i.providerId === userId);
    if (mine.length === 0) {
      return '—';
    }
    return mine.length === 1
      ? mine[0].title
      : `${mine[0].title} (+${mine.length - 1})`;
  }

  /** Badge d'un élément, dérivé de ses steps (mockup 07). */
  private itemBadge(steps: DealStepView[]): DealItemBadge {
    const honored = steps.filter((s) => s.honoredAt !== null).length;
    const validated = steps.filter((s) => s.validatedAt !== null).length;
    if (validated === steps.length && steps.length > 0) {
      return 'honored';
    }
    if (honored === steps.length && steps.length > 0) {
      return 'awaiting_validation';
    }
    if (honored > 0 || validated > 0) {
      return 'partial';
    }
    return 'to_provide';
  }

  /** Étape du stepper (mockup 07), dérivée du statut + des steps. */
  private stage(deal: Deal, steps: DealStepView[]): DealStage {
    switch (deal.status) {
      case 'proposed':
        return 'discussion';
      case 'completed':
        return 'concluded';
      case 'declined':
      case 'cancelled':
      case 'disputed':
        return 'closed';
      case 'active': {
        const anyProgress = steps.some((s) => s.honoredAt !== null);
        const allHonored =
          steps.length > 0 && steps.every((s) => s.honoredAt !== null);
        if (allHonored) {
          return 'validations';
        }
        return anyProgress ? 'in_progress' : 'agreement';
      }
    }
  }

  /** Assemble UNE page de deal complète (relue — reflète l'état à jour). */
  private async assembleOne(id: string, viewerId: string): Promise<DealView> {
    const deal = (await this.dealsRepository.findById(id)) as Deal;
    const [listing, items, adjustments, notes, reviews] = await Promise.all([
      this.listingsRepository.findById(deal.listingId),
      this.dealsRepository.listItems(id),
      this.dealsRepository.listAdjustments(id),
      this.dealsRepository.listNotes(id),
      this.dealsRepository.listReviewsByDeal(id),
    ]);
    const steps = await this.dealsRepository.listSteps(items.map((i) => i.id));
    const stepsByItem = new Map<string, DealStepView[]>();
    for (const step of steps) {
      (stepsByItem.get(step.itemId) ??
        stepsByItem.set(step.itemId, []).get(step.itemId)!).push({
        id: step.id,
        label: step.label,
        position: step.position,
        honoredAt: step.honoredAt,
        validatedAt: step.validatedAt,
      });
    }

    const otherId = this.otherParty(deal, viewerId);
    const authorIds = new Set<string>([otherId]);
    for (const note of notes) {
      authorIds.add(note.authorId);
    }
    for (const review of reviews) {
      authorIds.add(review.reviewerId);
    }
    const users = await this.usersRepository.findByIds([...authorIds]);
    const usersById = new Map(users.map((u) => [u.id, u]));
    const author = (userId: string): PostAuthor =>
      toPostAuthor(userId, usersById.get(userId) ?? null);

    const allStepViews = [...stepsByItem.values()].flat();

    return {
      id: deal.id,
      dealNumber: deal.dealNumber,
      status: deal.status,
      stage: this.stage(deal, allStepViews),
      listing: this.toListingRef(deal.listingId, listing),
      conversationId: deal.conversationId,
      proposerId: deal.proposerId,
      recipientId: deal.recipientId,
      otherParticipant: author(otherId),
      dueDate: deal.dueDate,
      cancellationRequestedBy: deal.cancellationRequestedBy,
      disputedBy: deal.disputedBy,
      disputeReason: deal.disputeReason,
      disputeResolution: deal.disputeResolution,
      disputeResolutionNote: deal.disputeResolutionNote,
      disputeResolvedAt: deal.disputeResolvedAt,
      items: items.map((item) => {
        const itemSteps = stepsByItem.get(item.id) ?? [];
        return {
          id: item.id,
          providerId: item.providerId,
          kind: item.kind,
          title: item.title,
          description: item.description,
          value: item.value,
          position: item.position,
          badge: this.itemBadge(itemSteps),
          steps: itemSteps,
        };
      }),
      adjustments: adjustments.map((a) => ({
        id: a.id,
        proposedBy: a.proposedBy,
        kind: a.kind,
        itemId: a.itemId,
        payload: a.payload,
        description: a.description,
        status: a.status,
        decidedAt: a.decidedAt,
        createdAt: a.createdAt,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        author: author(n.authorId),
        body: n.body,
        createdAt: n.createdAt,
      })),
      reviews: await this.assembleReviews(reviews),
      myReviewSubmitted: reviews.some((r) => r.reviewerId === viewerId),
      acceptedAt: deal.acceptedAt,
      completedAt: deal.completedAt,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
    };
  }

  /** Assemble une liste de cartes (annonces + interlocuteurs + résumés +
   * stage — PAR LOT, anti N+1). */
  private async assembleCards(
    deals: Deal[],
    viewerId: string,
  ): Promise<DealCardView[]> {
    if (deals.length === 0) {
      return [];
    }
    const listingIds = [...new Set(deals.map((d) => d.listingId))];
    const otherIds = [
      ...new Set(deals.map((d) => this.otherParty(d, viewerId))),
    ];
    const [listings, others, itemsByDeal] = await Promise.all([
      this.listingsRepository.findByIds(listingIds),
      this.usersRepository.findByIds(otherIds),
      this.dealsRepository.listItemsByDealIds(deals.map((d) => d.id)),
    ]);
    const allItems = Object.values(itemsByDeal).flat();
    const steps = await this.dealsRepository.listSteps(
      allItems.map((i) => i.id),
    );
    const stepsByItem = new Map<string, DealItemStep[]>();
    for (const step of steps) {
      (stepsByItem.get(step.itemId) ??
        stepsByItem.set(step.itemId, []).get(step.itemId)!).push(step);
    }
    const listingsById = new Map(listings.map((l) => [l.id, l]));
    const othersById = new Map(others.map((u) => [u.id, u]));

    return deals.map((deal) => {
      const items = itemsByDeal[deal.id] ?? [];
      const dealSteps: DealStepView[] = items.flatMap((item) =>
        (stepsByItem.get(item.id) ?? []).map((s) => ({
          id: s.id,
          label: s.label,
          position: s.position,
          honoredAt: s.honoredAt,
          validatedAt: s.validatedAt,
        })),
      );
      const otherId = this.otherParty(deal, viewerId);
      return {
        id: deal.id,
        dealNumber: deal.dealNumber,
        status: deal.status,
        stage: this.stage(deal, dealSteps),
        otherParticipant: toPostAuthor(otherId, othersById.get(otherId) ?? null),
        listing: this.toListingRef(
          deal.listingId,
          listingsById.get(deal.listingId) ?? null,
        ),
        myOfferSummary: this.offerSummary(items, viewerId),
        theirOfferSummary: this.offerSummary(items, otherId),
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
        completedAt: deal.completedAt,
      };
    });
  }

  /** Assemble les avis (auteur = forme AUTEUR publique, note globale). */
  private async assembleReviews(
    reviews: DealReview[],
  ): Promise<DealReviewView[]> {
    if (reviews.length === 0) {
      return [];
    }
    const users = await this.usersRepository.findByIds([
      ...new Set(reviews.map((r) => r.reviewerId)),
    ]);
    const usersById = new Map(users.map((u) => [u.id, u]));
    return reviews.map((r) => ({
      id: r.id,
      reviewer: toPostAuthor(r.reviewerId, usersById.get(r.reviewerId) ?? null),
      revieweeId: r.revieweeId,
      ratingHonesty: r.ratingHonesty,
      ratingConformity: r.ratingConformity,
      ratingKindness: r.ratingKindness,
      overall:
        Math.round(
          ((r.ratingHonesty + r.ratingConformity + r.ratingKindness) / 3) * 100,
        ) / 100,
      comment: r.comment,
      createdAt: r.createdAt,
    }));
  }

  /** Référence légère d'annonce (repli si soft-supprimée). */
  private toListingRef(
    listingId: string,
    listing: { id: string; title: string; urlSlug: string; status: string } | null,
  ): DealListingRef {
    if (!listing) {
      return {
        id: listingId,
        title: 'Annonce supprimée',
        urlSlug: '',
        status: 'deleted',
      };
    }
    return {
      id: listing.id,
      title: listing.title,
      urlSlug: listing.urlSlug,
      status: listing.status,
    };
  }
}

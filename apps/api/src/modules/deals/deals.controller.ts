import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { DealStatus } from '../../database/domain/entities';
import {
  DealCardView,
  DealsService,
  DealView,
} from './deals.service';
import { AddDealNoteDto } from './dto/add-deal-note.dto';
import { DisputeDealDto } from './dto/dispute-deal.dto';
import { ProposeAdjustmentDto } from './dto/propose-adjustment.dto';
import { ProposeDealDto, ReplaceDealItemsDto } from './dto/propose-deal.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';

/**
 * Contrôleur deals contractuels (Lot 2 — CP2.4, décision D64).
 *
 * Toutes les routes exigent un jeton (guard JWT global) et sont STRICTEMENT
 * réservées aux deux parties du deal (404 sinon — ne rien divulguer). Les
 * transitions renvoient la page de deal À JOUR (forme DEAL) : le mobile
 * remplace son état sans rappel supplémentaire. Route statique
 * 'conversation/...' déclarée AVANT ':id'.
 */
@ApiTags('deals')
@ApiBearerAuth()
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  @ApiOperation({
    summary: 'Mes deals (triés par activité décroissante)',
    description:
      'Cartes DEAL_CARD : numéro, statut + étape dérivée, partenaire, ' +
      'annonce, résumés « j’offre ⇄ il offre ». Filtre ?status= facultatif.',
  })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: '{ items: DEAL_CARD[], total }' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
    @Query('status') status?: DealStatus,
  ): Promise<{ items: DealCardView[]; total: number }> {
    return this.dealsService.listMine(user, {
      status,
      limit: pagination.limit,
      offset: pagination.offset,
    });
  }

  @Get('conversation/:conversationId')
  @ApiOperation({
    summary: 'Deal OUVERT lié à une conversation (bandeau du fil)',
    description: '404 si aucun deal proposé/actif ne lie cette conversation.',
  })
  @ApiParam({ name: 'conversationId', description: 'Identifiant du fil' })
  @ApiResponse({ status: 200, description: 'DEAL_CARD' })
  @ApiResponse({ status: 404, description: 'Deal introuvable' })
  findForConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
  ): Promise<DealCardView> {
    return this.dealsService.findOpenForConversation(user, conversationId);
  }

  @Post()
  @ApiOperation({
    summary: 'Proposer un deal sur une annonce',
    description:
      "Annonce 'active' uniquement ; contrepartie = propriétaire de " +
      "l'annonce (ou recipientId si l'annonce vous appartient) ; UN SEUL " +
      'deal ouvert par (annonce, paire) — 409 sinon. Chaque élément porte ' +
      'son fournisseur, sa valeur et ses sous-éléments (un step automatique ' +
      'portant le titre est créé sinon). La conversation liée est créée si ' +
      'absente. Le destinataire est notifié (in-app + temps réel).',
  })
  @ApiResponse({ status: 201, description: 'DEAL créé (statut proposed)' })
  @ApiResponse({ status: 400, description: 'Corps invalide / soi-même' })
  @ApiResponse({ status: 404, description: 'Annonce ou destinataire introuvable' })
  @ApiResponse({ status: 409, description: 'Deal déjà ouvert sur cette annonce' })
  propose(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProposeDealDto,
  ): Promise<DealView> {
    return this.dealsService.propose(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Page de deal complète (participants uniquement)' })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 200, description: 'DEAL (items, ajustements, notes, avis)' })
  @ApiResponse({ status: 404, description: 'Deal introuvable' })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DealView> {
    return this.dealsService.getById(user, id);
  }

  @Put(':id/items')
  @ApiOperation({
    summary: 'Remplacer les éléments (PROPOSEUR, phase proposed uniquement)',
    description: "L'accord fige la proposition — ensuite : ajustements.",
  })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 200, description: 'DEAL à jour' })
  @ApiResponse({ status: 403, description: 'Pas le proposeur' })
  @ApiResponse({ status: 409, description: 'Deal déjà accepté/clos' })
  replaceItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReplaceDealItemsDto,
  ): Promise<DealView> {
    return this.dealsService.replaceItems(user, id, dto.items);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accepter la proposition (DESTINATAIRE) → active' })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 201, description: 'DEAL actif' })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DealView> {
    return this.dealsService.accept(user, id);
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Refuser la proposition (DESTINATAIRE) — terminal' })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 201, description: 'DEAL refusé' })
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DealView> {
    return this.dealsService.decline(user, id);
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Retirer sa proposition (PROPOSEUR, phase proposed)' })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 201, description: 'DEAL annulé' })
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DealView> {
    return this.dealsService.withdraw(user, id);
  }

  @Post(':id/steps/:stepId/honor')
  @ApiOperation({
    summary: 'Marquer un sous-élément comme HONORÉ (fournisseur de l’élément)',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiParam({ name: 'stepId', description: 'Identifiant du sous-élément' })
  @ApiResponse({ status: 201, description: 'DEAL à jour' })
  honorStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('stepId') stepId: string,
  ): Promise<DealView> {
    return this.dealsService.honorStep(user, id, stepId);
  }

  @Post(':id/steps/:stepId/validate')
  @ApiOperation({
    summary:
      'VALIDER un sous-élément honoré (contrepartie) — le deal se conclut ' +
      'automatiquement quand tout est validé',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiParam({ name: 'stepId', description: 'Identifiant du sous-élément' })
  @ApiResponse({ status: 201, description: 'DEAL à jour (voire conclu)' })
  validateStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('stepId') stepId: string,
  ): Promise<DealView> {
    return this.dealsService.validateStep(user, id, stepId);
  }

  @Post(':id/adjustments')
  @ApiOperation({
    summary: 'Proposer un ajustement (add/modify/remove — deal actif)',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 201, description: 'DEAL à jour (ajustement pending)' })
  proposeAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ProposeAdjustmentDto,
  ): Promise<DealView> {
    return this.dealsService.proposeAdjustment(user, id, dto);
  }

  @Post(':id/adjustments/:adjustmentId/accept')
  @ApiOperation({
    summary: 'Accepter un ajustement (CONTREPARTIE) — appliqué au deal',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiParam({ name: 'adjustmentId', description: "Identifiant de l'ajustement" })
  @ApiResponse({ status: 201, description: 'DEAL à jour (payload appliqué)' })
  acceptAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('adjustmentId') adjustmentId: string,
  ): Promise<DealView> {
    return this.dealsService.decideAdjustment(user, id, adjustmentId, 'accepted');
  }

  @Post(':id/adjustments/:adjustmentId/reject')
  @ApiOperation({ summary: 'Refuser un ajustement (CONTREPARTIE)' })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiParam({ name: 'adjustmentId', description: "Identifiant de l'ajustement" })
  @ApiResponse({ status: 201, description: 'DEAL à jour' })
  rejectAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('adjustmentId') adjustmentId: string,
  ): Promise<DealView> {
    return this.dealsService.decideAdjustment(user, id, adjustmentId, 'rejected');
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Ajouter une note au « Suivi du deal »' })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 201, description: 'DEAL à jour' })
  addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddDealNoteDto,
  ): Promise<DealView> {
    return this.dealsService.addNote(user, id, dto.body);
  }

  @Post(':id/cancellation')
  @ApiOperation({
    summary:
      'Annulation amiable EN DEUX TEMPS : 1er appel = proposer, appel de la ' +
      'contrepartie = confirmer (deal annulé)',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 201, description: 'DEAL à jour' })
  requestCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DealView> {
    return this.dealsService.requestCancellation(user, id);
  }

  @Post(':id/cancellation/withdraw')
  @ApiOperation({ summary: "Retirer SA demande d'annulation (le deal continue)" })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 201, description: 'DEAL à jour' })
  withdrawCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DealView> {
    return this.dealsService.withdrawCancellation(user, id);
  }

  @Post(':id/dispute')
  @ApiOperation({
    summary: 'Déclarer un litige (unilatéral, deal actif) — terminal au CP2.4',
    description:
      "L'arbitrage (backoffice/IA) arrive avec la modération avancée (CP2.5+).",
  })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 201, description: 'DEAL en litige' })
  dispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DisputeDealDto,
  ): Promise<DealView> {
    return this.dealsService.dispute(user, id, dto.reason);
  }

  @Post(':id/review')
  @ApiOperation({
    summary:
      'Évaluer son partenaire (deal CONCLU, une seule fois) — 3 critères ' +
      '1-5 + commentaire',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 201, description: 'DEAL à jour (avis déposé)' })
  @ApiResponse({ status: 409, description: 'Avis déjà déposé / deal non conclu' })
  submitReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitReviewDto,
  ): Promise<DealView> {
    return this.dealsService.submitReview(user, id, dto);
  }
}

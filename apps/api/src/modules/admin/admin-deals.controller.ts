import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminDealView,
  DealsService,
  PagedAdminDealCards,
} from '../deals/deals.service';
import { AdminListDealsQueryDto } from './dto/admin-list-deals-query.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

/**
 * Contrôleur deals du backoffice (CP2.5 — D66).
 *
 * Double protection : guard JWT GLOBAL (401 sans jeton) + RolesGuard +
 * @Roles('moderator','super_admin') (403 pour un utilisateur simple).
 *
 * Pattern « service métier hôte » (comme les caméras) : la machine à états
 * des deals vit dans DealsService — le backoffice délègue (listAdminDeals,
 * getAdminDeal, resolveDispute), aucune logique métier ici.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/dealplace/deals')
export class AdminDealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les deals (backoffice)',
    description:
      'Liste paginée, TOUS statuts confondus, antéchronologique. ' +
      '?status=disputed = la file « litiges à arbitrer ». ?search= cherche ' +
      'dans le nom des parties et le titre de l’annonce (insensible à la ' +
      'casse) ; une saisie entièrement numérique matche aussi le numéro ' +
      'exact du deal. Chaque élément expose les DEUX parties (forme non ' +
      'viewer-centrique).',
  })
  @ApiResponse({
    status: 200,
    description: '{ items: ADMIN_DEAL_CARD, total }',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  listDeals(
    @Query() query: AdminListDealsQueryDto,
  ): Promise<PagedAdminDealCards> {
    return this.dealsService.listAdminDeals({
      status: query.status,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détail d'un deal (backoffice)",
    description:
      'Page DEAL complète quel que soit le statut : les deux parties, ' +
      'éléments/sous-éléments, ajustements, notes, avis, litige et son ' +
      'éventuel arbitrage (y compris l’identité du modérateur, jamais ' +
      'exposée aux parties) — 404 uniquement si l’identifiant n’existe pas.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 200, description: 'ADMIN_DEAL' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Deal introuvable' })
  getDeal(@Param('id') id: string): Promise<AdminDealView> {
    return this.dealsService.getAdminDeal(id);
  }

  @Post(':id/resolve-dispute')
  @ApiOperation({
    summary: 'Arbitrer un litige (backoffice)',
    description:
      'Tranche un deal « disputed » (409 sinon) : « cancelled » (annulé), ' +
      '« completed » (déclaré conclu — les avis s’ouvrent) ou « resumed » ' +
      '(litige non fondé, le deal reprend son cours). La note de décision ' +
      'est OBLIGATOIRE et montrée aux DEUX parties (notification type ' +
      '« deal », event socket deal.updated). Un modérateur partie prenante ' +
      'du deal ne peut pas l’arbitrer (403 — conflit d’intérêts).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du deal' })
  @ApiResponse({ status: 201, description: 'ADMIN_DEAL à jour' })
  @ApiResponse({ status: 400, description: 'Issue ou note invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({
    status: 403,
    description: 'Rôle administrateur requis, ou arbitre partie prenante',
  })
  @ApiResponse({ status: 404, description: 'Deal introuvable' })
  @ApiResponse({
    status: 409,
    description: 'Le deal n’est pas en litige',
  })
  resolveDispute(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ): Promise<AdminDealView> {
    return this.dealsService.resolveDispute(admin, id, {
      outcome: dto.outcome,
      note: dto.note,
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostAuthor, toPostAuthor } from '../../common/mappers/post.mapper';
import {
  ListingCardView,
  ListingView,
} from '../../common/mappers/listing.mapper';
import {
  LISTINGS_REPOSITORY,
  REPORTS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import {
  Listing,
  Report,
  ReportReasonCode,
  ReportStatus,
} from '../../database/domain/entities';
import {
  ListingsRepository,
  ReportsRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { ListingAssembler } from '../dealplace/listing.assembler';
import { AdminListListingsQueryDto } from './dto/admin-list-listings-query.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';

/** LISTING_CARD enrichi du statut (colonne « état » de la liste admin) et du
 * nombre de signalements OUVERTS (CP2.5 — D65, miroir des posts). */
export interface AdminListingCard extends ListingCardView {
  status: Listing['status'];
  openReportsCount: number;
}

/** Liste backoffice paginée d'annonces. */
export interface PagedAdminListingCards {
  items: AdminListingCard[];
  total: number;
}

/** Signalement lié affiché dans le détail backoffice d'une annonce — même
 * forme que côté publications : { id, reasonCode, message, status,
 * createdAt, reporter: AUTEUR }. */
export interface AdminListingReportView {
  id: string;
  reasonCode: ReportReasonCode;
  message: string;
  status: ReportStatus;
  createdAt: Date;
  reporter: PostAuthor;
}

/** Détail backoffice : LISTING complet + signalements liés (CP2.5 — D65,
 * miroir de AdminPostDetail). */
export interface AdminListingDetail extends ListingView {
  status: Listing['status'];
  openReportsCount: number;
  reports: AdminListingReportView[];
}

/**
 * Service annonces du backoffice (CP2.1) — réservé aux rôles moderator et
 * super_admin (RolesGuard sur le contrôleur).
 *
 * L'admin voit TOUT : tous les statuts ('active', 'hidden', 'deleted' — audit).
 * La forme LISTING_CARD est assemblée par la MÊME source unique que l'annuaire
 * public (ListingAssembler), enrichie du statut. Le détail réutilise la forme
 * LISTING complète.
 *
 * Règles de statut (miroir des posts) :
 * - seuls 'active' et 'hidden' sont posables : la suppression appartient au
 *   propriétaire (DELETE /dealplace/listings/:id) ou au flux RGPD → 400 ;
 * - une annonce 'deleted' n'est jamais restaurée par le backoffice → 409.
 */
@Injectable()
export class AdminListingsService {
  constructor(
    @Inject(LISTINGS_REPOSITORY)
    private readonly listingsRepository: ListingsRepository,
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    private readonly assembler: ListingAssembler,
  ) {}

  /** Liste backoffice paginée (GET /admin/dealplace/listings) — tous statuts,
   * filtres status/family/category/flaggedOnly et recherche
   * titre/description/propriétaire. Chaque carte porte son nombre de
   * signalements ouverts (CP2.5 — pattern des posts, anti N+1). */
  async listListings(
    query: AdminListListingsQueryDto,
  ): Promise<PagedAdminListingCards> {
    const page = await this.listingsRepository.listAdmin({
      status: query.status,
      family: query.family,
      categorySlug: query.category,
      flaggedOnly: query.flaggedOnly,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
    const [cards, openCounts] = await Promise.all([
      this.assembler.assembleCards(page.items),
      this.reportsRepository.countOpenByTargets(
        'listing',
        page.items.map((listing) => listing.id),
      ),
    ]);
    // Le repository préserve l'ordre : on ré-associe le statut par index.
    const items: AdminListingCard[] = cards.map((card, index) => ({
      ...card,
      status: page.items[index].status,
      openReportsCount: openCounts[page.items[index].id] ?? 0,
    }));
    return { items, total: page.total };
  }

  /** Détail backoffice (GET /admin/dealplace/listings/:id) : LISTING complet
   * quel que soit le statut + signalements liés (CP2.5) — 404 seulement si
   * l'id n'existe pas. */
  async getListing(id: string): Promise<AdminListingDetail> {
    const listing = await this.loadListing(id);
    const [view, reports] = await Promise.all([
      this.assembler.assembleOne(listing),
      this.reportsRepository.listByTarget('listing', id),
    ]);
    const reporters = await this.usersRepository.findByIds([
      ...new Set(reports.map((report) => report.reporterId)),
    ]);
    const reportersById = new Map(reporters.map((u) => [u.id, u]));
    return {
      ...view,
      status: listing.status,
      // Déjà chargés pour le détail : compter en mémoire évite un appel.
      openReportsCount: reports.filter((r) => r.status === 'open').length,
      reports: reports.map((report) =>
        this.toReportView(report, reportersById),
      ),
    };
  }

  /**
   * Masque ou republie une annonce (PATCH /admin/dealplace/listings/:id/status).
   * Idempotent. Une annonce masquée disparaît de l'annuaire et du détail public
   * (404 pour tous sauf le propriétaire et les modérateurs) mais RESTE en base.
   */
  async updateStatus(
    id: string,
    dto: UpdateListingStatusDto,
  ): Promise<AdminListingCard> {
    if (dto.status === 'deleted') {
      throw new BadRequestException(
        'La suppression appartient au propriétaire ou au flux RGPD',
      );
    }
    const listing = await this.loadListing(id);
    if (listing.status === 'deleted') {
      throw new ConflictException(
        'Cette annonce a été supprimée : son statut ne peut plus être modifié',
      );
    }
    const updated = await this.listingsRepository.setStatus(id, dto.status);
    const [[card], openCounts] = await Promise.all([
      this.assembler.assembleCards([updated]),
      this.reportsRepository.countOpenByTargets('listing', [updated.id]),
    ]);
    return {
      ...card,
      status: updated.status,
      openReportsCount: openCounts[updated.id] ?? 0,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Charge une annonce par id, TOUT statut confondu — 404 si l'id n'existe pas. */
  private async loadListing(id: string): Promise<Listing> {
    const listing = await this.listingsRepository.findById(id);
    if (!listing) {
      throw new NotFoundException('Annonce introuvable');
    }
    return listing;
  }

  /** Projette un signalement lié (reporter = forme AUTEUR, repli défensif). */
  private toReportView(
    report: Report,
    reportersById: Map<string, Parameters<typeof toPostAuthor>[1]>,
  ): AdminListingReportView {
    return {
      id: report.id,
      reasonCode: report.reasonCode,
      message: report.message,
      status: report.status,
      createdAt: report.createdAt,
      reporter: toPostAuthor(
        report.reporterId,
        reportersById.get(report.reporterId) ?? null,
      ),
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OwnerPageCard,
  PageEventView,
  PageOfferView,
  PageView,
  toPageEventView,
  toPageOfferView,
} from '../../common/mappers/page.mapper';
import { PostAuthor, toPostAuthor } from '../../common/mappers/post.mapper';
import {
  PAGES_REPOSITORY,
  REPORTS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import {
  Page,
  ReportReasonCode,
  ReportStatus,
} from '../../database/domain/entities';
import {
  PagesRepository,
  ReportsRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { PageAssembler } from '../pages/page.assembler';
import { AdminListPagesQueryDto } from './dto/admin-list-pages-query.dto';
import {
  UpdatePageStatusDto,
  UpdatePageVerifiedDto,
} from './dto/update-page-status.dto';

/** Carte PAGE du backoffice : OwnerPageCard (statut inclus) + propriétaire
 * nommé + compteur de signalements ouverts (pattern des annonces). */
export interface AdminPageCard extends OwnerPageCard {
  owner: PostAuthor;
  openReportsCount: number;
}

/** Liste backoffice paginée de pages. */
export interface PagedAdminPageCards {
  items: AdminPageCard[];
  total: number;
}

/** Signalement lié affiché dans le détail d'une page (miroir annonces). */
export interface AdminPageReportView {
  id: string;
  reasonCode: ReportReasonCode;
  message: string;
  status: ReportStatus;
  createdAt: Date;
  reporter: PostAuthor;
}

/** Détail backoffice d'une page : PAGE complète + compteurs de contenus +
 * historique des offres/événements + signalements liés. */
export interface AdminPageDetail extends PageView {
  openReportsCount: number;
  counts: {
    dishes: number;
    documents: number;
    menus: number;
    offers: number;
    events: number;
  };
  offers: PageOfferView[];
  events: PageEventView[];
  reports: AdminPageReportView[];
}

/**
 * Service pages du backoffice (Lot 3 — D76) — réservé aux rôles moderator et
 * super_admin (RolesGuard sur le contrôleur).
 *
 * - liste TOUS statuts (filtres type/statut/vérifiée/flaggedOnly/recherche),
 *   compteur de signalements ouverts par page (pattern des annonces) ;
 * - masquer/republier via PATCH status ('deleted' → 400, page supprimée →
 *   409 — miroir strict des annonces) ; masquer une page retire ses
 *   publications du feed et de la carte (D69) ;
 * - le badge vérifié (✓ du mockup) s'accorde/se retire ici — c'est la
 *   « validation légère » a posteriori (D69).
 */
@Injectable()
export class AdminPagesService {
  constructor(
    @Inject(PAGES_REPOSITORY)
    private readonly pagesRepository: PagesRepository,
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    private readonly assembler: PageAssembler,
  ) {}

  /** Liste backoffice paginée (GET /admin/pages). */
  async listPages(query: AdminListPagesQueryDto): Promise<PagedAdminPageCards> {
    const page = await this.pagesRepository.listAdmin({
      pageType: query.pageType,
      status: query.status,
      verified: query.verified,
      flaggedOnly: query.flaggedOnly,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
    const [cards, owners, openCounts] = await Promise.all([
      this.assembler.assembleOwnerCards(page.items),
      this.usersRepository.findByIds([
        ...new Set(page.items.map((item) => item.ownerId)),
      ]),
      this.reportsRepository.countOpenByTargets(
        'page',
        page.items.map((item) => item.id),
      ),
    ]);
    const ownersById = new Map(owners.map((user) => [user.id, user]));
    return {
      // Le repository préserve l'ordre : ré-association PAR INDEX.
      items: cards.map((card, index) => ({
        ...card,
        owner: toPostAuthor(
          page.items[index].ownerId,
          ownersById.get(page.items[index].ownerId) ?? null,
        ),
        openReportsCount: openCounts[card.id] ?? 0,
      })),
      total: page.total,
    };
  }

  /** Détail backoffice (GET /admin/pages/:id) — tous statuts. */
  async getPage(id: string): Promise<AdminPageDetail> {
    const page = await this.pagesRepository.findById(id);
    if (!page) {
      throw new NotFoundException('Page introuvable');
    }
    return this.toDetail(page);
  }

  /** Masque ou republie une page (PATCH /admin/pages/:id/status) — miroir
   * strict des annonces : 'deleted' refusé (400), page supprimée → 409. */
  async updateStatus(
    id: string,
    dto: UpdatePageStatusDto,
  ): Promise<AdminPageDetail> {
    const page = await this.pagesRepository.findById(id);
    if (!page) {
      throw new NotFoundException('Page introuvable');
    }
    if (dto.status === 'deleted') {
      throw new BadRequestException(
        'La suppression appartient au propriétaire ou au flux RGPD',
      );
    }
    if (page.status === 'deleted') {
      throw new ConflictException(
        'Cette page a été supprimée : son statut ne peut plus être modifié',
      );
    }
    const updated = await this.pagesRepository.setStatus(id, dto.status);
    return this.toDetail(updated);
  }

  /** Accorde/retire le badge vérifié (PATCH /admin/pages/:id/verified) —
   * idempotent ; refusé sur une page supprimée (409, miroir du statut). */
  async updateVerified(
    id: string,
    dto: UpdatePageVerifiedDto,
  ): Promise<AdminPageDetail> {
    const page = await this.pagesRepository.findById(id);
    if (!page) {
      throw new NotFoundException('Page introuvable');
    }
    if (page.status === 'deleted') {
      throw new ConflictException(
        'Cette page a été supprimée : son badge ne peut plus être modifié',
      );
    }
    const updated = await this.pagesRepository.setVerified(id, dto.verified);
    return this.toDetail(updated);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Assemble le détail backoffice : PAGE (contexte modérateur : isOwner et
   * myFollow n'ont pas de sens ici — assemblés pour un « viewer » neutre) +
   * compteurs + historiques + signalements liés. */
  private async toDetail(page: Page): Promise<AdminPageDetail> {
    const now = new Date();
    const [view, counts, offers, events, reports, openCounts] =
      await Promise.all([
        // Viewer neutre : l'id du propriétaire n'est pas celui de l'admin —
        // isOwner/myFollow sortent false, ce qui est voulu au backoffice.
        this.assembler.assembleOne(page, ''),
        this.pagesRepository.countContents(page.id),
        this.pagesRepository.listOffers(page.id),
        this.pagesRepository.listEvents(page.id),
        this.reportsRepository.listByTarget('page', page.id),
        this.reportsRepository.countOpenByTargets('page', [page.id]),
      ]);
    const reporters = await this.usersRepository.findByIds([
      ...new Set(reports.map((report) => report.reporterId)),
    ]);
    const reportersById = new Map(reporters.map((user) => [user.id, user]));
    return {
      ...view,
      openReportsCount: openCounts[page.id] ?? 0,
      counts,
      offers: offers.map((offer) => toPageOfferView(offer, now)),
      events: events.map((event) => toPageEventView(event, now)),
      reports: reports.map((report) => ({
        id: report.id,
        reasonCode: report.reasonCode,
        message: report.message,
        status: report.status,
        createdAt: report.createdAt,
        reporter: toPostAuthor(
          report.reporterId,
          reportersById.get(report.reporterId) ?? null,
        ),
      })),
    };
  }
}

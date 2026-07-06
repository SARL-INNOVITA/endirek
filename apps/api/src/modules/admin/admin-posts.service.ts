import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  FeedPost,
  PostAuthor,
  toPostAuthor,
} from '../../common/mappers/post.mapper';
import {
  POSTS_REPOSITORY,
  REPORTS_REPOSITORY,
} from '../../database/database.tokens';
import {
  Post,
  Report,
  ReportReasonCode,
  ReportStatus,
} from '../../database/domain/entities';
import {
  PostsRepository,
  ReportsRepository,
} from '../../database/repositories/interfaces';
import { FeedPostAssembler } from '../posts/feed-post.assembler';
import { AdminListPostsQueryDto } from './dto/admin-list-posts-query.dto';
import { UpdatePostStatusDto } from './dto/update-post-status.dto';

/** FEED_POST enrichi pour le backoffice : nombre de signalements 'open'
 * visant la publication (colonne « à traiter » de la liste admin). */
export interface AdminFeedPost extends FeedPost {
  openReportsCount: number;
}

/** Liste backoffice paginée de publications. */
export interface PagedAdminFeedPosts {
  items: AdminFeedPost[];
  total: number;
}

/** Signalement lié affiché dans le détail backoffice d'une publication —
 * forme du contrat : { id, reasonCode, message, status, createdAt,
 * reporter: AUTEUR }. */
export interface AdminPostReportView {
  id: string;
  reasonCode: ReportReasonCode;
  message: string;
  status: ReportStatus;
  createdAt: Date;
  reporter: PostAuthor;
}

/** Détail backoffice d'une publication : FEED_POST + signalements liés. */
export interface AdminPostDetail extends AdminFeedPost {
  reports: AdminPostReportView[];
}

/**
 * Service publications du backoffice (Lot 1 étape 4) — réservé aux rôles
 * moderator et super_admin (RolesGuard sur le contrôleur).
 *
 * Contrairement aux routes publiques du module posts, l'admin voit TOUT :
 * tous les statuts ('active', 'hidden' et 'deleted' — audit), la forme
 * FEED_POST est la même que côté public (assemblée par FeedPostAssembler,
 * source unique) enrichie du nombre de signalements ouverts.
 *
 * Règles de statut :
 * - seuls 'active' et 'hidden' sont posables ici : la suppression d'une
 *   publication appartient à son AUTEUR (DELETE /posts/:id, soft-delete)
 *   ou au flux RGPD — jamais au backoffice → 400 ;
 * - une publication 'deleted' n'est jamais restaurée par le backoffice
 *   (miroir de la règle comptes supprimés du module admin-users) → 409.
 */
@Injectable()
export class AdminPostsService {
  constructor(
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
    private readonly assembler: FeedPostAssembler,
  ) {}

  /** Liste backoffice paginée (GET /admin/posts) — tous statuts, filtres
   * typeSlug/status et recherche titre/corps/nom d'auteur. */
  async listPosts(
    viewer: AuthenticatedUser,
    query: AdminListPostsQueryDto,
  ): Promise<PagedAdminFeedPosts> {
    const page = await this.postsRepository.listAdmin({
      typeSlug: query.typeSlug,
      status: query.status,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
    return {
      items: await this.toAdminFeedPosts(page.items, viewer),
      total: page.total,
    };
  }

  /** Détail backoffice (GET /admin/posts/:id) : FEED_POST quel que soit le
   * statut + signalements liés avec leur auteur — 404 seulement si l'id
   * n'existe pas. */
  async getPost(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<AdminPostDetail> {
    const post = await this.loadPost(id);
    const reports = await this.reportsRepository.listByTarget('post', id);
    const reporters = await this.assembler.loadAuthors([
      ...new Set(reports.map((report) => report.reporterId)),
    ]);
    const assembled = await this.assembler.assembleOne(post, viewer.userId);
    return {
      ...assembled,
      // Déjà chargés pour le détail : compter en mémoire évite un appel.
      openReportsCount: reports.filter((r) => r.status === 'open').length,
      reports: reports.map((report) => this.toReportView(report, reporters)),
    };
  }

  /**
   * Masque ou republie une publication (PATCH /admin/posts/:id/status).
   * Idempotent : reposer le statut courant renvoie simplement le post.
   * Un post masqué disparaît du feed, de la carte et du détail public
   * (404 pour tous sauf l'auteur et les modérateurs) mais RESTE en base.
   */
  async updateStatus(
    viewer: AuthenticatedUser,
    id: string,
    dto: UpdatePostStatusDto,
  ): Promise<AdminFeedPost> {
    if (dto.status === 'deleted') {
      throw new BadRequestException(
        "La suppression appartient à l'auteur ou au flux RGPD",
      );
    }
    const post = await this.loadPost(id);
    if (post.status === 'deleted') {
      // Publication supprimée par son auteur (ou le flux RGPD) :
      // définitivement hors jeu, le backoffice ne la restaure pas.
      throw new ConflictException(
        'Cette publication a été supprimée : son statut ne peut plus être modifié',
      );
    }
    const updated = await this.postsRepository.setStatus(id, dto.status);
    const [item] = await this.toAdminFeedPosts([updated], viewer);
    return item;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Charge une publication par id, TOUT statut confondu (backoffice) —
   * 404 uniquement si l'identifiant n'existe pas. */
  private async loadPost(id: string): Promise<Post> {
    const post = await this.postsRepository.findById(id);
    if (!post) {
      throw new NotFoundException('Publication introuvable');
    }
    return post;
  }

  /** Assemble une page de posts en FEED_POST (source unique) puis l'enrichit
   * du nombre de signalements 'open' — comptés PAR LOT (un seul appel). */
  private async toAdminFeedPosts(
    posts: Post[],
    viewer: AuthenticatedUser,
  ): Promise<AdminFeedPost[]> {
    const [items, openCounts] = await Promise.all([
      this.assembler.assemble(posts, viewer.userId),
      this.reportsRepository.countOpenByTargets(
        'post',
        posts.map((post) => post.id),
      ),
    ]);
    return items.map((item) => ({
      ...item,
      openReportsCount: openCounts[item.id] ?? 0,
    }));
  }

  /** Projette un signalement vers la forme du détail backoffice (reporter
   * en forme AUTEUR — repli défensif si le compte a disparu). */
  private toReportView(
    report: Report,
    reporters: Map<string, PostAuthor>,
  ): AdminPostReportView {
    return {
      id: report.id,
      reasonCode: report.reasonCode,
      message: report.message,
      status: report.status,
      createdAt: report.createdAt,
      reporter:
        reporters.get(report.reporterId) ??
        toPostAuthor(report.reporterId, null),
    };
  }
}

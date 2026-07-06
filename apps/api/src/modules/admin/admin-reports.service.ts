import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PostAuthor, toPostAuthor } from '../../common/mappers/post.mapper';
import {
  COMMENTS_REPOSITORY,
  POSTS_REPOSITORY,
  REPORTS_REPOSITORY,
} from '../../database/database.tokens';
import {
  CommentStatus,
  PostStatus,
  Report,
  ReportReasonCode,
  ReportStatus,
  ReportTargetType,
} from '../../database/domain/entities';
import {
  CommentsRepository,
  PostsRepository,
  ReportsRepository,
} from '../../database/repositories/interfaces';
import { FeedPostAssembler } from '../posts/feed-post.assembler';
import { AdminListReportsQueryDto } from './dto/admin-list-reports-query.dto';
import { HandleReportDto } from './dto/handle-report.dto';

/** Longueur maximale de l'extrait de corps affiché dans la file de
 * modération (le contenu complet se consulte via le détail de la cible). */
const TARGET_EXCERPT_MAX_LENGTH = 140;

/** Extrait d'une PUBLICATION signalée (file de modération). */
export interface ReportPostTarget {
  id: string;
  title: string | null;
  /** Corps tronqué à 140 caractères. */
  body: string;
  typeSlug: string;
  status: PostStatus;
  urlSlug: string;
}

/** Extrait d'un COMMENTAIRE signalé (file de modération). */
export interface ReportCommentTarget {
  id: string;
  /** Corps tronqué à 140 caractères. */
  body: string;
  status: CommentStatus;
  postId: string;
}

/** Extrait de la cible d'un signalement — null si la cible est introuvable
 * (ou de type 'user' : le signalement de profils n'ouvre qu'au Lot 2+). */
export type ReportTargetView = ReportPostTarget | ReportCommentTarget | null;

/** Signalement de la file de modération — forme du contrat, complétée des
 * champs de traitement (handledBy/handledAt/resolutionNote) pour que le
 * backoffice affiche qui a statué et quand. */
export interface AdminReportView {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: ReportReasonCode;
  message: string;
  status: ReportStatus;
  createdAt: Date;
  handledBy: string | null;
  handledAt: Date | null;
  resolutionNote: string | null;
  reporter: PostAuthor;
  target: ReportTargetView;
}

/** File de modération paginée. */
export interface PagedAdminReports {
  items: AdminReportView[];
  total: number;
}

/**
 * Service signalements du backoffice (Lot 1 étape 4) — réservé aux rôles
 * moderator et super_admin (RolesGuard sur le contrôleur).
 *
 * - la file est antéchronologique (createdAt DESC, tie-break id — tri fait
 *   par le repository), filtrable par statut et type de cible ;
 * - chaque signalement embarque son auteur (forme AUTEUR) et un EXTRAIT de
 *   la cible (corps ≤ 140 caractères) — null si la cible a physiquement
 *   disparu, ce qui n'arrive pas avec les soft-deletes du Lot 1 ;
 * - traiter un signalement pose status + handledBy (admin courant) +
 *   handledAt (now) + resolutionNote — le CONTENU visé n'est pas touché :
 *   le masquer est une action séparée (PATCH /admin/posts/:id/status).
 */
@Injectable()
export class AdminReportsService {
  constructor(
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    @Inject(COMMENTS_REPOSITORY)
    private readonly commentsRepository: CommentsRepository,
    private readonly assembler: FeedPostAssembler,
  ) {}

  /** File de modération paginée (GET /admin/reports). */
  async listReports(
    query: AdminListReportsQueryDto,
  ): Promise<PagedAdminReports> {
    const page = await this.reportsRepository.list({
      status: query.status,
      targetType: query.targetType,
      limit: query.limit,
      offset: query.offset,
    });
    return {
      items: await this.toViews(page.items),
      total: page.total,
    };
  }

  /**
   * Traite un signalement (PATCH /admin/reports/:id) : pose le statut
   * décidé, handledBy = admin courant, handledAt = now et la note de
   * résolution éventuelle. Re-traiter un signalement déjà traité est
   * permis (correction d'une décision) : les champs sont réécrits.
   */
  async handleReport(
    admin: AuthenticatedUser,
    id: string,
    dto: HandleReportDto,
  ): Promise<AdminReportView> {
    const report = await this.reportsRepository.findById(id);
    if (!report) {
      throw new NotFoundException('Signalement introuvable');
    }
    const handled = await this.reportsRepository.handle(id, {
      status: dto.status,
      handledBy: admin.userId,
      resolutionNote: dto.resolutionNote ?? null,
    });
    const [view] = await this.toViews([handled]);
    return view;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Projette une page de signalements : auteurs chargés PAR LOT (forme
   * AUTEUR), extrait de cible chargé par signalement (volumes bornés par
   * limit ≤ 100 — le driver postgres pourra regrouper par type de cible). */
  private async toViews(reports: Report[]): Promise<AdminReportView[]> {
    const [reporters, targets] = await Promise.all([
      this.assembler.loadAuthors([
        ...new Set(reports.map((report) => report.reporterId)),
      ]),
      Promise.all(reports.map((report) => this.loadTarget(report))),
    ]);
    return reports.map((report, index) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reasonCode: report.reasonCode,
      message: report.message,
      status: report.status,
      createdAt: report.createdAt,
      handledBy: report.handledBy,
      handledAt: report.handledAt,
      resolutionNote: report.resolutionNote,
      reporter:
        reporters.get(report.reporterId) ??
        toPostAuthor(report.reporterId, null),
      target: targets[index],
    }));
  }

  /** Extrait de la cible d'un signalement — null si introuvable ou de type
   * 'user' (pas d'extrait de profil au Lot 1, documenté). */
  private async loadTarget(report: Report): Promise<ReportTargetView> {
    if (report.targetType === 'post') {
      const post = await this.postsRepository.findById(report.targetId);
      if (!post) {
        return null;
      }
      return {
        id: post.id,
        title: post.title,
        body: excerpt(post.body),
        typeSlug: post.typeSlug,
        status: post.status,
        urlSlug: post.urlSlug,
      };
    }
    if (report.targetType === 'comment') {
      const comment = await this.commentsRepository.findById(report.targetId);
      if (!comment) {
        return null;
      }
      return {
        id: comment.id,
        body: excerpt(comment.body),
        status: comment.status,
        postId: comment.postId,
      };
    }
    // Cible 'user' : le signalement de profils n'ouvre qu'au Lot 2+.
    return null;
  }
}

/** Tronque un corps de texte à 140 caractères (ellipse comprise). */
function excerpt(text: string): string {
  if (text.length <= TARGET_EXCERPT_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, TARGET_EXCERPT_MAX_LENGTH - 1)}…`;
}

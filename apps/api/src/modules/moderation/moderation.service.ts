import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { REPORTS_REPOSITORY } from '../../database/database.tokens';
import { Report, ReportStatus } from '../../database/domain/entities';
import { UniqueViolationError } from '../../database/repositories/errors';
import { ReportsRepository } from '../../database/repositories/interfaces';
import { PostsService } from '../posts/posts.service';
import { CreateReportDto } from './dto/create-report.dto';

/** Réponse de POST /posts/:id/report ({ id, status: 'open' }). */
export interface CreatedReport {
  id: string;
  status: ReportStatus;
}

/**
 * Service signalements — contrat d'API étape 4 (côté utilisateur : la file
 * de traitement backoffice arrive à l'étape 6).
 *
 * - le post signalé RESTE 'active' tant qu'un admin n'agit pas : l'état de
 *   signalement vit dans la table reports, jamais dans posts.status ;
 * - auto-signalement REFUSÉ (décision produit) : signaler sa propre
 *   publication → 400 — cela ne produirait que du bruit backoffice,
 *   l'auteur dispose déjà de la suppression de son post ;
 * - anti-doublon : un même utilisateur ne peut signaler la même cible
 *   qu'UNE fois → 409 (miroir de la contrainte UNIQUE
 *   reports_reporter_target_unique de la migration), y compris sous
 *   concurrence (UniqueViolationError du repository rattrapée) ;
 * - statut initial 'open' — ÉQUIVALENCE DOCUMENTÉE : 'open' correspond au
 *   « pending » de la spécification produit (le schéma a retenu open →
 *   reviewed / action_taken / dismissed).
 */
@Injectable()
export class ModerationService {
  constructor(
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
    private readonly postsService: PostsService,
  ) {}

  /** Signale une publication visible (POST /posts/:id/report). */
  async reportPost(
    viewer: AuthenticatedUser,
    postId: string,
    dto: CreateReportDto,
  ): Promise<CreatedReport> {
    const post = await this.postsService.loadVisiblePost(viewer, postId);

    // Décision produit : l'auto-signalement est refusé (bruit backoffice
    // sans valeur de modération — l'auteur peut supprimer son propre post).
    if (viewer.userId === post.authorId) {
      throw new BadRequestException(
        'Vous ne pouvez pas signaler votre propre publication',
      );
    }

    if (
      await this.reportsRepository.existsByReporterAndTarget(
        viewer.userId,
        'post',
        post.id,
      )
    ) {
      throw new ConflictException('Vous avez déjà signalé ce contenu');
    }

    // La vérification amont ne suffit pas sous concurrence (deux requêtes
    // simultanées peuvent toutes deux la passer) : la violation d'unicité
    // levée par la COUCHE REPOSITORY (mock aujourd'hui, postgres demain) est
    // traduite en 409 plutôt que de fuir en 500.
    let report: Report;
    try {
      report = await this.reportsRepository.create({
        reporterId: viewer.userId,
        targetType: 'post',
        targetId: post.id,
        reasonCode: dto.reasonCode,
        message: dto.message,
      });
    } catch (error) {
      if (error instanceof UniqueViolationError) {
        throw new ConflictException('Vous avez déjà signalé ce contenu');
      }
      throw error;
    }

    return { id: report.id, status: report.status };
  }
}

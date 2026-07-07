import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FullProfile,
  toFullProfile,
} from '../../common/mappers/profile.mapper';
import {
  POSTS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import { User, UserRole, UserStatus } from '../../database/domain/entities';
import {
  PostsRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { AdminSettableStatus } from './dto/update-user-status.dto';

/** Liste paginée de profils COMPLETS (réservée au backoffice). */
export interface PagedFullProfiles {
  items: FullProfile[];
  total: number;
}

/** Paramètres de la liste backoffice (search/status + pagination bornée). */
export interface AdminListUsersParams {
  search?: string;
  status?: UserStatus;
  role?: UserRole;
  limit: number;
  offset: number;
}

/**
 * Service utilisateurs du backoffice (Lot 1 étape 3) — réservé aux rôles
 * moderator et super_admin (RolesGuard sur le contrôleur).
 *
 * Contrairement aux routes publiques du module users, l'admin voit TOUT :
 * la forme renvoyée est le PROFIL COMPLET (email, role, status, settings)
 * et les comptes suspendus/supprimés restent visibles (audit, modération).
 *
 * Règles de statut :
 * - seuls 'active' et 'suspended' sont posables ici (le DTO les impose) ;
 * - la suppression d'un compte passe EXCLUSIVEMENT par le flux RGPD
 *   (DELETE /users/me) — un compte 'deleted' n'est donc jamais réactivable
 *   par le backoffice (il a été anonymisé, il n'y a plus rien à réactiver) ;
 * - le statut d'un super_admin est INTOUCHABLE (aucun modérateur — ni même
 *   un autre super_admin — ne peut suspendre le compte racine).
 */
@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
  ) {}

  /** Liste paginée des comptes (GET /admin/users) — PROFILS COMPLETS. */
  async listUsers(params: AdminListUsersParams): Promise<PagedFullProfiles> {
    const page = await this.usersRepository.list({
      search: params.search,
      status: params.status,
      role: params.role,
      limit: params.limit,
      offset: params.offset,
    });
    return {
      items: await this.toFullProfiles(page.items),
      total: page.total,
    };
  }

  /** PROFIL COMPLET d'un compte, quel que soit son statut
   * (GET /admin/users/:id) — 404 uniquement si l'id n'existe pas. */
  async getUser(userId: string): Promise<FullProfile> {
    const user = await this.loadUser(userId);
    return toFullProfile(user, await this.postsCount(user.id));
  }

  /**
   * Change le statut d'un compte (PATCH /admin/users/:id/status).
   * Idempotent : reposer le statut courant renvoie simplement le profil.
   */
  async updateStatus(
    userId: string,
    status: AdminSettableStatus,
  ): Promise<FullProfile> {
    const user = await this.loadUser(userId);
    if (user.role === 'super_admin') {
      throw new ForbiddenException(
        "Impossible de modifier le statut d'un super administrateur",
      );
    }
    if (user.status === 'deleted') {
      // Compte passé par le flux RGPD : anonymisé, définitivement hors jeu.
      throw new ConflictException(
        "Ce compte a été supprimé : son statut ne peut plus être modifié",
      );
    }
    const updated = await this.usersRepository.update(userId, { status });
    return toFullProfile(updated, await this.postsCount(updated.id));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Charge un compte par id — 404 s'il n'existe pas (les comptes suspendus
   * ou supprimés restent visibles du backoffice, contrairement au public). */
  private async loadUser(userId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  /** Nombre de publications 'active' d'un utilisateur (postsCount du profil). */
  private postsCount(userId: string): Promise<number> {
    return this.postsRepository.countByAuthor(userId);
  }

  /** Projette une page d'entités User vers des PROFILS COMPLETS
   * (postsCount calculé pour chacun — volumes bornés par limit ≤ 100). */
  private toFullProfiles(users: User[]): Promise<FullProfile[]> {
    return Promise.all(
      users.map(async (user) =>
        toFullProfile(user, await this.postsCount(user.id)),
      ),
    );
  }
}

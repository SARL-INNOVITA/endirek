import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  FullProfile,
  PublicProfile,
  toFullProfile,
  toPublicProfile,
} from '../../common/mappers/profile.mapper';
import {
  COMMENTS_REPOSITORY,
  NOTIFICATIONS_REPOSITORY,
  POSTS_REPOSITORY,
  REACTIONS_REPOSITORY,
  REPORTS_REPOSITORY,
  SAVED_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import {
  Comment,
  Notification,
  Post,
  Reaction,
  Report,
  User,
} from '../../database/domain/entities';
import {
  CommentsRepository,
  NotificationsRepository,
  PageParams,
  PostsRepository,
  ReactionsRepository,
  ReportsRepository,
  SavedRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Plafond d'agrégation de l'export RGPD : les repositories paginés sont lus
 * en une seule page « large » — très au-delà des volumes du Lot 1 (mock).
 * À la bascule postgres, l'export bouclera par pages si nécessaire.
 */
const EXPORT_PAGE_LIMIT = 10_000;

/** Liste publique paginée de profils (followers / following). */
export interface PagedPublicProfiles {
  items: PublicProfile[];
  total: number;
}

/** Référence minimale d'un compte dans l'export RGPD (pas de données privées
 * de TIERS dans l'export d'un utilisateur : id + nom affiché uniquement). */
interface ExportedAccountRef {
  id: string;
  displayName: string;
}

/** Référence minimale d'un post enregistré (le post appartient à un tiers :
 * seul le LIEN d'enregistrement est une donnée de l'utilisateur exporté). */
interface ExportedSavedPostRef {
  id: string;
  title: string | null;
  urlSlug: string;
  savedInCollection: string;
}

/** Export RGPD complet du compte (GET /users/me/export). */
export interface AccountExport {
  format: 'endirek-export';
  version: 1;
  exportedAt: string;
  /** Le compte lui-même — TOUT sauf le hash du mot de passe. */
  account: Omit<User, 'passwordHash'> & { postsCount: number };
  posts: Post[];
  comments: Comment[];
  reactions: Reaction[];
  follows: {
    following: { total: number; accounts: ExportedAccountRef[] };
    followers: { total: number; accounts: ExportedAccountRef[] };
  };
  savedCollections: Array<{
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: Date;
    savedPosts: ExportedSavedPostRef[];
  }>;
  notifications: Notification[];
  reportsSubmitted: Report[];
}

/**
 * Service utilisateurs — profils (complet / public), follows, listes
 * paginées, export RGPD et suppression RGPD (contrat d'API étape 3).
 *
 * Règle de visibilité : un compte 'deleted' ou 'suspended' est INVISIBLE
 * pour les tiers (404 sur son profil public, absent des listes publiques).
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    @Inject(COMMENTS_REPOSITORY)
    private readonly commentsRepository: CommentsRepository,
    @Inject(REACTIONS_REPOSITORY)
    private readonly reactionsRepository: ReactionsRepository,
    @Inject(SAVED_REPOSITORY)
    private readonly savedRepository: SavedRepository,
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly notificationsRepository: NotificationsRepository,
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Profils
  // ──────────────────────────────────────────────────────────────────────────

  /** PROFIL COMPLET de l'utilisateur courant (GET /users/me/profile). */
  async getMyProfile(userId: string): Promise<FullProfile> {
    const user = await this.loadOwnUser(userId);
    return toFullProfile(user, await this.postsCount(user.id));
  }

  /** Met à jour le profil de l'utilisateur courant (PATCH /users/me/profile). */
  async updateMyProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<FullProfile> {
    await this.loadOwnUser(userId);
    // Les champs undefined sont ignorés par la couche persistance (sémantique
    // PATCH) ; null est une remise à vide légitime des champs nullables.
    const updated = await this.usersRepository.update(userId, {
      displayName: dto.displayName,
      bio: dto.bio,
      city: dto.city,
      // « Ce que je recherche » (profil Dealplace — CP2.2) : une chaîne vide
      // après trim équivaut à un effacement (null), comme un champ vidé.
      dealplaceSeeking:
        dto.dealplaceSeeking === undefined
          ? undefined
          : dto.dealplaceSeeking || null,
      avatarUrl: dto.avatarUrl,
      coverUrl: dto.coverUrl,
      settings: dto.settings,
    });
    return toFullProfile(updated, await this.postsCount(updated.id));
  }

  /** PROFIL PUBLIC d'un utilisateur (GET /users/:id) — 404 si le compte
   * n'existe pas, est supprimé ou est suspendu. */
  async getPublicProfile(userId: string): Promise<PublicProfile> {
    const user = await this.loadVisibleUser(userId);
    return toPublicProfile(user, await this.postsCount(user.id));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Follows
  // ──────────────────────────────────────────────────────────────────────────

  /** Suivre un utilisateur (POST /users/:id/follow) — idempotent. */
  async follow(currentUserId: string, targetUserId: string): Promise<void> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('Impossible de se suivre soi-même');
    }
    await this.loadVisibleUser(targetUserId);
    // Le repository est idempotent (re-suivre ne crée pas de doublon) et
    // maintient les compteurs followers/following dénormalisés à jour.
    await this.usersRepository.follow(currentUserId, targetUserId);
  }

  /** Ne plus suivre un utilisateur (DELETE /users/:id/follow) — idempotent.
   * Volontairement permis quel que soit le STATUT de la cible (on peut se
   * désabonner d'un compte suspendu/supprimé) ; 404 seulement si l'id
   * n'existe pas du tout. */
  async unfollow(currentUserId: string, targetUserId: string): Promise<void> {
    const target = await this.usersRepository.findById(targetUserId);
    if (!target) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    await this.usersRepository.unfollow(currentUserId, targetUserId);
  }

  /** Followers d'un utilisateur (GET /users/:id/followers) — profils PUBLICS. */
  async listFollowers(
    userId: string,
    params: PageParams,
  ): Promise<PagedPublicProfiles> {
    await this.loadVisibleUser(userId);
    const page = await this.usersRepository.listFollowers(userId, params);
    return {
      items: await this.toPublicProfiles(page.items),
      total: page.total,
    };
  }

  /** Comptes suivis par un utilisateur (GET /users/:id/following). */
  async listFollowing(
    userId: string,
    params: PageParams,
  ): Promise<PagedPublicProfiles> {
    await this.loadVisibleUser(userId);
    const page = await this.usersRepository.listFollowing(userId, params);
    return {
      items: await this.toPublicProfiles(page.items),
      total: page.total,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RGPD — export et suppression
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Export RGPD (GET /users/me/export) : agrège TOUTES les données du compte
   * via les repositories (jamais d'accès direct aux stores) — droit d'accès
   * et de portabilité (articles 15 et 20 du RGPD).
   *
   * Les contenus de TIERS ne sont référencés que de façon minimale (id + nom
   * pour les follows, id + titre pour les posts enregistrés) : l'export d'un
   * utilisateur ne doit pas embarquer les données personnelles des autres.
   */
  async exportMyData(userId: string): Promise<AccountExport> {
    const user = await this.loadOwnUser(userId);

    const [
      postsCount,
      posts,
      comments,
      reactions,
      following,
      followers,
      collections,
      notifications,
      reportsSubmitted,
    ] = await Promise.all([
      this.postsCount(userId),
      this.postsRepository.listByAuthor(userId),
      this.commentsRepository.listByAuthor(userId),
      this.reactionsRepository.listByUser(userId),
      this.usersRepository.listFollowing(userId, {
        limit: EXPORT_PAGE_LIMIT,
        offset: 0,
      }),
      this.usersRepository.listFollowers(userId, {
        limit: EXPORT_PAGE_LIMIT,
        offset: 0,
      }),
      this.savedRepository.listCollections(userId),
      this.notificationsRepository.listByUser(userId, {
        limit: EXPORT_PAGE_LIMIT,
        offset: 0,
      }),
      this.reportsRepository.listByReporter(userId),
    ]);

    // Collections + liens d'enregistrement (référence minimale des posts).
    const savedCollections: AccountExport['savedCollections'] = [];
    for (const collection of collections) {
      const savedPosts = await this.savedRepository.listSavedPosts(
        collection.id,
      );
      savedCollections.push({
        id: collection.id,
        name: collection.name,
        isDefault: collection.isDefault,
        createdAt: collection.createdAt,
        savedPosts: savedPosts.map((post) => ({
          id: post.id,
          title: post.title,
          urlSlug: post.urlSlug,
          savedInCollection: collection.name,
        })),
      });
    }

    // Le hash du mot de passe ne sort JAMAIS du serveur, même pour son
    // propriétaire (aucune valeur d'usage, risque en cas de fuite du fichier).
    const { passwordHash: _passwordHashJamaisExporte, ...account } = user;
    void _passwordHashJamaisExporte;

    return {
      format: 'endirek-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { ...account, postsCount },
      posts,
      comments,
      reactions,
      follows: {
        following: {
          total: following.total,
          accounts: following.items.map((u) => ({
            id: u.id,
            displayName: u.displayName,
          })),
        },
        followers: {
          total: followers.total,
          accounts: followers.items.map((u) => ({
            id: u.id,
            displayName: u.displayName,
          })),
        },
      },
      savedCollections,
      notifications,
      reportsSubmitted,
    };
  }

  /**
   * Suppression RGPD (DELETE /users/me) — SOFT-DELETE + ANONYMISATION.
   *
   * Stratégie (documentée, contrat étape 3) :
   * - le compte est anonymisé : displayName « Utilisateur supprimé », email
   *   technique deleted-<id>@endirek.invalid (TLD réservé RFC 2606, jamais
   *   routable), bio vidée, avatar/couverture/ville/position effacés,
   *   settings remis à {} ;
   * - puis marqué status 'deleted' + deletedAt (softDelete) : la ligne reste ;
   * - les POSTS et COMMENTAIRES sont CONSERVÉS : le feed et les fils de
   *   discussion ne cassent pas, l'auteur y apparaît simplement anonymisé
   *   (« Utilisateur supprimé », sans avatar) ;
   * - les jetons encore en circulation cessent de fonctionner immédiatement :
   *   le guard JWT global recharge l'utilisateur et revérifie son statut à
   *   CHAQUE requête (compte 'deleted' → 401), sans liste de révocation ;
   * - la suppression DÉFINITIVE des données (purge de la ligne et des
   *   contenus) relève d'une procédure manuelle d'administration qui sera
   *   documentée ultérieurement (hors périmètre Lot 1).
   */
  async deleteMyAccount(userId: string): Promise<void> {
    await this.loadOwnUser(userId);
    await this.usersRepository.update(userId, {
      displayName: 'Utilisateur supprimé',
      email: `deleted-${userId}@endirek.invalid`,
      bio: '',
      avatarUrl: null,
      coverUrl: null,
      city: null,
      location: null,
      settings: {},
    });
    await this.usersRepository.softDelete(userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Charge l'utilisateur COURANT — filet de sécurité : le guard global a
   * déjà validé son existence et son statut à l'entrée de la requête. */
  private async loadOwnUser(userId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.status === 'deleted') {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
    return user;
  }

  /** Charge un utilisateur VISIBLE par les tiers : 404 (sans distinction de
   * cause) si le compte n'existe pas, est supprimé ou est suspendu. */
  private async loadVisibleUser(userId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.status !== 'active') {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  /** Nombre de publications 'active' d'un utilisateur (postsCount du profil). */
  private postsCount(userId: string): Promise<number> {
    return this.postsRepository.countByAuthor(userId);
  }

  /** Projette une page d'entités User vers des PROFILS PUBLICS (postsCount
   * calculé pour chacun — volumes bornés par limit ≤ 100). */
  private toPublicProfiles(users: User[]): Promise<PublicProfile[]> {
    return Promise.all(
      users.map(async (user) =>
        toPublicProfile(user, await this.postsCount(user.id)),
      ),
    );
  }
}

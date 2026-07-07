import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { findNearestCommune } from '../../common/geo/nearest-commune';
import { isWithinReunion } from '../../common/geo/reunion';
import { FeedPost } from '../../common/mappers/post.mapper';
import { AppConfig } from '../../config/configuration';
import {
  POST_TYPES_REPOSITORY,
  POSTS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import { Post, PostStatus } from '../../database/domain/entities';
import {
  CreatePostMediaSpec,
  PageParams,
  PostsRepository,
  PostTypesRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreatePostDto, PostMediaInputDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FeedPostAssembler } from './feed-post.assembler';
import { randomSlugSuffix, slugify, slugSource } from './slug.util';

/** Nombre de tentatives de génération d'un urlSlug unique avant d'abandonner
 * (36^4 suffixes possibles par base : une collision répétée est improbable). */
const SLUG_MAX_ATTEMPTS = 5;

/** Type de publication du contrat (GET /posts/types) — le mobile construit
 * sa bottom sheet de composition avec cette liste, rien n'est hardcodé. */
export interface PostTypeView {
  slug: string;
  labelFr: string;
  icon: string;
  color: string;
  requiresLocationForMap: boolean;
  showsOnMap: boolean;
  defaultMapDurationMinutes: number | null;
  position: number;
}

/** Liste paginée de FEED_POST ({ items, total }). */
export interface PagedFeedPosts {
  items: FeedPost[];
  total: number;
}

/**
 * Service publications — création, lecture (visibilité par statut),
 * modification, suppression douce et listes de profil (contrat étape 4).
 *
 * Visibilité d'un post :
 * - 'active'  : visible de tous ;
 * - 'hidden'  : 404 pour tous SAUF l'auteur et les rôles moderator/super_admin ;
 * - 'deleted' : 404 pour tout le monde (soft-delete).
 */
@Injectable()
export class PostsService {
  constructor(
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    @Inject(POST_TYPES_REPOSITORY)
    private readonly postTypesRepository: PostTypesRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    private readonly assembler: FeedPostAssembler,
    private readonly configService: ConfigService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Types de publication
  // ──────────────────────────────────────────────────────────────────────────

  /** Types ACTIFS triés par position (GET /posts/types) — table de référence
   * pilotable par le backoffice, jamais hardcodée dans le code métier. */
  async listTypes(): Promise<PostTypeView[]> {
    const types = await this.postTypesRepository.listActive();
    return types.map((type) => ({
      slug: type.slug,
      labelFr: type.labelFr,
      icon: type.icon,
      color: type.color,
      requiresLocationForMap: type.requiresLocationForMap,
      showsOnMap: type.showsOnMap,
      defaultMapDurationMinutes: type.defaultMapDurationMinutes,
      position: type.position,
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Création
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Crée une publication (POST /posts). Règles du contrat :
   * - le type doit exister ET être actif (400 sinon) ;
   * - type showsOnMap + location fournie → mapExpiresAt = now +
   *   defaultMapDurationMinutes DU TYPE (piloté par post_types, aucun
   *   « 120 » en dur) ; SANS location → mapExpiresAt null : le post est
   *   feed-only, ce qui est LÉGAL (aucun blocage) ;
   * - location fournie → elle doit se situer dans l'emprise de La Réunion
   *   (REUNION_BBOX, 400 sinon — produit mono-île au Lot 1) ;
   * - location fournie sans city (ou city vide/blanche) → city déduite de
   *   la commune la plus proche (référentiel des 12 communes + haversine —
   *   l'adapter de géocodage formel arrive à l'étape 5) ;
   * - urlSlug : slugify(titre ou premiers mots du corps) + suffixe aléatoire
   *   de 4 caractères, unicité garantie par retry ;
   * - médias ≤ 4 (validé par le DTO), position = index si absente ; chaque
   *   URL (url, thumbnailUrl) doit provenir de l'upload Endirek
   *   (assertUploadedMediaUrls, 400 sinon).
   */
  async create(userId: string, dto: CreatePostDto): Promise<FeedPost> {
    const type = await this.postTypesRepository.findBySlug(dto.typeSlug);
    if (!type || !type.isActive) {
      throw new BadRequestException(
        `Type de publication invalide ou inactif : « ${dto.typeSlug} »`,
      );
    }

    const location = dto.location
      ? { lat: dto.location.lat, lng: dto.location.lng }
      : null;

    // Garde mono-île du Lot 1 : une position hors de l'emprise de La Réunion
    // est refusée AVANT toute déduction — sinon le marqueur serait servi par
    // /map/posts et la commune la plus proche serait absurde (voir
    // isWithinReunion / REUNION_BBOX, common/geo/reunion.ts). La déduction de
    // city ne s'exécute donc que sur des positions plausibles.
    if (location && !isWithinReunion(location)) {
      throw new BadRequestException(
        'La position doit se situer à La Réunion',
      );
    }

    // Règle carte pilotée par la table post_types : la durée de visibilité
    // vient du type (defaultMapDurationMinutes), jamais d'une constante.
    let mapExpiresAt: Date | null = null;
    if (location && type.showsOnMap && type.defaultMapDurationMinutes !== null) {
      mapExpiresAt = new Date(
        Date.now() + type.defaultMapDurationMinutes * 60_000,
      );
    }

    // Ville affichée : fournie, sinon déduite de la commune la plus proche.
    // Normalisation : une chaîne vide ou blanche vaut « non fournie » (elle
    // ne doit pas court-circuiter la déduction automatique).
    const cityInput = dto.city?.trim() || null;
    const city =
      cityInput ?? (location ? findNearestCommune(location).name : null);

    const urlSlug = await this.generateUniqueSlug(dto.title, dto.body);

    // Anti-injection d'URL externe : chaque média (url ET thumbnailUrl) doit
    // provenir de l'upload Endirek — 400 sinon (voir assertUploadedMediaUrls).
    this.assertUploadedMediaUrls(dto.media ?? []);

    const media: CreatePostMediaSpec[] = (dto.media ?? []).map(
      (item, index) => ({
        mediaType: item.mediaType ?? 'image',
        url: item.url,
        thumbnailUrl: item.thumbnailUrl ?? null,
        width: item.width ?? null,
        height: item.height ?? null,
        position: item.position ?? index,
      }),
    );

    const post = await this.postsRepository.create({
      authorId: userId,
      typeSlug: dto.typeSlug,
      title: dto.title ?? null,
      body: dto.body,
      location,
      city,
      mapExpiresAt,
      urlSlug,
      media,
    });

    // Événement léger 'map.updated' : un post nouvellement VISIBLE sur la
    // carte (mapExpiresAt futur) invite les clients de la carte à recharger
    // leurs marqueurs. Émis après persistance ; sans effet sur les posts
    // feed-only (mapExpiresAt null). Recommandé, non bloquant.
    if (mapExpiresAt !== null && mapExpiresAt.getTime() > Date.now()) {
      this.realtime.emitMapUpdated('post.created');
    }

    return this.assembler.assembleOne(post, userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lecture
  // ──────────────────────────────────────────────────────────────────────────

  /** Détail d'un post par id (GET /posts/:id) — règles de visibilité. */
  async getById(viewer: AuthenticatedUser, id: string): Promise<FeedPost> {
    const post = await this.loadVisiblePost(viewer, id);
    return this.assembler.assembleOne(post, viewer.userId);
  }

  /**
   * Charge l'ENTITÉ post en appliquant les règles de visibilité du contrat
   * (404 si invisible pour ce viewer) — mutualisé avec les modules
   * commentaires, réactions, enregistrements et signalements, qui ciblent
   * tous « un post que le viewer peut voir » sans avoir besoin du FEED_POST
   * assemblé.
   */
  async loadVisiblePost(viewer: AuthenticatedUser, id: string): Promise<Post> {
    const post = await this.postsRepository.findById(id);
    return this.assertVisible(post, viewer);
  }

  /** Détail d'un post par urlSlug (GET /posts/slug/:slug) — mêmes règles. */
  async getBySlug(viewer: AuthenticatedUser, slug: string): Promise<FeedPost> {
    const post = await this.postsRepository.findByUrlSlug(slug);
    return this.assembler.assembleOne(
      this.assertVisible(post, viewer),
      viewer.userId,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Modification / suppression (auteur uniquement)
  // ──────────────────────────────────────────────────────────────────────────

  /** Modifie title/body (PATCH /posts/:id) — AUTEUR uniquement (403 sinon).
   * Type et location ne sont PAS modifiables au MVP (voir UpdatePostDto). */
  async update(
    viewer: AuthenticatedUser,
    id: string,
    dto: UpdatePostDto,
  ): Promise<FeedPost> {
    await this.loadOwnPost(viewer, id);
    const updated = await this.postsRepository.update(id, {
      title: dto.title,
      body: dto.body,
    });
    return this.assembler.assembleOne(updated, viewer.userId);
  }

  /** Supprime un post (DELETE /posts/:id) — AUTEUR uniquement, soft-delete
   * status='deleted' : la ligne reste (RGPD/audit), le post disparaît du
   * feed, de la carte et du détail (404). */
  async remove(viewer: AuthenticatedUser, id: string): Promise<void> {
    await this.loadOwnPost(viewer, id);
    await this.postsRepository.setStatus(id, 'deleted');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Listes de profil
  // ──────────────────────────────────────────────────────────────────────────

  /** Posts 'active' d'un profil visible (GET /users/:id/posts). */
  async listUserPosts(
    viewer: AuthenticatedUser,
    targetUserId: string,
    params: PageParams,
  ): Promise<PagedFeedPosts> {
    const user = await this.usersRepository.findById(targetUserId);
    if (!user || user.status !== 'active') {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return this.pageAuthorPosts(viewer, targetUserId, ['active'], params);
  }

  /** Mes posts 'active' + 'hidden' (GET /users/me/posts) — le statut figure
   * dans chaque FEED_POST ; les 'deleted' restent exclus. */
  async listMyPosts(
    viewer: AuthenticatedUser,
    params: PageParams,
  ): Promise<PagedFeedPosts> {
    return this.pageAuthorPosts(
      viewer,
      viewer.userId,
      ['active', 'hidden'],
      params,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Page de posts d'un auteur filtrée par statuts, assemblée en FEED_POST. */
  private async pageAuthorPosts(
    viewer: AuthenticatedUser,
    authorId: string,
    statuses: PostStatus[],
    params: PageParams,
  ): Promise<PagedFeedPosts> {
    const page = await this.postsRepository.listByAuthorPaged(authorId, {
      statuses,
      limit: params.limit,
      offset: params.offset,
    });
    return {
      items: await this.assembler.assemble(page.items, viewer.userId),
      total: page.total,
    };
  }

  /**
   * Applique les règles de visibilité du contrat : null ou 'deleted' → 404 ;
   * 'hidden' → 404 sauf pour l'AUTEUR et les rôles moderator/super_admin
   * (même message dans tous les cas : ne pas révéler l'existence d'un
   * contenu masqué).
   */
  private assertVisible(
    post: Post | null,
    viewer: AuthenticatedUser,
  ): Post {
    if (!post || post.status === 'deleted') {
      throw new NotFoundException('Publication introuvable');
    }
    if (
      post.status === 'hidden' &&
      post.authorId !== viewer.userId &&
      viewer.role !== 'moderator' &&
      viewer.role !== 'super_admin'
    ) {
      throw new NotFoundException('Publication introuvable');
    }
    return post;
  }

  /** Charge un post pour une MUTATION par son auteur : 404 si absent,
   * supprimé ou masqué-et-viewer-tiers, 403 si le viewer n'en est pas
   * l'auteur. */
  private async loadOwnPost(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<Post> {
    const post = await this.postsRepository.findById(id);
    if (!post || post.status === 'deleted') {
      throw new NotFoundException('Publication introuvable');
    }
    // Ne pas révéler l'existence d'un post masqué par la modération : pour
    // un NON-auteur, PATCH/DELETE répondent le même 404 que GET (un 403
    // confirmerait l'existence du contenu). Le 403 ci-dessous reste réservé
    // aux posts 'active' d'autrui.
    if (post.status === 'hidden' && post.authorId !== viewer.userId) {
      throw new NotFoundException('Publication introuvable');
    }
    if (post.authorId !== viewer.userId) {
      throw new ForbiddenException(
        "Seul l'auteur peut modifier ou supprimer cette publication",
      );
    }
    return post;
  }

  /**
   * Refuse (400) tout média dont l'url ou la thumbnailUrl ne provient pas de
   * l'upload Endirek (base `${app.publicUrl}/uploads/` — fichiers écrits par
   * POST /media/upload) : sans cette garde, un client pourrait faire rendre
   * du contenu externe non maîtrisé (http://evil.com/x.png) par tous les
   * autres clients.
   *
   * NB : le seed de démonstration (picsum.photos) insère ses posts
   * DIRECTEMENT dans le store, sans passer par ce service — il n'est pas
   * concerné. TODO (prod S3) : la base autorisée deviendra l'URL publique du
   * bucket (S3_PUBLIC_URL) quand l'adapter s3 sera implémenté.
   */
  private assertUploadedMediaUrls(media: PostMediaInputDto[]): void {
    if (media.length === 0) {
      return;
    }
    const { publicUrl } = this.configService.getOrThrow<AppConfig>('app');
    const allowedBase = `${publicUrl.replace(/\/+$/, '')}/uploads/`;
    for (const item of media) {
      const urls = [item.url, item.thumbnailUrl].filter(
        (value): value is string => value !== undefined,
      );
      if (urls.some((value) => !value.startsWith(allowedBase))) {
        throw new BadRequestException(
          "Les médias doivent provenir de l'upload Endirek (/media/upload)",
        );
      }
    }
  }

  /** Génère un urlSlug unique : base lisible + suffixe aléatoire, retry avec
   * un nouveau suffixe tant que le slug existe (contrainte UNIQUE). */
  private async generateUniqueSlug(
    title: string | undefined,
    body: string,
  ): Promise<string> {
    const base = slugify(slugSource(title ?? null, body));
    for (let attempt = 0; attempt < SLUG_MAX_ATTEMPTS; attempt++) {
      const candidate = `${base}-${randomSlugSuffix()}`;
      if (!(await this.postsRepository.findByUrlSlug(candidate))) {
        return candidate;
      }
    }
    // Improbable (5 collisions d'affilée) : suffixe élargi en dernier recours.
    return `${base}-${randomSlugSuffix()}${randomSlugSuffix()}`;
  }
}

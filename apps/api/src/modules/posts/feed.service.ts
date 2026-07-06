import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  POST_TYPES_REPOSITORY,
  POSTS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import { GeoPoint, Post, PostType } from '../../database/domain/entities';
import { haversineMeters } from '../../database/mock/geo';
import {
  PostsRepository,
  PostTypesRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { FeedPostAssembler } from './feed-post.assembler';
import { PagedFeedPosts } from './posts.service';

/**
 * POIDS DU SCORING DU FEED — source unique, AUCUNE valeur magique dispersée
 * dans le code. Structure extensible : ajuster ici suffit à re-régler le feed.
 *
 * Score d'un post = récence + proximité + type + popularité + abonnements :
 * - RÉCENCE : décroissance exponentielle — un post perd la moitié de son
 *   score de récence toutes les `recencyHalfLifeHours` heures (~6 h) ;
 * - PROXIMITÉ : si le viewer fournit lat/lng, bonus qui décroît
 *   exponentiellement avec la distance haversine au post (divisé par 2 tous
 *   les `proximityHalfDistanceKm` km) — les posts sans location n'ont pas
 *   de bonus ;
 * - TYPE : léger bonus des types d'alerte (showsOnMap, piloté par la table
 *   post_types) encore VISIBLES sur la carte (mapExpiresAt > now) ;
 * - POPULARITÉ : log(1 + réactions + commentaires) — croissance amortie,
 *   un post viral n'écrase pas tout ;
 * - ABONNEMENTS : bonus fixe si l'auteur est suivi par le viewer.
 *
 * NOTE PORTAGE POSTGRES : le driver SQL portera ce même scoring dans une
 * requête (fenêtre ORDER BY created_at DESC LIMIT windowSize, puis score en
 * expression SQL : EXP(), ST_Distance, LN(), EXISTS(follows)) — les poids
 * resteront centralisés ici.
 */
export const FEED_WEIGHTS = {
  /** Taille de la fenêtre scorée : les N posts actifs les plus récents. */
  windowSize: 200,
  /** Poids de la récence (score max d'un post tout juste publié). */
  recency: 100,
  /** Demi-vie de la récence, en heures. */
  recencyHalfLifeHours: 6,
  /** Bonus max de proximité (viewer exactement sur le post). */
  proximity: 30,
  /** Distance (km) à laquelle le bonus de proximité est divisé par 2. */
  proximityHalfDistanceKm: 10,
  /** Bonus des types d'alerte encore visibles carte. */
  activeAlert: 25,
  /** Multiplicateur de log(1 + réactions + commentaires). */
  popularity: 8,
  /** Bonus si l'auteur du post est suivi par le viewer. */
  followedAuthor: 20,
} as const;

/** Paramètres du feed (déjà validés par FeedQueryDto). */
export interface FeedParams {
  limit: number;
  offset: number;
  lat?: number;
  lng?: number;
}

/**
 * Service du fil d'actualité (GET /posts/feed) — scoring MVP du contrat
 * étape 4, implémentation mock : fenêtre des `windowSize` posts 'active'
 * les plus récents, scorée EN MÉMOIRE, triée score DESC avec tie-break
 * (createdAt DESC, id) pour un ordre STABLE entre deux appels identiques,
 * puis paginée offset/limit. `total` = taille de la fenêtre scorée.
 *
 * (Le module feed/ prévu au départ est fusionné ici : le scoring dépend des
 * mêmes repositories et du même assembler que le reste du module posts —
 * voir modules/feed/README.md.)
 */
@Injectable()
export class FeedService {
  constructor(
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    @Inject(POST_TYPES_REPOSITORY)
    private readonly postTypesRepository: PostTypesRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    private readonly assembler: FeedPostAssembler,
  ) {}

  async getFeed(viewerId: string, params: FeedParams): Promise<PagedFeedPosts> {
    // lat/lng vont ensemble : un seul des deux est une erreur du client.
    const hasLat = params.lat !== undefined;
    const hasLng = params.lng !== undefined;
    if (hasLat !== hasLng) {
      throw new BadRequestException(
        'lat et lng doivent être fournis ensemble',
      );
    }
    const viewerPoint: GeoPoint | null =
      hasLat && hasLng
        ? { lat: params.lat as number, lng: params.lng as number }
        : null;

    const [window, followedIds] = await Promise.all([
      this.postsRepository.listActiveWindow(FEED_WEIGHTS.windowSize),
      this.usersRepository.listFollowedIds(viewerId),
    ]);
    const typesBySlug = await this.loadTypes(window);
    const followed = new Set(followedIds);
    const now = Date.now();

    // Score puis tri STABLE : score DESC, tie-break createdAt DESC puis id.
    const scored = window.map((post) => ({
      post,
      score: this.scorePost(post, { now, viewerPoint, followed, typesBySlug }),
    }));
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        b.post.createdAt.getTime() - a.post.createdAt.getTime() ||
        a.post.id.localeCompare(b.post.id),
    );

    const page = scored
      .slice(params.offset, params.offset + params.limit)
      .map((entry) => entry.post);

    return {
      items: await this.assembler.assemble(page, viewerId),
      total: scored.length,
    };
  }

  /** Score d'un post — voir FEED_WEIGHTS pour la sémantique des termes. */
  private scorePost(
    post: Post,
    context: {
      now: number;
      viewerPoint: GeoPoint | null;
      followed: Set<string>;
      typesBySlug: Map<string, PostType>;
    },
  ): number {
    // Récence : décroissance exponentielle de demi-vie recencyHalfLifeHours.
    const ageHours = Math.max(
      0,
      (context.now - post.createdAt.getTime()) / 3_600_000,
    );
    let score =
      FEED_WEIGHTS.recency *
      Math.pow(0.5, ageHours / FEED_WEIGHTS.recencyHalfLifeHours);

    // Proximité : bonus décroissant avec la distance haversine au viewer.
    if (context.viewerPoint && post.location) {
      const distanceKm =
        haversineMeters(context.viewerPoint, post.location) / 1000;
      score +=
        FEED_WEIGHTS.proximity *
        Math.pow(0.5, distanceKm / FEED_WEIGHTS.proximityHalfDistanceKm);
    }

    // Type : bonus des alertes (showsOnMap — piloté par la table post_types)
    // encore visibles sur la carte.
    const type = context.typesBySlug.get(post.typeSlug);
    if (
      type?.showsOnMap &&
      post.mapExpiresAt !== null &&
      post.mapExpiresAt.getTime() > context.now
    ) {
      score += FEED_WEIGHTS.activeAlert;
    }

    // Popularité : log(1 + réactions + commentaires) — croissance amortie.
    score +=
      FEED_WEIGHTS.popularity *
      Math.log1p(post.reactionCount + post.commentCount);

    // Abonnements : l'auteur est suivi par le viewer.
    if (context.followed.has(post.authorId)) {
      score += FEED_WEIGHTS.followedAuthor;
    }

    return score;
  }

  /** Types des posts de la fenêtre, chargés une fois par slug UNIQUE (les
   * types inactifs restent résolus : un post existant garde son type). */
  private async loadTypes(window: Post[]): Promise<Map<string, PostType>> {
    const slugs = [...new Set(window.map((post) => post.typeSlug))];
    const types = await Promise.all(
      slugs.map((slug) => this.postTypesRepository.findBySlug(slug)),
    );
    const bySlug = new Map<string, PostType>();
    types.forEach((type) => {
      if (type) {
        bySlug.set(type.slug, type);
      }
    });
    return bySlug;
  }
}

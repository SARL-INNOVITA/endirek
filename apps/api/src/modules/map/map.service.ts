import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PostAuthor, toPostAuthor } from '../../common/mappers/post.mapper';
import {
  POST_TYPES_REPOSITORY,
  POSTS_REPOSITORY,
} from '../../database/database.tokens';
import { BoundingBox, GeoPoint } from '../../database/domain/entities';
import {
  PostsRepository,
  PostTypesRepository,
} from '../../database/repositories/interfaces';
import { COMMUNES } from '../../database/seed/communes';
import {
  CameraPublicView,
  CamerasService,
} from '../cameras/cameras.service';
import { FeedPostAssembler } from '../posts/feed-post.assembler';
import { MapBboxQueryDto } from './dto/map-bbox-query.dto';
import { MapCamerasQueryDto } from './dto/map-cameras-query.dto';
import { MapOverviewQueryDto } from './dto/map-overview-query.dto';
import { MapPostsQueryDto } from './dto/map-posts-query.dto';

/** Commune du référentiel (GET /map/communes). */
export interface CommuneView {
  name: string;
  lat: number;
  lng: number;
}

/** Marqueur carte d'un post (GET /map/posts) — extrait léger, PAS un
 * FEED_POST complet : la carte n'a besoin ni des compteurs ni des médias. */
export interface MapPostItem {
  id: string;
  typeSlug: string;
  title: string | null;
  location: GeoPoint | null;
  city: string | null;
  mapExpiresAt: Date | null;
  createdAt: Date;
  urlSlug: string;
  author: PostAuthor;
}

/** Vue d'ensemble de la carte (GET /map/overview) — UN SEUL appel mobile. */
export interface MapOverview {
  posts: MapPostItem[];
  cameras: CameraPublicView[];
}

/**
 * Service carte (Lot 1 étape 5) — données de la page Carte centrée sur La
 * Réunion : marqueurs des posts météo/trafic/danger et caméras actives.
 *
 * Règle de SÉCURITÉ carte : seuls les types de post `showsOnMap` (weather,
 * traffic, danger dans le référentiel) apparaissent — un post free/question
 * géolocalisé ne sort JAMAIS de la carte. Cette exclusion est portée ICI
 * (allowlist déduite de post_types.showsOnMap), en plus de la garde
 * mapExpiresAt (posé uniquement pour les types carte à la création) :
 * défense en profondeur, indépendante d'un éventuel post mal formé.
 */
@Injectable()
export class MapService {
  constructor(
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    @Inject(POST_TYPES_REPOSITORY)
    private readonly postTypesRepository: PostTypesRepository,
    private readonly assembler: FeedPostAssembler,
    private readonly camerasService: CamerasService,
  ) {}

  /** Les 12 communes du référentiel seed (GET /map/communes). */
  listCommunes(): CommuneView[] {
    return COMMUNES.map((commune) => ({
      name: commune.name,
      lat: commune.lat,
      lng: commune.lng,
    }));
  }

  /**
   * Marqueurs des posts carte (GET /map/posts) : 'active' + location non nulle
   * + mapExpiresAt futur + type showsOnMap (weather/traffic/danger), filtrés
   * par la bbox et le filtre optionnel `types=`.
   */
  async listMapPosts(query: MapPostsQueryDto): Promise<{ items: MapPostItem[] }> {
    const bbox = this.parseBbox(query);
    const items = await this.loadMapPosts(bbox, query.types);
    return { items };
  }

  /**
   * Caméras actives de la carte (GET /map/cameras) : filtre optionnel
   * `categories=` (weather,traffic) + bbox optionnelle. active only (garanti
   * par CamerasService).
   */
  async listMapCameras(
    query: MapCamerasQueryDto,
  ): Promise<{ items: CameraPublicView[] }> {
    const bbox = this.parseBbox(query);
    const items = await this.camerasService.listPublic({
      categories: query.categories,
      bbox,
    });
    return { items };
  }

  /**
   * Vue d'ensemble (GET /map/overview) — posts carte + caméras actives dans la
   * même bbox, en UN SEUL appel. `includeExpired` ignoré/false au Lot 1 (la
   * carte ne montre jamais un post expiré).
   */
  async overview(query: MapOverviewQueryDto): Promise<MapOverview> {
    const bbox = this.parseBbox(query);
    const [posts, cameras] = await Promise.all([
      this.loadMapPosts(bbox, query.types),
      this.camerasService.listPublic({
        categories: query.categories,
        bbox,
      }),
    ]);
    return { posts, cameras };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Charge les marqueurs de posts carte. La liste des types autorisés est
   * l'INTERSECTION de l'allowlist showsOnMap (post_types) et du filtre `types`
   * demandé — jamais un type feed-only (free/question) ne peut être forcé.
   */
  private async loadMapPosts(
    bbox: BoundingBox | undefined,
    requestedTypes: string[] | undefined,
  ): Promise<MapPostItem[]> {
    const allowed = await this.mapTypeSlugs();
    const wanted =
      requestedTypes !== undefined && requestedTypes.length > 0
        ? requestedTypes.filter((slug) => allowed.has(slug))
        : [...allowed];

    // Défense en profondeur : la validation STRICTE du filtre `types` (rejet
    // 400 d'un slug hors allowlist) est portée par le DTO (@IsIn sur
    // MAP_POST_TYPES) et intervient AVANT le service — cette branche n'est donc
    // jamais atteinte en pratique. Conservée par prudence : si un type demandé
    // valide au DTO n'était plus showsOnMap (dérive backoffice au Lot 2+),
    // `wanted` pourrait être vide ; on rend alors la carte vide plutôt que de
    // retomber sur « tous les types ».
    if (wanted.length === 0) {
      return [];
    }

    const posts = await this.postsRepository.listMapMarkers({
      bbox,
      categories: wanted,
      now: new Date(),
    });

    const authors = await this.assembler.loadAuthors([
      ...new Set(posts.map((post) => post.authorId)),
    ]);

    return posts.map((post) => ({
      id: post.id,
      typeSlug: post.typeSlug,
      title: post.title,
      location: post.location,
      city: post.city,
      mapExpiresAt: post.mapExpiresAt,
      createdAt: post.createdAt,
      urlSlug: post.urlSlug,
      author: authors.get(post.authorId) ?? toPostAuthor(post.authorId, null),
    }));
  }

  /** Ensemble des slugs de types AFFICHABLES sur la carte (post_types actifs
   * dont showsOnMap = true) — source de vérité pilotable par le backoffice,
   * jamais une liste en dur. */
  private async mapTypeSlugs(): Promise<Set<string>> {
    const types = await this.postTypesRepository.listActive();
    return new Set(
      types.filter((type) => type.showsOnMap).map((type) => type.slug),
    );
  }

  /** Les 4 bornes vont ensemble : toutes → bbox, aucune → undefined,
   * partiel ou bornes inversées → 400. Mutualisé par tous les endpoints carte. */
  private parseBbox(query: MapBboxQueryDto): BoundingBox | undefined {
    const bounds = [query.minLat, query.minLng, query.maxLat, query.maxLng];
    const provided = bounds.filter((value) => value !== undefined).length;
    if (provided === 0) {
      return undefined;
    }
    if (provided < bounds.length) {
      throw new BadRequestException(
        'Boîte englobante incomplète : minLat, minLng, maxLat et maxLng ' +
          'doivent être fournis ensemble',
      );
    }
    const bbox: BoundingBox = {
      minLat: query.minLat as number,
      minLng: query.minLng as number,
      maxLat: query.maxLat as number,
      maxLng: query.maxLng as number,
    };
    if (bbox.minLat > bbox.maxLat || bbox.minLng > bbox.maxLng) {
      throw new BadRequestException(
        'Boîte englobante invalide : les bornes min doivent être ' +
          'inférieures aux bornes max',
      );
    }
    return bbox;
  }
}

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PostAuthor, toPostAuthor } from '../../common/mappers/post.mapper';
import { POSTS_REPOSITORY } from '../../database/database.tokens';
import { BoundingBox, GeoPoint } from '../../database/domain/entities';
import { PostsRepository } from '../../database/repositories/interfaces';
import { COMMUNES } from '../../database/seed/communes';
import { FeedPostAssembler } from '../posts/feed-post.assembler';
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

/**
 * Service carte — ENDPOINTS PRÉPARATOIRES de l'étape 4 uniquement (le
 * référentiel des communes pour le composer, et les marqueurs posts pour
 * vérifier les règles d'expiration). L'UI carte complète, les caméras et
 * le clustering arrivent à l'étape 5.
 */
@Injectable()
export class MapService {
  constructor(
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    private readonly assembler: FeedPostAssembler,
  ) {}

  /** Les 12 communes du référentiel seed (GET /map/communes). */
  listCommunes(): CommuneView[] {
    return COMMUNES.map((commune) => ({
      name: commune.name,
      lat: commune.lat,
      lng: commune.lng,
    }));
  }

  /** Posts visibles carte : 'active' + location non nulle + mapExpiresAt
   * futur, filtrés par la bbox si fournie (GET /map/posts). */
  async listMapPosts(query: MapPostsQueryDto): Promise<{ items: MapPostItem[] }> {
    const bbox = this.parseBbox(query);
    const posts = await this.postsRepository.listMapMarkers({
      bbox,
      now: new Date(),
    });

    const authors = await this.assembler.loadAuthors(
      [...new Set(posts.map((post) => post.authorId))],
    );

    return {
      items: posts.map((post) => ({
        id: post.id,
        typeSlug: post.typeSlug,
        title: post.title,
        location: post.location,
        city: post.city,
        mapExpiresAt: post.mapExpiresAt,
        createdAt: post.createdAt,
        urlSlug: post.urlSlug,
        author:
          authors.get(post.authorId) ?? toPostAuthor(post.authorId, null),
      })),
    };
  }

  /** Les 4 bornes vont ensemble : toutes → bbox, aucune → undefined,
   * partiel ou bornes inversées → 400. */
  private parseBbox(query: MapPostsQueryDto): BoundingBox | undefined {
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

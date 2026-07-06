import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  POSTS_REPOSITORY,
  SAVED_REPOSITORY,
} from '../../database/database.tokens';
import {
  PageParams,
  PostsRepository,
  SavedRepository,
} from '../../database/repositories/interfaces';
import { FeedPostAssembler } from '../posts/feed-post.assembler';
import { PagedFeedPosts, PostsService } from '../posts/posts.service';

/**
 * Service enregistrements — contrat d'API étape 4.
 *
 * Au Lot 1, tout passe par la collection par défaut « Général » (créée au
 * besoin par SavedRepository.getOrCreateDefaultCollection) ; les collections
 * personnalisées arrivent dans un lot ultérieur. save/unsave sont
 * IDEMPOTENTS ; le saveCount du post est recalculé par le repository.
 */
@Injectable()
export class SavedPostsService {
  constructor(
    @Inject(SAVED_REPOSITORY)
    private readonly savedRepository: SavedRepository,
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    private readonly postsService: PostsService,
    private readonly assembler: FeedPostAssembler,
  ) {}

  /** Enregistre un post VISIBLE dans la collection « Général » — idempotent. */
  async save(viewer: AuthenticatedUser, postId: string): Promise<void> {
    const post = await this.postsService.loadVisiblePost(viewer, postId);
    const collection = await this.savedRepository.getOrCreateDefaultCollection(
      viewer.userId,
    );
    await this.savedRepository.save(collection.id, post.id);
  }

  /**
   * Retire un post de la collection « Général » — idempotent. Pas de règle
   * de visibilité ici : un post devenu hidden/deleted doit rester
   * retirable de sa collection (seule une ligne posts inexistante → 404).
   */
  async unsave(viewer: AuthenticatedUser, postId: string): Promise<void> {
    const post = await this.postsRepository.findById(postId);
    if (!post) {
      throw new NotFoundException('Publication introuvable');
    }
    const collection = await this.savedRepository.getOrCreateDefaultCollection(
      viewer.userId,
    );
    await this.savedRepository.unsave(collection.id, post.id);
  }

  /** Mes posts enregistrés (GET /users/me/saved-posts) — du plus récemment
   * enregistré au plus ancien ; les posts devenus hidden/deleted sont
   * exclus (filtre repository), la forme est FEED_POST (viewerSaved true). */
  async listMySavedPosts(
    viewer: AuthenticatedUser,
    params: PageParams,
  ): Promise<PagedFeedPosts> {
    const page = await this.savedRepository.listSavedPostsByUser(
      viewer.userId,
      params,
    );
    return {
      items: await this.assembler.assemble(page.items, viewer.userId),
      total: page.total,
    };
  }
}

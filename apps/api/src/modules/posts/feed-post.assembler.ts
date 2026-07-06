import { Inject, Injectable } from '@nestjs/common';
import {
  FeedPost,
  FeedPostMedia,
  PostAuthor,
  toFeedPost,
  toFeedPostMedia,
  toPostAuthor,
  toReactionsTop,
} from '../../common/mappers/post.mapper';
import {
  POSTS_REPOSITORY,
  REACTIONS_REPOSITORY,
  SAVED_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import { Post } from '../../database/domain/entities';
import {
  PostsRepository,
  ReactionsRepository,
  SavedRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';

/**
 * Assembleur UNIQUE de la forme FEED_POST du contrat d'API — mutualisé entre
 * feed, détail d'un post, listes de profil, et (phases suivantes)
 * interactions, saved-posts et admin : exporté par PostsModule, les autres
 * modules l'importent au lieu de réassembler la forme à la main.
 *
 * Toutes les données contextuelles d'une PAGE sont chargées PAR LOT (un appel
 * repository par famille : auteurs, médias, réaction du viewer, sauvegardes
 * du viewer, agrégats d'emojis) — pas de N+1 par post.
 */
@Injectable()
export class FeedPostAssembler {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    @Inject(REACTIONS_REPOSITORY)
    private readonly reactionsRepository: ReactionsRepository,
    @Inject(SAVED_REPOSITORY)
    private readonly savedRepository: SavedRepository,
  ) {}

  /** Assemble une PAGE de posts vers la forme FEED_POST (ordre préservé). */
  async assemble(posts: Post[], viewerId: string): Promise<FeedPost[]> {
    if (posts.length === 0) {
      return [];
    }

    const postIds = posts.map((post) => post.id);
    const authorIds = [...new Set(posts.map((post) => post.authorId))];

    const [authors, mediaRows, viewerReactions, savedPostIds, emojiCounts] =
      await Promise.all([
        this.loadAuthors(authorIds),
        this.postsRepository.listMediaByPostIds(postIds),
        this.reactionsRepository.findViewerReactions(
          viewerId,
          'post',
          postIds,
        ),
        this.savedRepository.filterSavedPostIds(viewerId, postIds),
        this.reactionsRepository.countsByEmojiForTargets('post', postIds),
      ]);

    // Médias regroupés par post (déjà triés par position par le repository).
    const mediaByPost = new Map<string, FeedPostMedia[]>();
    for (const media of mediaRows) {
      const list = mediaByPost.get(media.postId) ?? [];
      list.push(toFeedPostMedia(media));
      mediaByPost.set(media.postId, list);
    }
    const savedSet = new Set(savedPostIds);

    return posts.map((post) =>
      toFeedPost(post, {
        author:
          authors.get(post.authorId) ?? toPostAuthor(post.authorId, null),
        media: mediaByPost.get(post.id) ?? [],
        viewerReaction: viewerReactions[post.id] ?? null,
        viewerSaved: savedSet.has(post.id),
        reactionsTop: toReactionsTop(emojiCounts[post.id] ?? {}),
      }),
    );
  }

  /** Assemble UN post (détail, retour de création/modification). */
  async assembleOne(post: Post, viewerId: string): Promise<FeedPost> {
    const [assembled] = await this.assemble([post], viewerId);
    return assembled;
  }

  /**
   * Auteurs par lot vers la forme AUTEUR du contrat — réutilisé par le
   * module map (marqueurs) qui n'a pas besoin du FEED_POST complet.
   * Les comptes supprimés sortent tels quels : leurs données sont DÉJÀ
   * anonymisées en base par la suppression RGPD.
   */
  async loadAuthors(authorIds: string[]): Promise<Map<string, PostAuthor>> {
    const users = await this.usersRepository.findByIds(authorIds);
    return new Map(users.map((user) => [user.id, toPostAuthor(user.id, user)]));
  }
}

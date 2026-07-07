import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EmojiCount, toReactionsTop } from '../../common/mappers/post.mapper';
import {
  COMMENTS_REPOSITORY,
  POSTS_REPOSITORY,
  REACTIONS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import { Comment } from '../../database/domain/entities';
import {
  CommentsRepository,
  PostsRepository,
  ReactionsRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { NotificationsService } from '../notifications/notifications.service';
import { PostsService } from '../posts/posts.service';

/** Réponse des réactions sur un POST (contrat étape 4). */
export interface PostReactionsSummary {
  reactionCount: number;
  reactionsTop: EmojiCount[];
  viewerReaction: string | null;
}

/** Réponse des réactions sur un COMMENTAIRE (contrat étape 4). */
export interface CommentReactionsSummary {
  reactionCount: number;
  viewerReaction: string | null;
}

/**
 * Service réactions — contrat d'API étape 4.
 *
 * - une seule réaction par (viewer, cible) : réagir avec un autre emoji
 *   REMPLACE la réaction (upsert repository), le retrait est idempotent ;
 * - l'emoji est validé CONTRE la table reaction_types (pilotable
 *   backoffice) — jamais contre une liste en dur : emoji inconnu → 400
 *   avec la liste des emojis valides ;
 * - les compteurs dénormalisés (post.reactionCount / comment.reactionCount)
 *   sont recalculés par le repository à chaque mutation ;
 * - réagir à un COMMENTAIRE exige que son post parent soit visible par le
 *   viewer (mêmes règles que partout : PostsService.loadVisiblePost) ;
 * - notification 'reaction' à l'AJOUT d'une réaction sur un POST (étape 5) :
 *   l'auteur du post est notifié (jamais soi-même), payload { postId,
 *   fromUserId, fromDisplayName, emoji } — via NotificationsService.create
 *   (persistance + émission temps réel). Pas de notification au retrait, ni
 *   sur les réactions de commentaire (hors périmètre Lot 1).
 */
@Injectable()
export class ReactionsService {
  constructor(
    @Inject(REACTIONS_REPOSITORY)
    private readonly reactionsRepository: ReactionsRepository,
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    @Inject(COMMENTS_REPOSITORY)
    private readonly commentsRepository: CommentsRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    private readonly notificationsService: NotificationsService,
    private readonly postsService: PostsService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Réactions sur un post
  // ──────────────────────────────────────────────────────────────────────────

  /** Réagit à un post visible (upsert : changer d'emoji remplace). Notifie
   * l'auteur du post (jamais soi-même) via NotificationsService. */
  async reactToPost(
    viewer: AuthenticatedUser,
    postId: string,
    emoji: string,
  ): Promise<PostReactionsSummary> {
    const post = await this.postsService.loadVisiblePost(viewer, postId);
    await this.assertValidEmoji(emoji);
    await this.reactionsRepository.upsert(viewer.userId, 'post', post.id, emoji);
    await this.notifyPostReaction(post.authorId, post.id, viewer.userId, emoji);
    return this.postSummary(post.id, emoji);
  }

  /** Retire la réaction du viewer sur un post — idempotent. */
  async unreactFromPost(
    viewer: AuthenticatedUser,
    postId: string,
  ): Promise<PostReactionsSummary> {
    const post = await this.postsService.loadVisiblePost(viewer, postId);
    await this.reactionsRepository.remove(viewer.userId, 'post', post.id);
    return this.postSummary(post.id, null);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Réactions sur un commentaire
  // ──────────────────────────────────────────────────────────────────────────

  /** Réagit à un commentaire actif (mêmes règles d'upsert que les posts). */
  async reactToComment(
    viewer: AuthenticatedUser,
    commentId: string,
    emoji: string,
  ): Promise<CommentReactionsSummary> {
    const comment = await this.loadActiveComment(viewer, commentId);
    await this.assertValidEmoji(emoji);
    await this.reactionsRepository.upsert(
      viewer.userId,
      'comment',
      comment.id,
      emoji,
    );
    return this.commentSummary(comment.id, emoji);
  }

  /** Retire la réaction du viewer sur un commentaire — idempotent. */
  async unreactFromComment(
    viewer: AuthenticatedUser,
    commentId: string,
  ): Promise<CommentReactionsSummary> {
    const comment = await this.loadActiveComment(viewer, commentId);
    await this.reactionsRepository.remove(viewer.userId, 'comment', comment.id);
    return this.commentSummary(comment.id, null);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Notifie l'auteur d'un post d'une réaction reçue — JAMAIS à soi-même.
   * Payload { postId, fromUserId, fromDisplayName, emoji }. Passe par
   * NotificationsService (persistance + émission temps réel).
   */
  private async notifyPostReaction(
    postAuthorId: string,
    postId: string,
    fromUserId: string,
    emoji: string,
  ): Promise<void> {
    if (postAuthorId === fromUserId) {
      return; // Jamais de notification à soi-même.
    }
    const from = await this.usersRepository.findById(fromUserId);
    await this.notificationsService.create({
      userId: postAuthorId,
      type: 'reaction',
      payload: {
        postId,
        fromUserId,
        fromDisplayName: from?.displayName ?? 'Utilisateur supprimé',
        emoji,
      },
    });
  }

  /** Valide l'emoji CONTRE la table reaction_types — 400 avec la liste des
   * emojis valides sinon (palette pilotée par le backoffice). */
  private async assertValidEmoji(emoji: string): Promise<void> {
    const types = await this.reactionsRepository.listActiveTypes();
    if (!types.some((type) => type.emoji === emoji)) {
      throw new BadRequestException(
        `Réaction invalide. Emojis acceptés : ${types
          .map((type) => type.emoji)
          .join(' ')}`,
      );
    }
  }

  /** État des réactions d'un post APRÈS mutation (compteur dénormalisé
   * recalculé par le repository + top 3 des emojis). */
  private async postSummary(
    postId: string,
    viewerReaction: string | null,
  ): Promise<PostReactionsSummary> {
    const [post, counts] = await Promise.all([
      this.postsRepository.findById(postId),
      this.reactionsRepository.countsByEmoji('post', postId),
    ]);
    return {
      reactionCount: post?.reactionCount ?? 0,
      reactionsTop: toReactionsTop(counts),
      viewerReaction,
    };
  }

  /** État des réactions d'un commentaire APRÈS mutation. */
  private async commentSummary(
    commentId: string,
    viewerReaction: string | null,
  ): Promise<CommentReactionsSummary> {
    const comment = await this.commentsRepository.findById(commentId);
    return {
      reactionCount: comment?.reactionCount ?? 0,
      viewerReaction,
    };
  }

  /** Charge un commentaire ACTIF dont le POST PARENT est visible par le
   * viewer — 404 sinon (même message qu'un commentaire réellement absent :
   * ne rien révéler d'un contenu masqué). */
  private async loadActiveComment(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<Comment> {
    const comment = await this.commentsRepository.findById(id);
    if (!comment || comment.status !== 'active') {
      throw new NotFoundException('Commentaire introuvable');
    }
    // Visibilité du post parent — mêmes règles que partout
    // (PostsService.loadVisiblePost, source unique) : post 'deleted' → 404 ;
    // 'hidden' → 404 sauf auteur du post et rôles moderator/super_admin. Un
    // commentaire d'un post masqué par la modération ne doit pas rester
    // réactable (il n'est même pas lisible).
    await this.postsService.loadVisiblePost(viewer, comment.postId);
    return comment;
  }
}

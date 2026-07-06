import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PostAuthor, toPostAuthor } from '../../common/mappers/post.mapper';
import {
  COMMENTS_REPOSITORY,
  NOTIFICATIONS_REPOSITORY,
  POSTS_REPOSITORY,
  REACTIONS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import {
  Comment,
  CommentStatus,
  Post,
} from '../../database/domain/entities';
import {
  CommentsRepository,
  NotificationsRepository,
  PageParams,
  PostsRepository,
  ReactionsRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { FeedPostAssembler } from '../posts/feed-post.assembler';
import { PostsService } from '../posts/posts.service';
import { CreateCommentDto } from './dto/create-comment.dto';

/** Longueur maximale de l'extrait de texte dans un payload de notification. */
const NOTIFICATION_EXCERPT_LENGTH = 120;

/** Extrait court du corps d'un commentaire (payload de notification). */
function excerpt(body: string): string {
  return body.length <= NOTIFICATION_EXCERPT_LENGTH
    ? body
    : `${body.slice(0, NOTIFICATION_EXCERPT_LENGTH - 1)}…`;
}

/** Réponse (depth 1) du contrat — même forme qu'une racine, sans replies. */
export interface CommentReplyView {
  id: string;
  body: string;
  status: CommentStatus;
  createdAt: Date;
  author: PostAuthor;
  reactionCount: number;
  viewerReaction: string | null;
  isDeleted: boolean;
}

/** Commentaire racine (depth 0) du contrat, réponses actives imbriquées. */
export interface CommentView extends CommentReplyView {
  replies: CommentReplyView[];
}

/** Liste paginée de commentaires racine ({ items, total }). */
export interface PagedComments {
  items: CommentView[];
  total: number;
}

/** Données contextuelles chargées PAR LOT pour une page de commentaires. */
interface CommentViewContext {
  authors: Map<string, PostAuthor>;
  viewerReactions: Record<string, string>;
}

/**
 * Service commentaires — contrat d'API étape 4, OPTION A stricte :
 * depth 0 = commentaire principal, depth 1 = réponse à un commentaire
 * principal, tout niveau 2+ est REFUSÉ (400).
 *
 * Règles d'affichage (GET /posts/:id/comments) :
 * - racines triées created ASC (fil chronologique du mockup), réponses
 *   actives imbriquées created ASC ;
 * - une racine non active ('deleted' — ou 'hidden' par la modération,
 *   traitée de la même façon) AVEC au moins une réponse active est servie
 *   comme EMPLACEMENT : isDeleted true, body vide, compteurs neutralisés
 *   (le fil des réponses ne casse pas) ; SANS réponse active, elle est
 *   exclue ;
 * - les réponses non actives sont toujours exclues ;
 * - `total` compte les racines VISIBLES (pagination offset/limit dessus).
 */
@Injectable()
export class CommentsService {
  constructor(
    @Inject(COMMENTS_REPOSITORY)
    private readonly commentsRepository: CommentsRepository,
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    @Inject(REACTIONS_REPOSITORY)
    private readonly reactionsRepository: ReactionsRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly notificationsRepository: NotificationsRepository,
    private readonly postsService: PostsService,
    private readonly assembler: FeedPostAssembler,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Lecture
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Fil de commentaires d'un post visible (GET /posts/:id/comments).
   *
   * Implémentation mock : tous les commentaires du post sont chargés (déjà
   * triés created ASC par le repository) puis la visibilité et la pagination
   * des racines sont calculées en mémoire — la règle « racine supprimée
   * gardée si elle a des réponses actives » dépend des réponses, le driver
   * postgres la portera en SQL (sous-requête EXISTS sur les réponses).
   */
  async listForPost(
    viewer: AuthenticatedUser,
    postId: string,
    params: PageParams,
  ): Promise<PagedComments> {
    const post = await this.postsService.loadVisiblePost(viewer, postId);
    const all = await this.commentsRepository.listByPost(post.id);

    const { roots, activeRepliesByParent } = this.splitThread(all);
    const visibleRoots = roots.filter(
      (root) =>
        root.status === 'active' ||
        (activeRepliesByParent.get(root.id) ?? []).length > 0,
    );

    const page = visibleRoots.slice(
      params.offset,
      params.offset + params.limit,
    );

    // Contexte (auteurs + réaction du viewer) chargé PAR LOT sur la page.
    const pageComments: Comment[] = [];
    for (const root of page) {
      pageComments.push(root, ...(activeRepliesByParent.get(root.id) ?? []));
    }
    const context = await this.loadViewContext(viewer.userId, pageComments);

    return {
      items: page.map((root) => ({
        ...this.toReplyView(root, context),
        replies: (activeRepliesByParent.get(root.id) ?? []).map((reply) =>
          this.toReplyView(reply, context),
        ),
      })),
      total: visibleRoots.length,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Création
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Crée un commentaire ou une réponse (POST /posts/:id/comments).
   * OPTION A stricte : le parent doit appartenir au MÊME post ET être un
   * commentaire principal (depth 0) — répondre à une réponse est refusé.
   * Le commentCount du post est recalculé par le repository ; les
   * notifications in-app sont créées ici (voir notifyCreation).
   */
  async create(
    viewer: AuthenticatedUser,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<CommentView> {
    const post = await this.postsService.loadVisiblePost(viewer, postId);

    let parent: Comment | null = null;
    if (dto.parentCommentId !== undefined) {
      parent = await this.commentsRepository.findById(dto.parentCommentId);
      if (!parent || parent.postId !== post.id) {
        throw new BadRequestException(
          'Commentaire parent introuvable sur cette publication',
        );
      }
      // Option A : on ne répond qu'à un commentaire PRINCIPAL (depth 0).
      if (parent.parentCommentId !== null) {
        throw new BadRequestException(
          'Les réponses aux réponses ne sont pas disponibles',
        );
      }
      if (parent.status !== 'active') {
        throw new BadRequestException(
          'Impossible de répondre à un commentaire supprimé',
        );
      }
    }

    const comment = await this.commentsRepository.create({
      postId: post.id,
      authorId: viewer.userId,
      body: dto.body,
      parentCommentId: parent?.id ?? null,
    });

    await this.notifyCreation(post, parent, comment);

    const context = await this.loadViewContext(viewer.userId, [comment]);
    return { ...this.toReplyView(comment, context), replies: [] };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suppression
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Supprime un commentaire (DELETE /comments/:id) — soft-delete réservé à
   * l'AUTEUR DU COMMENTAIRE ou à l'AUTEUR DU POST (403 sinon). Le
   * commentCount du post est recalculé par le repository. Une racine
   * supprimée qui garde des réponses actives reste servie en emplacement
   * isDeleted (voir listForPost).
   */
  async remove(viewer: AuthenticatedUser, commentId: string): Promise<void> {
    const comment = await this.commentsRepository.findById(commentId);
    if (!comment || comment.status === 'deleted') {
      throw new NotFoundException('Commentaire introuvable');
    }
    if (comment.authorId !== viewer.userId) {
      const post = await this.postsRepository.findById(comment.postId);
      if (!post || post.authorId !== viewer.userId) {
        throw new ForbiddenException(
          "Seuls l'auteur du commentaire et l'auteur de la publication " +
            'peuvent supprimer ce commentaire',
        );
      }
    }
    await this.commentsRepository.setStatus(commentId, 'deleted');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Sépare racines (tous statuts) et réponses ACTIVES groupées par parent —
   * l'ordre created ASC du repository est préservé. */
  private splitThread(all: Comment[]): {
    roots: Comment[];
    activeRepliesByParent: Map<string, Comment[]>;
  } {
    const roots: Comment[] = [];
    const activeRepliesByParent = new Map<string, Comment[]>();
    for (const comment of all) {
      if (comment.parentCommentId === null) {
        roots.push(comment);
      } else if (comment.status === 'active') {
        const list = activeRepliesByParent.get(comment.parentCommentId) ?? [];
        list.push(comment);
        activeRepliesByParent.set(comment.parentCommentId, list);
      }
    }
    return { roots, activeRepliesByParent };
  }

  /** Auteurs + réactions du viewer d'une page de commentaires, PAR LOT. */
  private async loadViewContext(
    viewerId: string,
    comments: Comment[],
  ): Promise<CommentViewContext> {
    const authorIds = [...new Set(comments.map((c) => c.authorId))];
    const commentIds = comments.map((c) => c.id);
    const [authors, viewerReactions] = await Promise.all([
      this.assembler.loadAuthors(authorIds),
      this.reactionsRepository.findViewerReactions(
        viewerId,
        'comment',
        commentIds,
      ),
    ]);
    return { authors, viewerReactions };
  }

  /** Projette un commentaire vers la forme du contrat. Un commentaire non
   * actif est servi comme EMPLACEMENT : body vide, compteurs neutralisés,
   * isDeleted true (seul l'auteur reste affiché). */
  private toReplyView(
    comment: Comment,
    context: CommentViewContext,
  ): CommentReplyView {
    const isDeleted = comment.status !== 'active';
    return {
      id: comment.id,
      body: isDeleted ? '' : comment.body,
      status: comment.status,
      createdAt: comment.createdAt,
      author:
        context.authors.get(comment.authorId) ??
        toPostAuthor(comment.authorId, null),
      reactionCount: isDeleted ? 0 : comment.reactionCount,
      viewerReaction: isDeleted
        ? null
        : (context.viewerReactions[comment.id] ?? null),
      isDeleted,
    };
  }

  /**
   * Notifications in-app à la création d'un commentaire :
   * - réponse → type 'reply' pour l'auteur du commentaire parent ;
   * - type 'comment' pour l'auteur du post (sauf s'il vient de recevoir le
   *   'reply' — jamais deux notifications pour le même événement) ;
   * - JAMAIS de notification à soi-même.
   *
   * Payload utile : { postId, commentId, fromUserId, fromDisplayName,
   * excerpt } (+ parentCommentId pour un 'reply'). Les endpoints de LECTURE
   * arrivent à l'étape 5 — on ne fait qu'écrire via NotificationsRepository ;
   * en attendant, les notifications sont visibles dans l'export RGPD
   * (GET /users/me/export).
   */
  private async notifyCreation(
    post: Post,
    parent: Comment | null,
    comment: Comment,
  ): Promise<void> {
    const from = await this.usersRepository.findById(comment.authorId);
    const payload = {
      postId: post.id,
      commentId: comment.id,
      fromUserId: comment.authorId,
      fromDisplayName: from?.displayName ?? 'Utilisateur supprimé',
      excerpt: excerpt(comment.body),
    };

    const notified = new Set<string>([comment.authorId]); // jamais à soi-même
    if (parent && !notified.has(parent.authorId)) {
      notified.add(parent.authorId);
      await this.notificationsRepository.create({
        userId: parent.authorId,
        type: 'reply',
        payload: { ...payload, parentCommentId: parent.id },
      });
    }
    if (!notified.has(post.authorId)) {
      await this.notificationsRepository.create({
        userId: post.authorId,
        type: 'comment',
        payload,
      });
    }
  }
}

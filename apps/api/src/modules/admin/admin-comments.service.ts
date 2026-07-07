import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostAuthor, toPostAuthor } from '../../common/mappers/post.mapper';
import {
  COMMENTS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import { Comment, CommentStatus } from '../../database/domain/entities';
import {
  CommentsRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { UpdateCommentStatusDto } from './dto/update-comment-status.dto';

/** Vue admin complete d'un commentaire cible. */
export interface AdminCommentView {
  id: string;
  postId: string;
  parentCommentId: string | null;
  depth: 0 | 1;
  body: string;
  status: CommentStatus;
  reactionCount: number;
  createdAt: Date;
  updatedAt: Date;
  author: PostAuthor;
}

@Injectable()
export class AdminCommentsService {
  constructor(
    @Inject(COMMENTS_REPOSITORY)
    private readonly commentsRepository: CommentsRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  /**
   * Masque, reactive ou soft-delete un commentaire.
   *
   * `deleted` reste definitif : le backoffice ne restaure pas un commentaire
   * supprime, pour rester coherent avec les posts/comptes supprimes.
   */
  async updateStatus(
    id: string,
    dto: UpdateCommentStatusDto,
  ): Promise<AdminCommentView> {
    const comment = await this.commentsRepository.findById(id);
    if (!comment) {
      throw new NotFoundException('Commentaire introuvable');
    }
    if (comment.status === 'deleted' && dto.status !== 'deleted') {
      throw new ConflictException(
        'Ce commentaire a ete supprime : son statut ne peut plus etre modifie',
      );
    }
    const updated =
      comment.status === dto.status
        ? comment
        : await this.commentsRepository.setStatus(id, dto.status);
    return this.toView(updated);
  }

  private async toView(comment: Comment): Promise<AdminCommentView> {
    const author = await this.usersRepository.findById(comment.authorId);
    return {
      id: comment.id,
      postId: comment.postId,
      parentCommentId: comment.parentCommentId,
      depth: comment.depth,
      body: comment.body,
      status: comment.status,
      reactionCount: comment.reactionCount,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: author ? toPostAuthor(author.id, author) : toPostAuthor(comment.authorId, null),
    };
  }
}

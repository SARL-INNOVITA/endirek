import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CommentStatus } from '../../../database/domain/entities';

export type AdminSettableCommentStatus = CommentStatus;

const SETTABLE_COMMENT_STATUSES: AdminSettableCommentStatus[] = [
  'active',
  'hidden',
  'deleted',
];

/** PATCH /admin/comments/:id/status. */
export class UpdateCommentStatusDto {
  @ApiProperty({
    description:
      'Statut cible du commentaire. deleted = suppression douce definitive.',
    enum: SETTABLE_COMMENT_STATUSES,
  })
  @IsIn(SETTABLE_COMMENT_STATUSES, {
    message: 'Le statut doit etre "active", "hidden" ou "deleted"',
  })
  status!: AdminSettableCommentStatus;
}

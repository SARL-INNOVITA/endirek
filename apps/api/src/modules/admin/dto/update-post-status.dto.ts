import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Statuts qu'un modérateur peut poser sur une publication : UNIQUEMENT
 * 'active' (republier) et 'hidden' (masquer). Le statut 'deleted' n'est
 * JAMAIS posé par le backoffice — la suppression d'une publication
 * appartient à son auteur (DELETE /posts/:id) ou au flux RGPD. */
export const ADMIN_SETTABLE_POST_STATUSES = ['active', 'hidden'] as const;

/** Statut modérable d'une publication (sous-ensemble de PostStatus). */
export type AdminSettablePostStatus =
  (typeof ADMIN_SETTABLE_POST_STATUSES)[number];

/**
 * Corps de PATCH /admin/posts/:id/status.
 *
 * Le DTO accepte 'deleted' dans la liste IsIn pour que le SERVICE réponde
 * 400 avec le message métier dédié (« La suppression appartient à l'auteur
 * ou au flux RGPD ») plutôt qu'un message générique de validation.
 */
export class UpdatePostStatusDto {
  @ApiProperty({
    description:
      'Nouveau statut de la publication : « active » (visible de tous) ou ' +
      '« hidden » (masquée du feed, de la carte et du détail public — ' +
      'seuls l’auteur et les modérateurs la voient encore). « deleted » ' +
      'est refusé : la suppression appartient à l’auteur ou au flux RGPD.',
    enum: ADMIN_SETTABLE_POST_STATUSES,
    example: 'hidden',
  })
  @IsIn([...ADMIN_SETTABLE_POST_STATUSES, 'deleted'], {
    message: 'Le statut doit être « active » ou « hidden »',
  })
  status!: AdminSettablePostStatus | 'deleted';
}

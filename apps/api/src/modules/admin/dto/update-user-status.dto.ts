import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Statuts qu'un administrateur peut poser via le backoffice : UNIQUEMENT
 * 'active' et 'suspended'. Le statut 'deleted' n'est JAMAIS posé par ici —
 * la suppression d'un compte passe par le flux RGPD (DELETE /users/me,
 * soft-delete + anonymisation), pas par une décision d'administration. */
export const ADMIN_SETTABLE_STATUSES = ['active', 'suspended'] as const;

/** Statut administrable d'un compte (sous-ensemble de UserStatus). */
export type AdminSettableStatus = (typeof ADMIN_SETTABLE_STATUSES)[number];

/** Corps de PATCH /admin/users/:id/status. */
export class UpdateUserStatusDto {
  @ApiProperty({
    description:
      'Nouveau statut du compte : « active » (réactiver) ou ' +
      '« suspended » (suspendre — le compte ne peut plus se connecter)',
    enum: ADMIN_SETTABLE_STATUSES,
    example: 'suspended',
  })
  @IsIn(ADMIN_SETTABLE_STATUSES, {
    message: 'Le statut doit être « active » ou « suspended »',
  })
  status!: AdminSettableStatus;
}

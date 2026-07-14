import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn } from 'class-validator';

/** Statuts qu'un modérateur peut poser sur une page : UNIQUEMENT 'active'
 * (republier) et 'hidden' (masquer). 'deleted' n'est JAMAIS posé par le
 * backoffice — la suppression appartient au propriétaire (DELETE) ou au flux
 * RGPD (miroir strict de la règle des annonces — D69/D76). */
export const ADMIN_SETTABLE_PAGE_STATUSES = ['active', 'hidden'] as const;

export type AdminSettablePageStatus =
  (typeof ADMIN_SETTABLE_PAGE_STATUSES)[number];

/**
 * Corps de PATCH /admin/pages/:id/status.
 *
 * Le DTO accepte 'deleted' dans IsIn pour que le SERVICE réponde 400 avec le
 * message métier dédié plutôt qu'un message générique de validation.
 */
export class UpdatePageStatusDto {
  @ApiProperty({
    description:
      'Nouveau statut de la page : « active » (visible de tous) ou ' +
      '« hidden » (masquée — seuls le propriétaire et les modérateurs la ' +
      'voient, ses publications sortent du feed et de la carte). ' +
      '« deleted » est refusé.',
    enum: ADMIN_SETTABLE_PAGE_STATUSES,
    example: 'hidden',
  })
  @IsIn([...ADMIN_SETTABLE_PAGE_STATUSES, 'deleted'], {
    message: 'Le statut doit être « active » ou « hidden »',
  })
  status!: AdminSettablePageStatus | 'deleted';
}

/** Corps de PATCH /admin/pages/:id/verified — accorde/retire le badge ✓
 * (« validation légère » a posteriori — D69/D76). */
export class UpdatePageVerifiedDto {
  @ApiProperty({
    description: 'true = badge vérifié accordé, false = retiré',
    example: true,
  })
  @IsBoolean({ message: 'verified doit être true ou false' })
  verified!: boolean;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Statuts qu'un modérateur peut poser sur une annonce : UNIQUEMENT 'active'
 * (republier) et 'hidden' (masquer). 'deleted' n'est JAMAIS posé par le
 * backoffice — la suppression appartient au propriétaire (DELETE) ou au flux
 * RGPD (miroir strict de la règle des posts). */
export const ADMIN_SETTABLE_LISTING_STATUSES = ['active', 'hidden'] as const;

export type AdminSettableListingStatus =
  (typeof ADMIN_SETTABLE_LISTING_STATUSES)[number];

/**
 * Corps de PATCH /admin/dealplace/listings/:id/status.
 *
 * Le DTO accepte 'deleted' dans IsIn pour que le SERVICE réponde 400 avec le
 * message métier dédié plutôt qu'un message générique de validation.
 */
export class UpdateListingStatusDto {
  @ApiProperty({
    description:
      'Nouveau statut de l\'annonce : « active » (visible de tous) ou ' +
      '« hidden » (masquée de l\'annuaire et du détail public — seuls le ' +
      'propriétaire et les modérateurs la voient). « deleted » est refusé.',
    enum: ADMIN_SETTABLE_LISTING_STATUSES,
    example: 'hidden',
  })
  @IsIn([...ADMIN_SETTABLE_LISTING_STATUSES, 'deleted'], {
    message: 'Le statut doit être « active » ou « hidden »',
  })
  status!: AdminSettableListingStatus | 'deleted';
}

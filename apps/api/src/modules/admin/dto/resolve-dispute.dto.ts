import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';
import { DealDisputeResolution } from '../../../database/domain/entities';

/** Issues possibles d'un arbitrage (D66). */
const DISPUTE_OUTCOMES: DealDisputeResolution[] = [
  'cancelled',
  'completed',
  'resumed',
];

/**
 * Corps de POST /admin/dealplace/deals/:id/resolve-dispute (CP2.5 — D66) :
 * l'arbitre TRANCHE le litige. La note de décision est OBLIGATOIRE — elle
 * est montrée aux deux parties (l'identité du modérateur ne l'est jamais).
 */
export class ResolveDisputeDto {
  @ApiProperty({
    description:
      'Issue de l’arbitrage : « cancelled » (deal annulé), « completed » ' +
      '(deal déclaré conclu — les avis s’ouvrent) ou « resumed » (litige ' +
      'non fondé, le deal reprend son cours)',
    enum: DISPUTE_OUTCOMES,
  })
  @IsIn(DISPUTE_OUTCOMES, {
    message:
      'L’issue doit être « cancelled », « completed » ou « resumed »',
  })
  outcome!: DealDisputeResolution;

  @ApiProperty({
    description:
      'Note de décision montrée aux deux parties (10 à 1000 caractères ' +
      'après trim)',
    minLength: 10,
    maxLength: 1000,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'La note de décision doit être une chaîne' })
  @Length(10, 1000, {
    message: 'La note de décision doit contenir entre 10 et 1000 caractères',
  })
  note!: string;
}

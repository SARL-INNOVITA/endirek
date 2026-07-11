import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { DealItemDto } from './propose-deal.dto';

/** Natures d'ajustement (miroir de DealAdjustmentKind). */
export const DEAL_ADJUSTMENT_KINDS = ['add', 'modify', 'remove'] as const;

/**
 * Corps de POST /deals/:id/adjustments — propose un ajustement en cours de
 * deal ('active') : add (item complet), modify (itemId + champs de item),
 * remove (itemId). La CONTREPARTIE accepte (application automatique) ou
 * refuse.
 */
export class ProposeAdjustmentDto {
  @ApiProperty({
    description: "Nature : 'add', 'modify' ou 'remove'",
    enum: DEAL_ADJUSTMENT_KINDS,
  })
  @IsIn(DEAL_ADJUSTMENT_KINDS, {
    message: 'kind doit être « add », « modify » ou « remove »',
  })
  kind!: (typeof DEAL_ADJUSTMENT_KINDS)[number];

  @ApiPropertyOptional({
    description: "Élément visé (obligatoire pour 'modify' et 'remove')",
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'itemId doit être un identifiant valide' })
  itemId?: string;

  @ApiPropertyOptional({
    description:
      "Élément : complet pour 'add' ; seuls les champs modifiés pour " +
      "'modify' (ignoré pour 'remove')",
    type: DealItemDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DealItemDto)
  item?: DealItemDto;

  @ApiProperty({
    description:
      'Description lisible de l’ajustement (affichée dans la liste — 1 à ' +
      '500 caractères)',
  })
  @IsString({ message: 'La description doit être une chaîne' })
  @Length(1, 500, {
    message: 'La description doit contenir entre 1 et 500 caractères',
  })
  description!: string;
}

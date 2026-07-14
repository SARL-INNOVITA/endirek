import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Corps de PATCH /pages/:id/offers/:offerId — patch partiel d'une offre.
 * imageUrl/startsAt/endsAt sont nullables (remise à vide) ; la cohérence de
 * période est vérifiée au SERVICE sur l'état RÉSULTANT. */
export class UpdatePageOfferDto {
  @ApiPropertyOptional({ description: "Titre de l'offre (1 à 120 caractères)" })
  @ValidateIf((dto: UpdatePageOfferDto) => dto.title !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le titre doit être une chaîne' })
  @Length(1, 120, {
    message: 'Le titre doit contenir entre 1 et 120 caractères',
  })
  title?: string;

  @ApiPropertyOptional({ description: 'Description (1000 caractères max)' })
  @ValidateIf((dto: UpdatePageOfferDto) => dto.description !== undefined)
  @IsString({ message: 'La description doit être une chaîne' })
  @MaxLength(1000, {
    message: 'La description ne peut pas dépasser 1000 caractères',
  })
  description?: string;

  @ApiPropertyOptional({ description: "Image de l'offre — null pour effacer" })
  @ValidateIf(
    (dto: UpdatePageOfferDto) =>
      dto.imageUrl !== undefined && dto.imageUrl !== null,
  )
  @IsString({ message: "L'URL de l'image de l'offre doit être une chaîne" })
  @MaxLength(500, {
    message: "L'URL de l'image de l'offre ne peut pas dépasser 500 caractères",
  })
  imageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Début de validité (ISO 8601) — null pour retirer',
  })
  @ValidateIf(
    (dto: UpdatePageOfferDto) =>
      dto.startsAt !== undefined && dto.startsAt !== null,
  )
  @IsDateString({}, { message: 'startsAt doit être une date ISO 8601 valide' })
  startsAt?: string | null;

  @ApiPropertyOptional({
    description: 'Fin de validité (ISO 8601) — null pour retirer',
  })
  @ValidateIf(
    (dto: UpdatePageOfferDto) => dto.endsAt !== undefined && dto.endsAt !== null,
  )
  @IsDateString({}, { message: 'endsAt doit être une date ISO 8601 valide' })
  endsAt?: string | null;
}

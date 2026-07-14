import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Corps de PATCH /pages/:id/events/:eventId — patch partiel d'un événement.
 * startsAt n'est PAS nullable (un événement a toujours un début) ; endsAt et
 * imageUrl le sont. Cohérence de période vérifiée au SERVICE sur l'état
 * RÉSULTANT. */
export class UpdatePageEventDto {
  @ApiPropertyOptional({
    description: "Titre de l'événement (1 à 120 caractères)",
  })
  @ValidateIf((dto: UpdatePageEventDto) => dto.title !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le titre doit être une chaîne' })
  @Length(1, 120, {
    message: 'Le titre doit contenir entre 1 et 120 caractères',
  })
  title?: string;

  @ApiPropertyOptional({ description: 'Description (1000 caractères max)' })
  @ValidateIf((dto: UpdatePageEventDto) => dto.description !== undefined)
  @IsString({ message: 'La description doit être une chaîne' })
  @MaxLength(1000, {
    message: 'La description ne peut pas dépasser 1000 caractères',
  })
  description?: string;

  @ApiPropertyOptional({
    description: "Image de l'événement — null pour effacer",
  })
  @ValidateIf(
    (dto: UpdatePageEventDto) =>
      dto.imageUrl !== undefined && dto.imageUrl !== null,
  )
  @IsString({ message: "L'URL de l'image de l'événement doit être une chaîne" })
  @MaxLength(500, {
    message:
      "L'URL de l'image de l'événement ne peut pas dépasser 500 caractères",
  })
  imageUrl?: string | null;

  @ApiPropertyOptional({ description: "Début de l'événement (ISO 8601)" })
  @ValidateIf((dto: UpdatePageEventDto) => dto.startsAt !== undefined)
  @IsDateString({}, { message: 'startsAt doit être une date ISO 8601 valide' })
  startsAt?: string;

  @ApiPropertyOptional({
    description: "Fin de l'événement (ISO 8601) — null pour retirer",
  })
  @ValidateIf(
    (dto: UpdatePageEventDto) => dto.endsAt !== undefined && dto.endsAt !== null,
  )
  @IsDateString({}, { message: 'endsAt doit être une date ISO 8601 valide' })
  endsAt?: string | null;
}

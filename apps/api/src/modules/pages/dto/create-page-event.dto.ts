import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/** Corps de POST /pages/:id/events — événement de page (D72). startsAt est
 * OBLIGATOIRE ; cohérence startsAt ≤ endsAt vérifiée au SERVICE (400). */
export class CreatePageEventDto {
  @ApiProperty({
    description: "Titre de l'événement (1 à 120 caractères)",
    example: 'Soirée musique live',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le titre doit être une chaîne' })
  @Length(1, 120, {
    message: 'Le titre doit contenir entre 1 et 120 caractères',
  })
  title!: string;

  @ApiPropertyOptional({
    description: "Description de l'événement (1000 caractères max)",
  })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne' })
  @MaxLength(1000, {
    message: 'La description ne peut pas dépasser 1000 caractères',
  })
  description?: string;

  @ApiPropertyOptional({
    description: "Image de l'événement (upload Endirek — /media/upload)",
  })
  @IsOptional()
  @IsString({ message: "L'URL de l'image de l'événement doit être une chaîne" })
  @MaxLength(500, {
    message:
      "L'URL de l'image de l'événement ne peut pas dépasser 500 caractères",
  })
  imageUrl?: string;

  @ApiProperty({
    description: "Début de l'événement (ISO 8601)",
    example: '2026-07-17T15:00:00.000Z',
  })
  @IsDateString({}, { message: 'startsAt doit être une date ISO 8601 valide' })
  startsAt!: string;

  @ApiPropertyOptional({
    description:
      "Fin de l'événement (ISO 8601) — absente : début + 6 h (fin effective)",
  })
  @IsOptional()
  @IsDateString({}, { message: 'endsAt doit être une date ISO 8601 valide' })
  endsAt?: string;
}

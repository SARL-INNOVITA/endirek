import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/** Corps de POST /pages/:id/offers — offre de page (D72). Période
 * optionnelle ; cohérence startsAt ≤ endsAt vérifiée au SERVICE (400). */
export class CreatePageOfferDto {
  @ApiProperty({
    description: "Titre de l'offre (1 à 120 caractères)",
    example: 'Offre du midi −10 %',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le titre doit être une chaîne' })
  @Length(1, 120, {
    message: 'Le titre doit contenir entre 1 et 120 caractères',
  })
  title!: string;

  @ApiPropertyOptional({
    description: "Description de l'offre (1000 caractères max)",
  })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne' })
  @MaxLength(1000, {
    message: 'La description ne peut pas dépasser 1000 caractères',
  })
  description?: string;

  @ApiPropertyOptional({
    description: "Image de l'offre (upload Endirek — /media/upload)",
  })
  @IsOptional()
  @IsString({ message: "L'URL de l'image de l'offre doit être une chaîne" })
  @MaxLength(500, {
    message: "L'URL de l'image de l'offre ne peut pas dépasser 500 caractères",
  })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Début de validité (ISO 8601) — absent : toujours valable',
  })
  @IsOptional()
  @IsDateString({}, { message: 'startsAt doit être une date ISO 8601 valide' })
  startsAt?: string;

  @ApiPropertyOptional({
    description: 'Fin de validité (ISO 8601) — absente : sans limite',
  })
  @IsOptional()
  @IsDateString({}, { message: 'endsAt doit être une date ISO 8601 valide' })
  endsAt?: string;
}

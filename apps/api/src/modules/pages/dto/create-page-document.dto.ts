import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

/** Nombre maximal de documents « Nos cartes » par page. */
export const PAGE_DOCUMENTS_MAX = 5;

/** Corps de POST /pages/:id/documents — attache un document « Nos cartes »
 * (D71/D77). L'URL doit provenir de POST /media/upload-document (garde
 * /uploads/ au SERVICE) ; fileSizeBytes est renvoyé par cet upload. */
export class CreatePageDocumentDto {
  @ApiProperty({
    description: 'Libellé affiché (1 à 80 caractères)',
    example: 'Carte principale',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le libellé doit être une chaîne' })
  @Length(1, 80, {
    message: 'Le libellé doit contenir entre 1 et 80 caractères',
  })
  label!: string;

  @ApiProperty({
    description: 'URL du PDF issue de POST /media/upload-document',
  })
  @IsString({ message: "L'URL du document doit être une chaîne" })
  @IsNotEmpty({ message: "L'URL du document est obligatoire" })
  @MaxLength(500, {
    message: "L'URL du document ne peut pas dépasser 500 caractères",
  })
  url!: string;

  @ApiProperty({
    description: 'Taille du fichier en octets (renvoyée par l’upload)',
    example: 13264,
  })
  @Type(() => Number)
  @IsInt({ message: 'fileSizeBytes doit être un entier' })
  @Min(0, { message: 'fileSizeBytes doit être positif ou nul' })
  fileSizeBytes!: number;
}

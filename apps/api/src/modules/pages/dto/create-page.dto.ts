import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/** Types de page du contrat (D69). */
export const PAGE_TYPES = ['restaurant', 'business'] as const;

/** Nombre maximal de chips d'attributs d'une page (mockup 08). */
export const PAGE_ATTRIBUTES_MAX = 5;

/** Corps de POST /pages — création d'une page professionnelle (D69).
 * La page naît 'active' (« validation légère ») et non vérifiée ; le badge ✓
 * est accordé au backoffice. pageType et urlSlug (généré) sont IMMUABLES. */
export class CreatePageDto {
  @ApiProperty({
    description: 'Type de page — immuable après création',
    enum: PAGE_TYPES,
    example: 'restaurant',
  })
  @IsIn(PAGE_TYPES, {
    message: 'pageType doit être « restaurant » ou « business »',
  })
  pageType!: (typeof PAGE_TYPES)[number];

  @ApiProperty({
    description: 'Nom de la page (2 à 80 caractères)',
    example: 'Bon Goût',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le nom doit être une chaîne' })
  @Length(2, 80, { message: 'Le nom doit contenir entre 2 et 80 caractères' })
  name!: string;

  @ApiProperty({
    description:
      "Commune du référentiel La Réunion — l'adresse exacte n'est jamais " +
      'stockée (position = centre de la commune)',
    example: 'Saint-Denis',
  })
  @IsString({ message: 'La commune doit être une chaîne' })
  @Length(1, 80, {
    message: 'La commune doit contenir entre 1 et 80 caractères',
  })
  city!: string;

  @ApiPropertyOptional({ description: 'Bio de la page (500 caractères max)' })
  @IsOptional()
  @IsString({ message: 'La bio doit être une chaîne' })
  @MaxLength(500, { message: 'La bio ne peut pas dépasser 500 caractères' })
  bio?: string;

  @ApiPropertyOptional({
    description: 'Téléphone de contact (30 caractères max)',
    example: '0262 20 41 74',
  })
  @IsOptional()
  @IsString({ message: 'Le téléphone doit être une chaîne' })
  @MaxLength(30, {
    message: 'Le téléphone ne peut pas dépasser 30 caractères',
  })
  phone?: string;

  @ApiPropertyOptional({
    description:
      'Chips d’attributs affichées sous la bio (5 max, 30 caractères chacune)',
    example: ['Créole', 'Sur place', 'À emporter'],
  })
  @IsOptional()
  @ArrayMaxSize(PAGE_ATTRIBUTES_MAX, {
    message: `${PAGE_ATTRIBUTES_MAX} attributs maximum par page`,
  })
  @IsString({ each: true, message: 'Chaque attribut doit être une chaîne' })
  @Length(1, 30, {
    each: true,
    message: 'Chaque attribut doit contenir entre 1 et 30 caractères',
  })
  attributes?: string[];

  @ApiPropertyOptional({
    description: 'URL de l’avatar (upload Endirek — /media/upload)',
  })
  @IsOptional()
  @IsString({ message: "L'URL de l'avatar doit être une chaîne" })
  @MaxLength(500, {
    message: "L'URL de l'avatar ne peut pas dépasser 500 caractères",
  })
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'URL de la couverture (upload Endirek — /media/upload)',
  })
  @IsOptional()
  @IsString({ message: "L'URL de la couverture doit être une chaîne" })
  @MaxLength(500, {
    message: "L'URL de la couverture ne peut pas dépasser 500 caractères",
  })
  coverUrl?: string;
}

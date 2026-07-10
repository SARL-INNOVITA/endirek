import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LISTING_EXCHANGE_PREFS,
  LISTING_EXTERNAL_LINKS_MAX,
  LISTING_TAGS_MAX,
  LISTING_VALUE_KINDS,
  ListingExternalLinkDto,
} from './create-listing.dto';

/**
 * Corps de PATCH /dealplace/listings/:id — champs modifiables par le
 * propriétaire. Tous facultatifs (patch partiel). Le type d'annonce
 * (good/service), la commune, la localisation et les médias ne sont pas
 * modifiables au CP2.1 ; le statut passe par DELETE (soft-delete) ou le
 * backoffice. La cohérence valeur/catégorie est revérifiée par le service.
 */
export class UpdateListingDto {
  @ApiPropertyOptional({ description: 'Titre (1 à 120 caractères)' })
  @IsOptional()
  @IsString({ message: 'Le titre doit être une chaîne' })
  @Length(1, 120, { message: 'Le titre doit contenir entre 1 et 120 caractères' })
  title?: string;

  @ApiPropertyOptional({ description: 'Description (1 à 4000 caractères)' })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne' })
  @Length(1, 4000, {
    message: 'La description doit contenir entre 1 et 4000 caractères',
  })
  description?: string;

  @ApiPropertyOptional({ description: 'Slug de la catégorie (taxonomie active)' })
  @IsOptional()
  @IsString({ message: 'categorySlug doit être une chaîne' })
  @IsNotEmpty({ message: 'categorySlug ne peut pas être vide' })
  categorySlug?: string;

  @ApiPropertyOptional({
    description:
      'Slug de la sous-catégorie — doit appartenir à la catégorie résultante',
  })
  @IsOptional()
  @IsString({ message: 'subcategorySlug doit être une chaîne' })
  @IsNotEmpty({ message: 'subcategorySlug ne peut pas être vide' })
  subcategorySlug?: string;

  @ApiPropertyOptional({
    description: "Nature de la valeur : 'fixed' ou 'range'",
    enum: LISTING_VALUE_KINDS,
  })
  @IsOptional()
  @IsIn(LISTING_VALUE_KINDS, {
    message: "valueKind doit être « fixed » ou « range »",
  })
  valueKind?: (typeof LISTING_VALUE_KINDS)[number];

  @ApiPropertyOptional({ description: 'Valeur / borne basse en euros (>= 0)' })
  @IsOptional()
  @IsInt({ message: 'valueMin doit être un entier (euros)' })
  @Min(0, { message: 'valueMin doit être supérieur ou égal à 0' })
  @Max(100_000_000, { message: 'valueMin est hors des bornes admises' })
  valueMin?: number;

  @ApiPropertyOptional({
    description: 'Borne haute en euros (>= valueMin si « range »)',
  })
  @IsOptional()
  @IsInt({ message: 'valueMax doit être un entier (euros)' })
  @Min(0, { message: 'valueMax doit être supérieur ou égal à 0' })
  @Max(100_000_000, { message: 'valueMax est hors des bornes admises' })
  valueMax?: number;

  @ApiPropertyOptional({
    description: 'Préférences d\'échange — sous-ensemble NON VIDE',
    enum: LISTING_EXCHANGE_PREFS,
    isArray: true,
  })
  @IsOptional()
  @IsArray({ message: 'exchangePrefs doit être un tableau' })
  @ArrayNotEmpty({ message: 'exchangePrefs doit contenir au moins une valeur' })
  @IsIn(LISTING_EXCHANGE_PREFS, {
    each: true,
    message: 'Chaque préférence doit être goods, services, money ou open',
  })
  exchangePrefs?: (typeof LISTING_EXCHANGE_PREFS)[number][];

  @ApiPropertyOptional({
    description: 'Liens externes { label, url } (5 maximum) — remplace la liste',
    type: [ListingExternalLinkDto],
  })
  @IsOptional()
  @IsArray({ message: 'externalLinks doit être un tableau' })
  @ArrayMaxSize(LISTING_EXTERNAL_LINKS_MAX, {
    message: `${LISTING_EXTERNAL_LINKS_MAX} liens externes maximum`,
  })
  @ValidateNested({ each: true })
  @Type(() => ListingExternalLinkDto)
  externalLinks?: ListingExternalLinkDto[];

  @ApiPropertyOptional({
    description: 'Slugs de tags — remplace intégralement la liste (10 maximum)',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'tags doit être un tableau' })
  @ArrayMaxSize(LISTING_TAGS_MAX, {
    message: `${LISTING_TAGS_MAX} tags maximum par annonce`,
  })
  @IsString({ each: true, message: 'Chaque tag doit être une chaîne' })
  tags?: string[];
}

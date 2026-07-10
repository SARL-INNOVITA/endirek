import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Familles / types d'annonce du contrat (miroir de ListingFamily). */
export const LISTING_FAMILIES = ['good', 'service'] as const;

/** Natures de valeur (miroir de ListingValueKind). */
export const LISTING_VALUE_KINDS = ['fixed', 'range'] as const;

/** Préférences d'échange (miroir d'ExchangePref). */
export const LISTING_EXCHANGE_PREFS = [
  'goods',
  'services',
  'money',
  'open',
] as const;

/** Nombre maximum de médias par annonce (aligné sur les posts). */
export const LISTING_MEDIA_MAX = 8;

/** Nombre maximum de tags par annonce. */
export const LISTING_TAGS_MAX = 10;

/** Nombre maximum de liens externes par annonce. */
export const LISTING_EXTERNAL_LINKS_MAX = 5;

/** Média attaché à une annonce (URLs issues de POST /media/upload — toute URL
 * externe est refusée par le service : 400). Miroir de PostMediaInputDto. */
export class ListingMediaInputDto {
  @ApiProperty({
    description:
      "URL de l'image, telle que retournée par POST /media/upload — elle " +
      "doit provenir de l'hébergement Endirek (base `${API_PUBLIC_URL}/uploads/`) ; " +
      'toute URL externe est refusée (400)',
  })
  @IsString({ message: "L'URL du média doit être une chaîne" })
  @IsNotEmpty({ message: "L'URL du média est obligatoire" })
  url!: string;

  @ApiPropertyOptional({
    description:
      'URL de la miniature (retournée par /media/upload) — même contrainte ' +
      "d'origine Endirek que url (400 sinon)",
  })
  @IsOptional()
  @IsString({ message: 'thumbnailUrl doit être une chaîne' })
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Largeur en pixels' })
  @IsOptional()
  @IsInt({ message: 'width doit être un entier' })
  @Min(1, { message: 'width doit être positif' })
  width?: number;

  @ApiPropertyOptional({ description: 'Hauteur en pixels' })
  @IsOptional()
  @IsInt({ message: 'height doit être un entier' })
  @Min(1, { message: 'height doit être positif' })
  height?: number;

  @ApiPropertyOptional({
    description: "Type de média — 'image' uniquement au CP2.1",
    enum: ['image'],
    default: 'image',
  })
  @IsOptional()
  @IsIn(['image'], {
    message:
      'Seules les images sont disponibles au CP2.1 (vidéos : lot ultérieur)',
  })
  mediaType?: 'image';

  @ApiPropertyOptional({
    description: "Ordre d'affichage (0 = premier) — index du tableau si absent",
  })
  @IsOptional()
  @IsInt({ message: 'position doit être un entier' })
  @Min(0, { message: 'position doit être positive ou nulle' })
  position?: number;
}

/** Lien externe { label, url } attaché à une annonce. */
export class ListingExternalLinkDto {
  @ApiProperty({ description: 'Libellé affiché du lien (80 caractères max)' })
  @IsString({ message: 'Le libellé du lien doit être une chaîne' })
  @IsNotEmpty({ message: 'Le libellé du lien est obligatoire' })
  @MaxLength(80, { message: 'Le libellé du lien ne peut pas dépasser 80 caractères' })
  label!: string;

  @ApiProperty({ description: 'URL du lien (http/https)' })
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'Le lien doit être une URL http(s) valide' },
  )
  @MaxLength(2000, { message: 'Le lien ne peut pas dépasser 2000 caractères' })
  url!: string;
}

/** Corps de POST /dealplace/listings — création d'une annonce. */
export class CreateListingDto {
  @ApiProperty({
    description: "Type d'annonce : 'good' (bien) ou 'service'",
    enum: LISTING_FAMILIES,
    example: 'good',
  })
  @IsIn(LISTING_FAMILIES, {
    message: "listingType doit être « good » ou « service »",
  })
  listingType!: (typeof LISTING_FAMILIES)[number];

  @ApiProperty({ description: 'Titre (1 à 120 caractères)' })
  @IsString({ message: 'Le titre doit être une chaîne' })
  @Length(1, 120, { message: 'Le titre doit contenir entre 1 et 120 caractères' })
  title!: string;

  @ApiProperty({ description: 'Description (1 à 4000 caractères)' })
  @IsString({ message: 'La description doit être une chaîne' })
  @Length(1, 4000, {
    message: 'La description doit contenir entre 1 et 4000 caractères',
  })
  description!: string;

  @ApiProperty({ description: 'Slug de la catégorie (taxonomie active)' })
  @IsString({ message: 'categorySlug doit être une chaîne' })
  @IsNotEmpty({ message: 'categorySlug est obligatoire' })
  categorySlug!: string;

  @ApiProperty({
    description:
      'Slug de la sous-catégorie — doit appartenir à la catégorie (repli ' +
      '« autres-<cat> » autorisé)',
  })
  @IsString({ message: 'subcategorySlug doit être une chaîne' })
  @IsNotEmpty({ message: 'subcategorySlug est obligatoire' })
  subcategorySlug!: string;

  @ApiProperty({
    description:
      "Nature de la valeur : 'fixed' (valeur unique) ou 'range' (fourchette)",
    enum: LISTING_VALUE_KINDS,
    example: 'fixed',
  })
  @IsIn(LISTING_VALUE_KINDS, {
    message: "valueKind doit être « fixed » ou « range »",
  })
  valueKind!: (typeof LISTING_VALUE_KINDS)[number];

  @ApiProperty({
    description:
      'Valeur en euros entiers (>= 0). Pour « fixed » : la valeur ; pour ' +
      '« range » : la borne basse.',
  })
  @IsInt({ message: 'valueMin doit être un entier (euros)' })
  @Min(0, { message: 'valueMin doit être supérieur ou égal à 0' })
  @Max(100_000_000, { message: 'valueMin est hors des bornes admises' })
  valueMin!: number;

  @ApiPropertyOptional({
    description:
      'Borne haute en euros entiers — OBLIGATOIRE si valueKind=« range » ' +
      '(>= valueMin), interdite si « fixed »',
  })
  @IsOptional()
  @IsInt({ message: 'valueMax doit être un entier (euros)' })
  @Min(0, { message: 'valueMax doit être supérieur ou égal à 0' })
  @Max(100_000_000, { message: 'valueMax est hors des bornes admises' })
  valueMax?: number;

  @ApiPropertyOptional({
    description: "Devise (ISO 4217) — 'EUR' par défaut",
    default: 'EUR',
  })
  @IsOptional()
  @IsString({ message: 'currency doit être une chaîne' })
  @Length(3, 3, { message: 'currency doit être un code ISO 4217 à 3 lettres' })
  currency?: string;

  @ApiProperty({
    description:
      'Commune (référentiel des 12 communes de La Réunion) — l\'adresse ' +
      'exacte n\'est jamais stockée',
    example: 'Saint-Denis',
  })
  @IsString({ message: 'city doit être une chaîne' })
  @IsNotEmpty({ message: 'La commune est obligatoire' })
  @MaxLength(80, { message: 'La commune ne peut pas dépasser 80 caractères' })
  city!: string;

  @ApiProperty({
    description:
      'Préférences d\'échange — sous-ensemble NON VIDE de goods/services/money/open',
    enum: LISTING_EXCHANGE_PREFS,
    isArray: true,
    example: ['money', 'goods'],
  })
  @IsArray({ message: 'exchangePrefs doit être un tableau' })
  @ArrayNotEmpty({ message: 'exchangePrefs doit contenir au moins une valeur' })
  @IsIn(LISTING_EXCHANGE_PREFS, {
    each: true,
    message:
      'Chaque préférence doit être goods, services, money ou open',
  })
  exchangePrefs!: (typeof LISTING_EXCHANGE_PREFS)[number][];

  @ApiPropertyOptional({
    description: 'Liens externes { label, url } (5 maximum)',
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
    description:
      'Médias attachés (8 maximum, images uniquement au CP2.1). AU MOINS 1 ' +
      'est obligatoire pour un bien (listingType=« good »).',
    type: [ListingMediaInputDto],
  })
  @IsOptional()
  @IsArray({ message: 'media doit être un tableau' })
  @ArrayMaxSize(LISTING_MEDIA_MAX, {
    message: `${LISTING_MEDIA_MAX} médias maximum par annonce`,
  })
  @ValidateNested({ each: true })
  @Type(() => ListingMediaInputDto)
  media?: ListingMediaInputDto[];

  @ApiPropertyOptional({
    description: 'Slugs de tags transversaux (taxonomie active, 10 maximum)',
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

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LISTING_FAMILIES } from './create-listing.dto';

/**
 * Découpe un paramètre de requête « tags » en liste de slugs : accepte soit
 * une valeur répétée (?tags=a&tags=b), soit une chaîne séparée par des virgules
 * (?tags=a,b). Les entrées vides sont éliminées et les slugs DÉDOUBLONNÉS —
 * un doublon (?tags=a,a) ferait diverger les drivers (le mock teste
 * l'appartenance, postgres compte les tags DISTINCTS présents : parité) ;
 * `undefined` reste `undefined` (aucun filtre).
 */
function toTagSlugs(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const raw = Array.isArray(value) ? value : [value];
  const slugs = [
    ...new Set(
      raw
        .flatMap((entry) => String(entry).split(','))
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ];
  return slugs.length > 0 ? slugs : undefined;
}

/**
 * Filtres de l'annuaire public GET /dealplace/listings — tous facultatifs,
 * avec pagination bornée (limit ≤ 100). Ne renvoie que les annonces 'active'.
 */
export class ListListingsQueryDto {
  @ApiPropertyOptional({
    description: "Famille : 'good' ou 'service'",
    enum: LISTING_FAMILIES,
  })
  @IsOptional()
  @IsIn(LISTING_FAMILIES, { message: "family doit être « good » ou « service »" })
  family?: (typeof LISTING_FAMILIES)[number];

  @ApiPropertyOptional({ description: 'Slug de catégorie' })
  @IsOptional()
  @IsString({ message: 'category doit être une chaîne' })
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ description: 'Slug de sous-catégorie' })
  @IsOptional()
  @IsString({ message: 'subcategory doit être une chaîne' })
  @MaxLength(120)
  subcategory?: string;

  @ApiPropertyOptional({ description: 'Commune (correspondance exacte, insensible à la casse)' })
  @IsOptional()
  @IsString({ message: 'city doit être une chaîne' })
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ description: 'Borne basse de valeur (euros)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'valueMin doit être un entier' })
  @Min(0, { message: 'valueMin doit être positif ou nul' })
  valueMin?: number;

  @ApiPropertyOptional({ description: 'Borne haute de valeur (euros)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'valueMax doit être un entier' })
  @Min(0, { message: 'valueMax doit être positif ou nul' })
  valueMax?: number;

  @ApiPropertyOptional({
    description:
      'Tags requis (l\'annonce doit porter TOUS ces tags) — répétés ' +
      '(?tags=a&tags=b) ou séparés par des virgules (?tags=a,b)',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => toTagSlugs(value))
  @IsArray({ message: 'tags doit être une liste de slugs' })
  @IsString({ each: true, message: 'Chaque tag doit être une chaîne' })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Recherche insensible à la casse (titre + description)' })
  @IsOptional()
  @IsString({ message: 'search doit être une chaîne' })
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: "Nombre d'éléments par page (1 à 100)",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'limit doit être un entier' })
  @Min(1, { message: 'limit doit être au moins 1' })
  @Max(100, { message: 'limit ne peut pas dépasser 100' })
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Décalage de départ (0 = début de liste)',
    default: 0,
    minimum: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'offset doit être un entier' })
  @Min(0, { message: 'offset doit être positif ou nul' })
  offset: number = 0;
}

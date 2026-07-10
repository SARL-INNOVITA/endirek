import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Familles d'annonce (miroir de ListingFamily). */
const FAMILIES = ['good', 'service'] as const;

/** Statuts d'annonce (miroir de ListingStatus). */
const STATUSES = ['active', 'hidden', 'deleted'] as const;

/**
 * Filtres de la liste BACKOFFICE des annonces (GET /admin/dealplace/listings) —
 * TOUS statuts par défaut (y compris 'deleted' — audit), pagination bornée.
 */
export class AdminListListingsQueryDto {
  @ApiPropertyOptional({ description: "Filtrer par statut", enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES, { message: 'status invalide' })
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ description: 'Filtrer par famille', enum: FAMILIES })
  @IsOptional()
  @IsIn(FAMILIES, { message: 'family doit être « good » ou « service »' })
  family?: (typeof FAMILIES)[number];

  @ApiPropertyOptional({ description: 'Filtrer par slug de catégorie' })
  @IsOptional()
  @IsString({ message: 'category doit être une chaîne' })
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({
    description: 'Recherche insensible à la casse (titre, description, nom du propriétaire)',
  })
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

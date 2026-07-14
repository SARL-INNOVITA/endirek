import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageStatus, PageType } from '../../../database/domain/entities';

/** Types de page filtrables (Lot 3 — D69). */
const FILTERABLE_PAGE_TYPES: PageType[] = ['restaurant', 'business'];

/** Statuts de page filtrables — tous, y compris 'deleted' (audit). */
const FILTERABLE_PAGE_STATUSES: PageStatus[] = ['active', 'hidden', 'deleted'];

/** Transforme 'true'/'false' de la query string en booléen. */
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

/**
 * Paramètres de GET /admin/pages :
 * ?pageType=&status=&verified=&flaggedOnly=&search=&limit=&offset=.
 */
export class AdminListPagesQueryDto {
  @ApiPropertyOptional({
    description: 'Filtre par type de page',
    enum: FILTERABLE_PAGE_TYPES,
  })
  @IsOptional()
  @IsIn(FILTERABLE_PAGE_TYPES, {
    message: 'Le type doit être « restaurant » ou « business »',
  })
  pageType?: PageType;

  @ApiPropertyOptional({
    description: 'Filtre par statut de page',
    enum: FILTERABLE_PAGE_STATUSES,
  })
  @IsOptional()
  @IsIn(FILTERABLE_PAGE_STATUSES, {
    message: 'Le statut doit être « active », « hidden » ou « deleted »',
  })
  status?: PageStatus;

  @ApiPropertyOptional({
    description: 'true = pages vérifiées seulement, false = non vérifiées',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'verified doit être true ou false' })
  verified?: boolean;

  @ApiPropertyOptional({
    description:
      'true = seulement les pages avec au moins un signalement OUVERT',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'flaggedOnly doit être true ou false' })
  flaggedOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'Recherche insensible à la casse sur le nom de la page, la commune ' +
      'et le nom affiché du propriétaire',
  })
  @IsOptional()
  @IsString({ message: 'search doit être une chaîne' })
  @MaxLength(120, { message: 'search ne peut pas dépasser 120 caractères' })
  search?: string;

  @ApiPropertyOptional({ description: "Nombre d'éléments par page (1 à 100)", default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'limit doit être un entier' })
  @Min(1, { message: 'limit doit être au moins 1' })
  @Max(100, { message: 'limit ne peut pas dépasser 100' })
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Décalage de pagination', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'offset doit être un entier' })
  @Min(0, { message: 'offset doit être positif ou nul' })
  offset: number = 0;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Paramètres de pagination des listes publiques (followers / following) :
 * ?limit=&offset= — bornés pour protéger l'API (limit ≤ 100).
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Nombre d'éléments par page (1 à 100)",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'Le paramètre limit doit être un entier' })
  @Min(1, { message: 'Le paramètre limit doit être au moins 1' })
  @Max(100, { message: 'Le paramètre limit ne peut pas dépasser 100' })
  limit: number = 20;

  @ApiPropertyOptional({
    description: "Décalage de départ (0 = début de liste)",
    default: 0,
    minimum: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'Le paramètre offset doit être un entier' })
  @Min(0, { message: 'Le paramètre offset doit être positif ou nul' })
  offset: number = 0;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Paramètres de GET /posts/feed : pagination + position optionnelle du
 * viewer (lat/lng ENSEMBLE) pour le bonus de proximité du scoring.
 */
export class FeedQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Latitude du viewer (bonus de proximité) — à fournir AVEC lng',
    example: -20.8789,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: 'lat doit être un nombre' })
  @Min(-90, { message: 'lat doit être comprise entre -90 et 90' })
  @Max(90, { message: 'lat doit être comprise entre -90 et 90' })
  lat?: number;

  @ApiPropertyOptional({
    description:
      'Longitude du viewer (bonus de proximité) — à fournir AVEC lat',
    example: 55.4481,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: 'lng doit être un nombre' })
  @Min(-180, { message: 'lng doit être comprise entre -180 et 180' })
  @Max(180, { message: 'lng doit être comprise entre -180 et 180' })
  lng?: number;
}

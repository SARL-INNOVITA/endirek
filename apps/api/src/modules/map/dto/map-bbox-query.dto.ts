import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Boîte englobante optionnelle commune aux endpoints carte : les quatre bornes
 * vont ENSEMBLE (toutes ou aucune — vérifié par MapService.parseBbox). Sans
 * bbox : toute l'île. Base réutilisée par /map/posts, /map/cameras et
 * /map/overview (chaque DTO ajoute ses propres filtres types/categories).
 */
export class MapBboxQueryDto {
  @ApiPropertyOptional({ description: 'Latitude minimale de la bbox' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: 'minLat doit être un nombre' })
  @Min(-90, { message: 'minLat doit être comprise entre -90 et 90' })
  @Max(90, { message: 'minLat doit être comprise entre -90 et 90' })
  minLat?: number;

  @ApiPropertyOptional({ description: 'Longitude minimale de la bbox' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: 'minLng doit être un nombre' })
  @Min(-180, { message: 'minLng doit être comprise entre -180 et 180' })
  @Max(180, { message: 'minLng doit être comprise entre -180 et 180' })
  minLng?: number;

  @ApiPropertyOptional({ description: 'Latitude maximale de la bbox' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: 'maxLat doit être un nombre' })
  @Min(-90, { message: 'maxLat doit être comprise entre -90 et 90' })
  @Max(90, { message: 'maxLat doit être comprise entre -90 et 90' })
  maxLat?: number;

  @ApiPropertyOptional({ description: 'Longitude maximale de la bbox' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: 'maxLng doit être un nombre' })
  @Min(-180, { message: 'maxLng doit être comprise entre -180 et 180' })
  @Max(180, { message: 'maxLng doit être comprise entre -180 et 180' })
  maxLng?: number;
}

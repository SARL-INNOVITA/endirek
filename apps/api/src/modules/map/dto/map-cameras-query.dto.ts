import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional } from 'class-validator';
import { CameraCategory } from '../../../database/domain/entities';
import { MapBboxQueryDto } from './map-bbox-query.dto';
import { MAP_CAMERA_CATEGORIES, toStringList } from './map-query.util';

/**
 * GET /map/cameras : filtre optionnel `categories=` (weather,traffic) + bbox
 * optionnelle. Caméras 'active' uniquement (garanti par le service).
 */
export class MapCamerasQueryDto extends MapBboxQueryDto {
  @ApiPropertyOptional({
    description:
      'Filtre par catégories de caméra, séparées par des virgules ' +
      '(weather, traffic). Absent : les deux catégories.',
    example: 'traffic',
  })
  @IsOptional()
  @Transform(toStringList)
  @IsArray({ message: 'categories doit être une liste' })
  @IsIn(MAP_CAMERA_CATEGORIES, {
    each: true,
    message: 'categories accepte seulement weather ou traffic',
  })
  categories?: CameraCategory[];
}

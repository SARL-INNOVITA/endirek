import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional } from 'class-validator';
import { CameraCategory } from '../../../database/domain/entities';
import { MapBboxQueryDto } from './map-bbox-query.dto';
import {
  MAP_CAMERA_CATEGORIES,
  MAP_POST_TYPES,
  toStringList,
} from './map-query.util';

/**
 * GET /map/overview — UN SEUL appel pour la carte mobile : posts carte +
 * caméras actives dans la même bbox. Filtres optionnels indépendants :
 * `types=` (weather,traffic,danger) pour les posts, `categories=`
 * (weather,traffic) pour les caméras. bbox optionnelle (les 4 bornes
 * ensemble ; absente : toute l'île).
 *
 * `includeExpired` est IGNORÉ au Lot 1 (toujours false) : la carte ne montre
 * jamais un post expiré — documenté.
 */
export class MapOverviewQueryDto extends MapBboxQueryDto {
  @ApiPropertyOptional({
    description:
      'Filtre les POSTS par type carte (weather, traffic, danger), séparés ' +
      'par des virgules. Absent : les trois types.',
    example: 'weather,traffic,danger',
  })
  @IsOptional()
  @Transform(toStringList)
  @IsArray({ message: 'types doit être une liste' })
  @IsIn(MAP_POST_TYPES, {
    each: true,
    message:
      'types accepte seulement weather, traffic, danger, menu, offer ou event',
  })
  types?: string[];

  @ApiPropertyOptional({
    description:
      'Filtre les CAMÉRAS par catégorie (weather, traffic), séparées par ' +
      'des virgules. Absent : les deux catégories.',
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

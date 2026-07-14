import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional } from 'class-validator';
import { MapBboxQueryDto } from './map-bbox-query.dto';
import { MAP_POST_TYPES, toStringList } from './map-query.util';

/**
 * Boîte englobante optionnelle de GET /map/posts + filtre optionnel `types=`
 * (weather,traffic,danger). Les quatre bornes vont ENSEMBLE (toutes ou
 * aucune — vérifié par le service). Sans bbox : toute l'île.
 *
 * Note : quel que soit le filtre `types`, les posts free/question ne sortent
 * JAMAIS de cet endpoint — l'exclusion carte est portée par le service
 * (showsOnMap de post_types), pas par ce filtre.
 */
export class MapPostsQueryDto extends MapBboxQueryDto {
  @ApiPropertyOptional({
    description:
      'Filtre par types de post carte, séparés par des virgules ' +
      '(weather, traffic, danger). Absent : les trois types.',
    example: 'weather,traffic',
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
}

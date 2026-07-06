import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MapPostsQueryDto } from './dto/map-posts-query.dto';
import { CommuneView, MapPostItem, MapService } from './map.service';

/**
 * Contrôleur carte — endpoints PRÉPARATOIRES de l'étape 4 (pas d'UI carte
 * au Lot 1 étape 4 : l'écran carte complet, caméras incluses, arrive à
 * l'étape 5). Routes authentifiées (guard JWT global).
 */
@ApiTags('map')
@ApiBearerAuth()
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('communes')
  @ApiOperation({
    summary: 'Les 12 communes du référentiel (centres-villes WGS84)',
    description:
      'Référentiel du composer (choix de commune) et de la future carte.',
  })
  @ApiResponse({ status: 200, description: '[{ name, lat, lng }]' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listCommunes(): CommuneView[] {
    return this.mapService.listCommunes();
  }

  @Get('posts')
  @ApiOperation({
    summary: 'Marqueurs carte des publications',
    description:
      "Posts 'active' géolocalisés dont mapExpiresAt est dans le futur, " +
      'filtrés par la bbox minLat/minLng/maxLat/maxLng si fournie ' +
      '(les 4 bornes ensemble).',
  })
  @ApiResponse({ status: 200, description: '{ items: marqueurs }' })
  @ApiResponse({ status: 400, description: 'Boîte englobante invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listMapPosts(
    @Query() query: MapPostsQueryDto,
  ): Promise<{ items: MapPostItem[] }> {
    return this.mapService.listMapPosts(query);
  }
}

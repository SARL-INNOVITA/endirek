import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CameraPublicView } from '../cameras/cameras.service';
import { MapCamerasQueryDto } from './dto/map-cameras-query.dto';
import { MapOverviewQueryDto } from './dto/map-overview-query.dto';
import { MapPostsQueryDto } from './dto/map-posts-query.dto';
import {
  CommuneView,
  MapOverview,
  MapPostItem,
  MapService,
} from './map.service';

/**
 * Contrôleur carte (Lot 1 étape 5) — données de la page Carte (mode Météo &
 * trafic). Routes authentifiées (guard JWT global).
 *
 * /overview est le point d'entrée mobile : UN SEUL appel ramène posts +
 * caméras. /posts et /cameras restent disponibles séparément (rafraîchissement
 * ciblé, écrans dédiés).
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
      'Référentiel du composer (choix de commune) et de la carte.',
  })
  @ApiResponse({ status: 200, description: '[{ name, lat, lng }]' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listCommunes(): CommuneView[] {
    return this.mapService.listCommunes();
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Vue d’ensemble de la carte (posts + caméras)',
    description:
      'UN SEUL appel pour la carte mobile. Posts : « active » + location non ' +
      'nulle + mapExpiresAt futur + type météo/trafic/danger UNIQUEMENT ' +
      '(jamais free/question), filtre optionnel ?types=weather,traffic,danger. ' +
      'Caméras : « active » uniquement, filtre optionnel ' +
      '?categories=weather,traffic. bbox optionnelle (les 4 bornes ensemble ; ' +
      'absente = toute l’île). includeExpired est ignoré/false au Lot 1.',
  })
  @ApiResponse({
    status: 200,
    description: '{ posts: MAP_POST_ITEM[], cameras: CAMERA_PUBLIC[] }',
  })
  @ApiResponse({ status: 400, description: 'Boîte englobante invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  overview(@Query() query: MapOverviewQueryDto): Promise<MapOverview> {
    return this.mapService.overview(query);
  }

  @Get('cameras')
  @ApiOperation({
    summary: 'Caméras actives de la carte',
    description:
      'Caméras « active » uniquement (CAMERA_PUBLIC). Filtre optionnel ' +
      '?categories=weather,traffic et bbox optionnelle (les 4 bornes ' +
      'ensemble).',
  })
  @ApiResponse({ status: 200, description: '{ items: CAMERA_PUBLIC[] }' })
  @ApiResponse({ status: 400, description: 'Boîte englobante invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listCameras(
    @Query() query: MapCamerasQueryDto,
  ): Promise<{ items: CameraPublicView[] }> {
    return this.mapService.listMapCameras(query);
  }

  @Get('posts')
  @ApiOperation({
    summary: 'Marqueurs carte des publications',
    description:
      'Posts « active » géolocalisés, mapExpiresAt futur, type ' +
      'météo/trafic/danger uniquement (jamais free/question), filtrés par la ' +
      'bbox minLat/minLng/maxLat/maxLng si fournie (les 4 bornes ensemble) et ' +
      'par le filtre optionnel ?types=weather,traffic,danger.',
  })
  @ApiResponse({ status: 200, description: '{ items: MAP_POST_ITEM[] }' })
  @ApiResponse({ status: 400, description: 'Boîte englobante invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listMapPosts(
    @Query() query: MapPostsQueryDto,
  ): Promise<{ items: MapPostItem[] }> {
    return this.mapService.listMapPosts(query);
  }
}

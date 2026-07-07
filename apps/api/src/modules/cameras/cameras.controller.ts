import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CameraPublicView, CamerasService } from './cameras.service';

/**
 * Contrôleur public des caméras (authentifié — guard JWT global). Sert le
 * détail d'UNE caméra ACTIVE (CAMERA_PUBLIC, sans status/updatedAt).
 *
 * La liste publique des caméras vit sous /map (GET /map/cameras et
 * /map/overview) : la carte est le seul consommateur du parc actif.
 */
@ApiTags('cameras')
@ApiBearerAuth()
@Controller('cameras')
export class CamerasController {
  constructor(private readonly camerasService: CamerasService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Détail public d’une caméra active',
    description:
      'CAMERA_PUBLIC (sans status/updatedAt). 404 « Caméra introuvable » si ' +
      'la caméra n’existe pas OU n’est pas « active » — on ne révèle pas ' +
      'l’existence d’une caméra masquée, inactive ou en erreur.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la caméra' })
  @ApiResponse({ status: 200, description: 'CAMERA_PUBLIC' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 404, description: 'Caméra introuvable' })
  getById(@Param('id') id: string): Promise<CameraPublicView> {
    return this.camerasService.getPublicById(id);
  }
}

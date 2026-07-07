import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CameraAdminView,
  CamerasService,
  PagedAdminCameras,
} from '../cameras/cameras.service';
import { AdminListCamerasQueryDto } from '../cameras/dto/admin-list-cameras-query.dto';
import { CreateCameraDto } from '../cameras/dto/create-camera.dto';
import { UpdateCameraStatusDto } from '../cameras/dto/update-camera-status.dto';
import { UpdateCameraDto } from '../cameras/dto/update-camera.dto';

/**
 * Contrôleur backoffice des caméras (Lot 1 étape 5) — les 6 routes du contrat,
 * réservées aux rôles moderator et super_admin.
 *
 * Double protection sur TOUT le contrôleur : guard JWT GLOBAL (401 sans jeton)
 * + RolesGuard @Roles('moderator','super_admin') (403 pour un utilisateur
 * simple). Réutilise CamerasService — même source que la carte publique, sans
 * duplication de logique (garde La Réunion, géocodage, cameraNumber auto,
 * masquage doux).
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/cameras')
export class AdminCamerasController {
  constructor(private readonly camerasService: CamerasService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste des caméras (backoffice, tous statuts)',
    description:
      'Paginée, triée par numéro croissant. ?category= (weather|traffic), ' +
      '?status= (active|inactive|error|hidden), ?search= (nom/ville/' +
      'description, insensible à la casse).',
  })
  @ApiResponse({ status: 200, description: '{ items: CAMERA_ADMIN[], total }' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  list(@Query() query: AdminListCamerasQueryDto): Promise<PagedAdminCameras> {
    return this.camerasService.listAdmin({
      category: query.category,
      status: query.status,
      search: query.search,
      page: { limit: query.limit, offset: query.offset },
    });
  }

  @Post()
  @ApiOperation({
    summary: 'Créer une caméra (backoffice)',
    description:
      'cameraNumber attribué automatiquement. location DOIT être à La ' +
      'Réunion (400 sinon). cityName déduite par géocodage si absente. url ' +
      'validée (http/https).',
  })
  @ApiResponse({ status: 201, description: 'CAMERA_ADMIN' })
  @ApiResponse({
    status: 400,
    description: 'Validation invalide ou caméra hors de La Réunion',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  create(@Body() dto: CreateCameraDto): Promise<CameraAdminView> {
    return this.camerasService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une caméra (backoffice, tous statuts)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la caméra' })
  @ApiResponse({ status: 200, description: 'CAMERA_ADMIN' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Caméra introuvable' })
  getById(@Param('id') id: string): Promise<CameraAdminView> {
    return this.camerasService.getAdminById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier une caméra (backoffice)',
    description:
      'Champs partiels. location re-validée « à La Réunion » si fournie ; ' +
      'cityName inchangée sauf si fournie.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la caméra' })
  @ApiResponse({ status: 200, description: 'CAMERA_ADMIN' })
  @ApiResponse({
    status: 400,
    description: 'Validation invalide ou caméra hors de La Réunion',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Caméra introuvable' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCameraDto,
  ): Promise<CameraAdminView> {
    return this.camerasService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Changer le statut d’une caméra (backoffice)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la caméra' })
  @ApiResponse({ status: 200, description: 'CAMERA_ADMIN' })
  @ApiResponse({ status: 400, description: 'Statut invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Caméra introuvable' })
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCameraStatusDto,
  ): Promise<CameraAdminView> {
    return this.camerasService.setStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une caméra (backoffice — masquage doux)',
    description:
      'Suppression DOUCE : la caméra passe en statut « hidden » (pas de ' +
      'suppression dure, cameraNumber préservé). Elle disparaît de la carte ' +
      'et du détail public mais reste visible au backoffice.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la caméra' })
  @ApiResponse({ status: 204, description: 'Caméra masquée' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Caméra introuvable' })
  remove(@Param('id') id: string): Promise<void> {
    return this.camerasService.softDelete(id);
  }
}

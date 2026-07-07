import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CameraCategory,
  CameraStreamType,
} from '../../../database/domain/entities';
import { CameraLocationDto } from './camera-location.dto';
import {
  CAMERA_CATEGORIES,
  CAMERA_STREAM_TYPES,
} from './create-camera.dto';

/** Corps de PATCH /admin/cameras/:id — modification partielle. Tous les
 * champs sont facultatifs ; seuls ceux fournis sont modifiés. Le statut n'est
 * PAS modifiable ici (route dédiée PATCH :id/status). Si location est fournie,
 * elle est re-validée « à La Réunion » par le service ; cityName reste
 * inchangée sauf si explicitement fournie (pas de re-géocodage automatique
 * sur simple déplacement — décision documentée). */
export class UpdateCameraDto {
  @ApiPropertyOptional({ description: 'Nom (1 à 120 caractères)' })
  @IsOptional()
  @IsString({ message: 'Le nom doit être une chaîne' })
  @Length(1, 120, {
    message: 'Le nom doit contenir entre 1 et 120 caractères',
  })
  name?: string;

  @ApiPropertyOptional({ description: 'Type de flux', enum: CAMERA_STREAM_TYPES })
  @IsOptional()
  @IsIn(CAMERA_STREAM_TYPES, {
    message: 'Le type de flux doit être « image », « video » ou « iframe »',
  })
  streamType?: CameraStreamType;

  @ApiPropertyOptional({
    description: 'URL du flux (http/https, protocole obligatoire)',
  })
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    {
      message:
        'L’URL du flux doit être une URL valide (http ou https, protocole ' +
        'obligatoire)',
    },
  )
  url?: string;

  @ApiPropertyOptional({ description: 'Catégorie', enum: CAMERA_CATEGORIES })
  @IsOptional()
  @IsIn(CAMERA_CATEGORIES, {
    message: 'La catégorie doit être « weather » ou « traffic »',
  })
  category?: CameraCategory;

  @ApiPropertyOptional({ description: 'Description (500 caractères max)' })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne' })
  @MaxLength(500, {
    message: 'La description ne peut pas dépasser 500 caractères',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Position { lat, lng } — re-validée « à La Réunion »',
    type: CameraLocationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CameraLocationDto)
  location?: CameraLocationDto;

  @ApiPropertyOptional({ description: 'Commune affichée (120 caractères max)' })
  @IsOptional()
  @IsString({ message: 'La ville doit être une chaîne' })
  @MaxLength(120, { message: 'La ville ne peut pas dépasser 120 caractères' })
  cityName?: string;

  @ApiPropertyOptional({ description: 'Nom de quartier (120 caractères max)' })
  @IsOptional()
  @IsString({ message: 'Le quartier doit être une chaîne' })
  @MaxLength(120, { message: 'Le quartier ne peut pas dépasser 120 caractères' })
  districtName?: string;
}

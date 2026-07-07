import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  CameraStatus,
  CameraStreamType,
} from '../../../database/domain/entities';
import { CameraLocationDto } from './camera-location.dto';

/** Valeurs autorisées, miroir des unions du domaine (entities.ts). */
export const CAMERA_STREAM_TYPES: CameraStreamType[] = [
  'image',
  'video',
  'iframe',
];
export const CAMERA_CATEGORIES: CameraCategory[] = ['weather', 'traffic'];
export const CAMERA_STATUSES: CameraStatus[] = [
  'active',
  'inactive',
  'error',
  'hidden',
];

/** Corps de POST /admin/cameras — création d'une caméra. cameraNumber est
 * attribué automatiquement (jamais fourni). location DOIT être à La Réunion
 * (vérifié par le service). cityName est déduite par géocodage si absente. */
export class CreateCameraDto {
  @ApiProperty({ description: 'Nom de la caméra (1 à 120 caractères)' })
  @IsString({ message: 'Le nom doit être une chaîne' })
  @Length(1, 120, {
    message: 'Le nom doit contenir entre 1 et 120 caractères',
  })
  name!: string;

  @ApiProperty({
    description: 'Type de flux',
    enum: CAMERA_STREAM_TYPES,
  })
  @IsIn(CAMERA_STREAM_TYPES, {
    message: 'Le type de flux doit être « image », « video » ou « iframe »',
  })
  streamType!: CameraStreamType;

  @ApiProperty({
    description: 'URL du flux (http/https, protocole obligatoire)',
    example: 'https://cams.example.re/littoral.jpg',
  })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    {
      message:
        'L’URL du flux doit être une URL valide (http ou https, protocole ' +
        'obligatoire)',
    },
  )
  url!: string;

  @ApiProperty({ description: 'Catégorie', enum: CAMERA_CATEGORIES })
  @IsIn(CAMERA_CATEGORIES, {
    message: 'La catégorie doit être « weather » ou « traffic »',
  })
  category!: CameraCategory;

  @ApiPropertyOptional({ description: 'Description (500 caractères max)' })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne' })
  @MaxLength(500, {
    message: 'La description ne peut pas dépasser 500 caractères',
  })
  description?: string;

  @ApiProperty({
    description: 'Position { lat, lng } — doit se situer à La Réunion',
    type: CameraLocationDto,
  })
  @ValidateNested()
  @Type(() => CameraLocationDto)
  location!: CameraLocationDto;

  @ApiPropertyOptional({
    description:
      'Commune affichée (120 caractères max) — déduite par géocodage si ' +
      'absente ou vide',
  })
  @IsOptional()
  @IsString({ message: 'La ville doit être une chaîne' })
  @MaxLength(120, { message: 'La ville ne peut pas dépasser 120 caractères' })
  cityName?: string;

  @ApiPropertyOptional({
    description: 'Nom de quartier (facultatif, 120 caractères max)',
  })
  @IsOptional()
  @IsString({ message: 'Le quartier doit être une chaîne' })
  @MaxLength(120, { message: 'Le quartier ne peut pas dépasser 120 caractères' })
  districtName?: string;

  @ApiPropertyOptional({
    description: 'Statut initial (défaut « active »)',
    enum: CAMERA_STATUSES,
    default: 'active',
  })
  @IsOptional()
  @IsIn(CAMERA_STATUSES, {
    message:
      'Le statut doit être « active », « inactive », « error » ou « hidden »',
  })
  status?: CameraStatus;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  CameraCategory,
  CameraStatus,
} from '../../../database/domain/entities';
import { CAMERA_CATEGORIES, CAMERA_STATUSES } from './create-camera.dto';

/**
 * Paramètres de GET /admin/cameras : ?category=&status=&search=&limit=&offset=.
 * Hérite de la pagination bornée commune (limit 1-100, offset ≥ 0). TOUS les
 * statuts sont listés par défaut (le backoffice voit les caméras masquées).
 */
export class AdminListCamerasQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtre par catégorie',
    enum: CAMERA_CATEGORIES,
  })
  @IsOptional()
  @IsIn(CAMERA_CATEGORIES, {
    message: 'La catégorie doit être « weather » ou « traffic »',
  })
  category?: CameraCategory;

  @ApiPropertyOptional({
    description: 'Filtre par statut',
    enum: CAMERA_STATUSES,
  })
  @IsOptional()
  @IsIn(CAMERA_STATUSES, {
    message:
      'Le statut doit être « active », « inactive », « error » ou « hidden »',
  })
  status?: CameraStatus;

  @ApiPropertyOptional({
    description:
      'Recherche insensible à la casse sur le nom, la ville et la ' +
      'description',
    example: 'littoral',
  })
  @IsOptional()
  @IsString({
    message: 'Le paramètre search doit être une chaîne de caractères',
  })
  search?: string;
}

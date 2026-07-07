import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CameraStatus } from '../../../database/domain/entities';
import { CAMERA_STATUSES } from './create-camera.dto';

/** Corps de PATCH /admin/cameras/:id/status. */
export class UpdateCameraStatusDto {
  @ApiProperty({
    description: 'Nouveau statut de la caméra',
    enum: CAMERA_STATUSES,
    example: 'active',
  })
  @IsIn(CAMERA_STATUSES, {
    message:
      'Le statut doit être « active », « inactive », « error » ou « hidden »',
  })
  status!: CameraStatus;
}

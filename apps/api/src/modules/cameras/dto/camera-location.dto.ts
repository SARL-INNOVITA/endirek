import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

/** Position géographique d'une caméra ({ lat, lng } WGS84). La garde « à La
 * Réunion » est vérifiée par le service (isWithinReunion), pas ici : le DTO ne
 * borne que le domaine WGS84 valide. */
export class CameraLocationDto {
  @ApiProperty({ description: 'Latitude WGS84', example: -20.8789 })
  @IsNumber({}, { message: 'lat doit être un nombre' })
  @Min(-90, { message: 'lat doit être comprise entre -90 et 90' })
  @Max(90, { message: 'lat doit être comprise entre -90 et 90' })
  lat!: number;

  @ApiProperty({ description: 'Longitude WGS84', example: 55.4481 })
  @IsNumber({}, { message: 'lng doit être un nombre' })
  @Min(-180, { message: 'lng doit être comprise entre -180 et 180' })
  @Max(180, { message: 'lng doit être comprise entre -180 et 180' })
  lng!: number;
}

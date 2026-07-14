import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Nombre maximal de plages horaires au TOTAL (7 jours × 4 plages). */
export const PAGE_HOURS_MAX = 28;

/** Format d'heure locale accepté : 'HH:MM' (00:00 → 23:59). */
const HH_MM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Une plage d'ouverture (heures locales Réunion — D70). */
export class PageHourInputDto {
  @ApiProperty({ description: '0 = lundi ... 6 = dimanche', minimum: 0, maximum: 6 })
  @Type(() => Number)
  @IsInt({ message: 'weekday doit être un entier' })
  @Min(0, { message: 'weekday doit être compris entre 0 (lundi) et 6 (dimanche)' })
  @Max(6, { message: 'weekday doit être compris entre 0 (lundi) et 6 (dimanche)' })
  weekday!: number;

  @ApiProperty({ description: "Heure d'ouverture locale 'HH:MM'", example: '11:30' })
  @Matches(HH_MM_PATTERN, {
    message: "opensAt doit être au format 'HH:MM' (ex. 11:30)",
  })
  opensAt!: string;

  @ApiProperty({ description: "Heure de fermeture locale 'HH:MM'", example: '14:30' })
  @Matches(HH_MM_PATTERN, {
    message: "closesAt doit être au format 'HH:MM' (ex. 14:30)",
  })
  closesAt!: string;
}

/** Corps de PUT /pages/:id/hours — REMPLACE toutes les plages de la page
 * ([] = aucune plage : la page apparaît « Fermé » en permanence — D70).
 * Cohérence (ouverture < fermeture, pas de chevauchement, 4 plages max par
 * jour) vérifiée au SERVICE. */
export class ReplaceHoursDto {
  @ApiProperty({ type: [PageHourInputDto] })
  @IsArray({ message: 'hours doit être un tableau de plages' })
  @ArrayMaxSize(PAGE_HOURS_MAX, {
    message: `${PAGE_HOURS_MAX} plages maximum (7 jours × 4 plages)`,
  })
  @ValidateNested({ each: true })
  @Type(() => PageHourInputDto)
  hours!: PageHourInputDto[];
}

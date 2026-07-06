import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Statuts posables lors du traitement d'un signalement : le retour à
 * 'open' n'existe pas (un signalement traité l'est définitivement au
 * Lot 1 — un nouveau signalement peut toujours être créé par ailleurs). */
export const HANDLE_REPORT_STATUSES = [
  'reviewed',
  'action_taken',
  'dismissed',
] as const;

/** Statut de traitement d'un signalement (sous-ensemble de ReportStatus). */
export type HandleReportStatus = (typeof HANDLE_REPORT_STATUSES)[number];

/** Corps de PATCH /admin/reports/:id. */
export class HandleReportDto {
  @ApiProperty({
    description:
      'Décision de modération : « reviewed » (vu, rien à faire pour ' +
      'l’instant), « action_taken » (contenu masqué ou autre mesure) ou ' +
      '« dismissed » (signalement rejeté)',
    enum: HANDLE_REPORT_STATUSES,
    example: 'reviewed',
  })
  @IsIn(HANDLE_REPORT_STATUSES, {
    message:
      'Le statut doit être « reviewed », « action_taken » ou « dismissed »',
  })
  status!: HandleReportStatus;

  @ApiPropertyOptional({
    description: 'Note interne de résolution (500 caractères maximum)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'La note de résolution doit être une chaîne de caractères' })
  @MaxLength(500, {
    message: 'La note de résolution ne peut pas dépasser 500 caractères',
  })
  resolutionNote?: string;
}

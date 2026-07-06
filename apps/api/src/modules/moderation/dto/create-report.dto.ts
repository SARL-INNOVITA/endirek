import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportReasonCode } from '../../../database/domain/entities';

/** Motifs de signalement acceptés — codes documentés du schéma (TEXT côté
 * SQL, pilotés côté application, voir docs/DATABASE.md table reports). */
export const REPORT_REASON_CODES: ReportReasonCode[] = [
  'spam',
  'hateful',
  'dangerous',
  'false_info',
  'other',
];

/** Corps de POST /posts/:id/report — signalement d'une publication. */
export class CreateReportDto {
  @ApiProperty({
    description: 'Motif du signalement',
    enum: REPORT_REASON_CODES,
    example: 'spam',
  })
  @IsIn(REPORT_REASON_CODES, {
    message: `Motif de signalement invalide (attendu : ${REPORT_REASON_CODES.join(', ')})`,
  })
  reasonCode!: ReportReasonCode;

  @ApiPropertyOptional({
    description: 'Précisions libres (500 caractères max)',
  })
  @IsOptional()
  @IsString({ message: 'Le message doit être une chaîne' })
  @MaxLength(500, {
    message: 'Le message ne peut pas dépasser 500 caractères',
  })
  message?: string;
}

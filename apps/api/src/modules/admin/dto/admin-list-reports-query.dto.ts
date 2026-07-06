import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  ReportStatus,
  ReportTargetType,
} from '../../../database/domain/entities';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Statuts filtrables de la file de modération (cycle de vie complet). */
const FILTERABLE_REPORT_STATUSES: ReportStatus[] = [
  'open',
  'reviewed',
  'action_taken',
  'dismissed',
];

/** Types de cible filtrables — 'user' est déjà supporté par le schéma
 * (cible polymorphe) même si le signalement d'un profil n'ouvre qu'au
 * Lot 2+. */
const FILTERABLE_TARGET_TYPES: ReportTargetType[] = [
  'post',
  'comment',
  'user',
];

/**
 * Paramètres de GET /admin/reports : ?status=&targetType=&limit=&offset=.
 * Hérite de la pagination bornée commune (limit 1-100, offset ≥ 0).
 */
export class AdminListReportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtre par statut de signalement',
    enum: FILTERABLE_REPORT_STATUSES,
  })
  @IsOptional()
  @IsIn(FILTERABLE_REPORT_STATUSES, {
    message:
      'Le statut doit être « open », « reviewed », « action_taken » ou ' +
      '« dismissed »',
  })
  status?: ReportStatus;

  @ApiPropertyOptional({
    description: 'Filtre par type de cible signalée',
    enum: FILTERABLE_TARGET_TYPES,
  })
  @IsOptional()
  @IsIn(FILTERABLE_TARGET_TYPES, {
    message:
      'Le type de cible doit être « post », « comment » ou « user »',
  })
  targetType?: ReportTargetType;
}

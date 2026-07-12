import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DealStatus } from '../../../database/domain/entities';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Statuts filtrables de la liste backoffice des deals (cycle complet D64). */
const FILTERABLE_DEAL_STATUSES: DealStatus[] = [
  'proposed',
  'active',
  'completed',
  'declined',
  'cancelled',
  'disputed',
];

/**
 * Paramètres de GET /admin/dealplace/deals : ?status=&search=&limit=&offset=
 * (CP2.5 — D66). Hérite de la pagination bornée commune (limit 1-100,
 * offset ≥ 0). ?status=disputed = la file « litiges à arbitrer ».
 */
export class AdminListDealsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Filtre par statut de deal (« disputed » = litiges à arbitrer)',
    enum: FILTERABLE_DEAL_STATUSES,
  })
  @IsOptional()
  @IsIn(FILTERABLE_DEAL_STATUSES, {
    message:
      'Le statut doit être « proposed », « active », « completed », ' +
      '« declined », « cancelled » ou « disputed »',
  })
  status?: DealStatus;

  @ApiPropertyOptional({
    description:
      'Recherche insensible à la casse sur le nom d’une des parties ou le ' +
      'titre de l’annonce ; une saisie entièrement numérique matche aussi ' +
      'le numéro exact du deal',
    example: 'Valérie',
  })
  @IsOptional()
  @IsString({ message: 'search doit être une chaîne' })
  @MaxLength(200)
  search?: string;
}

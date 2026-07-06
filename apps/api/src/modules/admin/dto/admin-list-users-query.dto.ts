import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '../../../database/domain/entities';
import { PaginationQueryDto } from '../../users/dto/pagination-query.dto';

/** Statuts filtrables dans la liste du backoffice — TOUS les statuts, y
 * compris 'deleted' : un administrateur doit pouvoir retrouver les comptes
 * supprimés (audit RGPD), contrairement au PATCH qui ne les touche jamais. */
const FILTERABLE_STATUSES: UserStatus[] = ['active', 'suspended', 'deleted'];

/**
 * Paramètres de GET /admin/users : ?search=&status=&limit=&offset=.
 * Hérite de la pagination bornée commune (limit 1-100, offset ≥ 0).
 */
export class AdminListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Recherche insensible à la casse sur le nom affiché et l’email',
    example: 'payet',
  })
  @IsOptional()
  @IsString({ message: 'Le paramètre search doit être une chaîne de caractères' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtre par statut de compte',
    enum: FILTERABLE_STATUSES,
  })
  @IsOptional()
  @IsIn(FILTERABLE_STATUSES, {
    message: 'Le statut doit être « active », « suspended » ou « deleted »',
  })
  status?: UserStatus;
}

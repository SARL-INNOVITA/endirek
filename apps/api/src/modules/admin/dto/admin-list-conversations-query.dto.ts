import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Paramètres de GET /admin/dealplace/conversations : ?search=&limit=&offset=
 * (CP2.5 — D67). Hérite de la pagination bornée commune (limit 1-100,
 * offset ≥ 0).
 */
export class AdminListConversationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Recherche insensible à la casse sur le nom affiché d’un participant ' +
      'ou le titre de l’annonce liée',
    example: 'Kévin',
  })
  @IsOptional()
  @IsString({ message: 'search doit être une chaîne' })
  @MaxLength(200)
  search?: string;
}

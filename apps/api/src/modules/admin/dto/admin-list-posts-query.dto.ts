import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PostStatus } from '../../../database/domain/entities';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Statuts filtrables dans la liste backoffice des publications — TOUS les
 * statuts, y compris 'deleted' : un modérateur doit pouvoir retrouver les
 * publications supprimées (audit), contrairement au PATCH qui ne pose
 * jamais 'deleted'. */
const FILTERABLE_POST_STATUSES: PostStatus[] = ['active', 'hidden', 'deleted'];

/**
 * Paramètres de GET /admin/posts : ?typeSlug=&status=&search=&limit=&offset=.
 * Hérite de la pagination bornée commune (limit 1-100, offset ≥ 0).
 */
export class AdminListPostsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtre par type de publication (slug de post_types)',
    example: 'weather',
  })
  @IsOptional()
  @IsString({
    message: 'Le paramètre typeSlug doit être une chaîne de caractères',
  })
  typeSlug?: string;

  @ApiPropertyOptional({
    description: 'Filtre par statut de publication',
    enum: FILTERABLE_POST_STATUSES,
  })
  @IsOptional()
  @IsIn(FILTERABLE_POST_STATUSES, {
    message: 'Le statut doit être « active », « hidden » ou « deleted »',
  })
  status?: PostStatus;

  @ApiPropertyOptional({
    description:
      'Filtre carte : true = visible actuellement sur la carte, false = hors carte',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean({
    message: 'Le parametre mapVisible doit etre true ou false',
  })
  mapVisible?: boolean;

  @ApiPropertyOptional({
    description:
      'Recherche insensible à la casse sur le titre, le corps et le nom ' +
      'affiché de l’auteur',
    example: 'houle',
  })
  @IsOptional()
  @IsString({
    message: 'Le paramètre search doit être une chaîne de caractères',
  })
  search?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { LISTING_FAMILIES } from './create-listing.dto';

/**
 * Paramètres des listes d'annonces d'un PROFIL (`/users/me/listings` et
 * `/users/:id/listings`) : pagination commune + filtre facultatif par famille
 * (`?family=good|service`) — sections « Services » / « Biens » du volet
 * Profil Dealplace (CP2.2). Absent = toutes les annonces du profil.
 */
export class OwnerListingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "Filtre par famille d'annonce : 'good' (biens) ou 'service' (services)",
    enum: LISTING_FAMILIES,
  })
  @IsOptional()
  @IsIn(LISTING_FAMILIES, {
    message: "family doit être « good » ou « service »",
  })
  family?: (typeof LISTING_FAMILIES)[number];
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * PATCH /admin/post-types/:slug.
 *
 * Le slug reste immuable : il sert de cle metier partout (posts, map,
 * composer mobile). Les changements de duree carte ne recalculent pas les
 * posts existants ; ils s'appliquent aux nouvelles creations.
 */
export class UpdatePostTypeDto {
  @ApiPropertyOptional({ description: 'Libelle affiche en francais' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  labelFr?: string;

  @ApiPropertyOptional({ description: 'Nom d’icone/emoji interprete par les clients' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @ApiPropertyOptional({ description: 'Couleur hexadecimale #RRGGBB' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'La couleur doit etre au format #RRGGBB',
  })
  color?: string;

  @ApiPropertyOptional({ description: 'Type actif dans le composer mobile' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Type eligible a la carte publique' })
  @IsOptional()
  @IsBoolean()
  showsOnMap?: boolean;

  @ApiPropertyOptional({ description: 'Location requise pour la carte' })
  @IsOptional()
  @IsBoolean()
  requiresLocationForMap?: boolean;

  @ApiPropertyOptional({
    description: 'Duree de visibilite carte par defaut, en minutes',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7 * 24 * 60)
  defaultMapDurationMinutes?: number | null;

  @ApiPropertyOptional({ description: 'Ordre d’affichage' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;
}

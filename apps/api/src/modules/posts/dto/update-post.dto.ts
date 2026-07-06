import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * Corps de PATCH /posts/:id — seuls `title` et `body` sont modifiables au
 * MVP. Le TYPE et la LOCATION d'un post ne se changent pas après coup
 * (décision produit : les règles carte — mapExpiresAt, city déduite — sont
 * figées à la création ; modifier la position réécrirait l'historique carte).
 */
export class UpdatePostDto {
  @ApiPropertyOptional({ description: 'Nouveau titre (120 caractères max)' })
  @IsOptional()
  @IsString({ message: 'Le titre doit être une chaîne' })
  @MaxLength(120, { message: 'Le titre ne peut pas dépasser 120 caractères' })
  title?: string;

  @ApiPropertyOptional({ description: 'Nouveau texte (1 à 2000 caractères)' })
  @IsOptional()
  @IsString({ message: 'Le texte doit être une chaîne' })
  @Length(1, 2000, {
    message: 'Le texte doit contenir entre 1 et 2000 caractères',
  })
  body?: string;
}

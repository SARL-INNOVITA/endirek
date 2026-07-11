import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Corps de POST /deals/:id/review — avis sur le PARTENAIRE d'un deal CONCLU
 * (une seule fois, non modifiable). Les trois critères du mockup 05 :
 * Honnêteté et fiabilité / Conformité à la description / Amabilité et
 * courtoisie, notés de 1 à 5. La note globale est calculée (moyenne).
 */
export class SubmitReviewDto {
  @ApiProperty({ description: 'Honnêteté et fiabilité (1 à 5)', minimum: 1, maximum: 5 })
  @IsInt({ message: 'ratingHonesty doit être un entier' })
  @Min(1, { message: 'ratingHonesty doit être entre 1 et 5' })
  @Max(5, { message: 'ratingHonesty doit être entre 1 et 5' })
  ratingHonesty!: number;

  @ApiProperty({ description: 'Conformité à la description (1 à 5)', minimum: 1, maximum: 5 })
  @IsInt({ message: 'ratingConformity doit être un entier' })
  @Min(1, { message: 'ratingConformity doit être entre 1 et 5' })
  @Max(5, { message: 'ratingConformity doit être entre 1 et 5' })
  ratingConformity!: number;

  @ApiProperty({ description: 'Amabilité et courtoisie (1 à 5)', minimum: 1, maximum: 5 })
  @IsInt({ message: 'ratingKindness doit être un entier' })
  @Min(1, { message: 'ratingKindness doit être entre 1 et 5' })
  @Max(5, { message: 'ratingKindness doit être entre 1 et 5' })
  ratingKindness!: number;

  @ApiPropertyOptional({ description: 'Commentaire (500 caractères max)' })
  @IsOptional()
  @IsString({ message: 'Le commentaire doit être une chaîne' })
  @MaxLength(500, {
    message: 'Le commentaire ne peut pas dépasser 500 caractères',
  })
  comment?: string;
}

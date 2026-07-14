import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Prix maximal d'un plat, en centimes (garde-fou de saisie). */
export const DISH_PRICE_MAX_CENTS = 100_000_000;

/** Corps de POST /pages/:id/dishes — plat prédéfini d'un restaurant (D71).
 * Prix en CENTIMES (12,50 € = 1250) ; AU MOINS un des deux prix est requis
 * (règle croisée vérifiée au SERVICE — 400). */
export class CreateDishDto {
  @ApiProperty({
    description: 'Nom du plat (1 à 80 caractères)',
    example: 'Rougail saucisses',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le nom du plat doit être une chaîne' })
  @Length(1, 80, {
    message: 'Le nom du plat doit contenir entre 1 et 80 caractères',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Description du plat (300 caractères max)',
    example: 'Rougail saucisses, riz, grains, sauce piment maison.',
  })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne' })
  @MaxLength(300, {
    message: 'La description ne peut pas dépasser 300 caractères',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Image du plat (upload Endirek — /media/upload)',
  })
  @IsOptional()
  @IsString({ message: "L'URL de l'image du plat doit être une chaîne" })
  @MaxLength(500, {
    message: "L'URL de l'image du plat ne peut pas dépasser 500 caractères",
  })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Prix à emporter en CENTIMES (700 = 7,00 €)',
    example: 700,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'priceTakeawayCents doit être un entier (centimes)' })
  @Min(0, { message: 'priceTakeawayCents doit être supérieur ou égal à 0' })
  @Max(DISH_PRICE_MAX_CENTS, {
    message: 'priceTakeawayCents est hors des bornes admises',
  })
  priceTakeawayCents?: number;

  @ApiPropertyOptional({
    description: 'Prix sur place en CENTIMES (1200 = 12,00 €)',
    example: 1200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'priceDineInCents doit être un entier (centimes)' })
  @Min(0, { message: 'priceDineInCents doit être supérieur ou égal à 0' })
  @Max(DISH_PRICE_MAX_CENTS, {
    message: 'priceDineInCents est hors des bornes admises',
  })
  priceDineInCents?: number;
}

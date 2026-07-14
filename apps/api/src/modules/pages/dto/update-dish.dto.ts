import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { DISH_PRICE_MAX_CENTS } from './create-dish.dto';

/** Corps de PATCH /pages/:id/dishes/:dishId — patch partiel d'un plat.
 * Les prix sont nullables (retirer un prix) MAIS au moins un des deux prix
 * doit rester sur l'état RÉSULTANT (règle croisée au SERVICE — 400). */
export class UpdateDishDto {
  @ApiPropertyOptional({ description: 'Nom du plat (1 à 80 caractères)' })
  @ValidateIf((dto: UpdateDishDto) => dto.name !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le nom du plat doit être une chaîne' })
  @Length(1, 80, {
    message: 'Le nom du plat doit contenir entre 1 et 80 caractères',
  })
  name?: string;

  @ApiPropertyOptional({ description: 'Description (300 caractères max)' })
  @ValidateIf((dto: UpdateDishDto) => dto.description !== undefined)
  @IsString({ message: 'La description doit être une chaîne' })
  @MaxLength(300, {
    message: 'La description ne peut pas dépasser 300 caractères',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Image du plat — null pour effacer',
  })
  @ValidateIf(
    (dto: UpdateDishDto) => dto.imageUrl !== undefined && dto.imageUrl !== null,
  )
  @IsString({ message: "L'URL de l'image du plat doit être une chaîne" })
  @MaxLength(500, {
    message: "L'URL de l'image du plat ne peut pas dépasser 500 caractères",
  })
  imageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Prix à emporter en CENTIMES — null pour retirer ce prix',
  })
  @ValidateIf(
    (dto: UpdateDishDto) =>
      dto.priceTakeawayCents !== undefined && dto.priceTakeawayCents !== null,
  )
  @Type(() => Number)
  @IsInt({ message: 'priceTakeawayCents doit être un entier (centimes)' })
  @Min(0, { message: 'priceTakeawayCents doit être supérieur ou égal à 0' })
  @Max(DISH_PRICE_MAX_CENTS, {
    message: 'priceTakeawayCents est hors des bornes admises',
  })
  priceTakeawayCents?: number | null;

  @ApiPropertyOptional({
    description: 'Prix sur place en CENTIMES — null pour retirer ce prix',
  })
  @ValidateIf(
    (dto: UpdateDishDto) =>
      dto.priceDineInCents !== undefined && dto.priceDineInCents !== null,
  )
  @Type(() => Number)
  @IsInt({ message: 'priceDineInCents doit être un entier (centimes)' })
  @Min(0, { message: 'priceDineInCents doit être supérieur ou égal à 0' })
  @Max(DISH_PRICE_MAX_CENTS, {
    message: 'priceDineInCents est hors des bornes admises',
  })
  priceDineInCents?: number | null;
}

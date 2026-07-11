import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Natures d'un élément de deal (miroir de DealItemKind). */
export const DEAL_ITEM_KINDS = ['service', 'good', 'money'] as const;

/** Bornes : un deal reste lisible (mockup 07 = 2-4 éléments par partie). */
export const DEAL_ITEMS_MAX = 12;
export const DEAL_ITEM_STEPS_MAX = 8;

/** Élément d'un deal (proposition, édition, ajustement « add »). */
export class DealItemDto {
  @ApiPropertyOptional({
    description:
      "Fournisseur de l'élément — une des deux parties du deal ; absent = " +
      "l'auteur de la proposition",
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'providerId doit être un identifiant valide' })
  providerId?: string;

  @ApiProperty({
    description: "Nature : 'service', 'good' (bien) ou 'money' (paiement)",
    enum: DEAL_ITEM_KINDS,
  })
  @IsIn(DEAL_ITEM_KINDS, {
    message: 'kind doit être « service », « good » ou « money »',
  })
  kind!: (typeof DEAL_ITEM_KINDS)[number];

  @ApiProperty({ description: 'Titre (1 à 120 caractères)' })
  @IsString({ message: 'Le titre doit être une chaîne' })
  @Length(1, 120, { message: 'Le titre doit contenir entre 1 et 120 caractères' })
  title!: string;

  @ApiPropertyOptional({ description: 'Description (1000 caractères max)' })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne' })
  @MaxLength(1000, {
    message: 'La description ne peut pas dépasser 1000 caractères',
  })
  description?: string;

  @ApiProperty({ description: 'Valeur estimée en euros entiers (≥ 0)' })
  @IsInt({ message: 'value doit être un entier (euros)' })
  @Min(0, { message: 'value doit être supérieure ou égale à 0' })
  @Max(100_000_000, { message: 'value est hors des bornes admises' })
  value!: number;

  @ApiPropertyOptional({
    description:
      'Sous-éléments validables (libellés, 8 max) — absent/vide : un ' +
      'sous-élément automatique portant le titre est créé',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'steps doit être un tableau' })
  @ArrayMaxSize(DEAL_ITEM_STEPS_MAX, {
    message: `${DEAL_ITEM_STEPS_MAX} sous-éléments maximum par élément`,
  })
  @IsString({ each: true, message: 'Chaque sous-élément doit être une chaîne' })
  @Length(1, 120, {
    each: true,
    message: 'Chaque sous-élément doit contenir entre 1 et 120 caractères',
  })
  steps?: string[];
}

/** Corps de POST /deals — proposition d'un deal sur une annonce. */
export class ProposeDealDto {
  @ApiProperty({ description: "Identifiant de l'annonce visée ('active')" })
  @IsUUID(undefined, {
    message: "listingId doit être un identifiant d'annonce valide",
  })
  @IsNotEmpty({ message: 'listingId est obligatoire' })
  listingId!: string;

  @ApiPropertyOptional({
    description:
      "Contrepartie — obligatoire si l'annonce vous appartient (vous " +
      'proposez à un contact) ; sinon défaut = propriétaire de l’annonce',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'recipientId doit être un identifiant valide' })
  recipientId?: string;

  @ApiPropertyOptional({
    description: 'Échéance indicative (ISO 8601) — facultative',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'dueDate doit être une date ISO 8601 valide' },
  )
  dueDate?: string;

  @ApiProperty({
    description:
      'Éléments du deal (1 à 12) — chaque élément porte son fournisseur ' +
      '(une des deux parties), sa nature, sa valeur estimée et ses ' +
      'sous-éléments validables',
    type: [DealItemDto],
  })
  @IsArray({ message: 'items doit être un tableau' })
  @ArrayMinSize(1, { message: 'Un deal exige au moins un élément' })
  @ArrayMaxSize(DEAL_ITEMS_MAX, {
    message: `${DEAL_ITEMS_MAX} éléments maximum par deal`,
  })
  @ValidateNested({ each: true })
  @Type(() => DealItemDto)
  items!: DealItemDto[];
}

/** Corps de PUT /deals/:id/items — remplace la proposition (phase 'proposed'). */
export class ReplaceDealItemsDto {
  @ApiProperty({ description: 'Nouvelle liste d’éléments (1 à 12)', type: [DealItemDto] })
  @IsArray({ message: 'items doit être un tableau' })
  @ArrayMinSize(1, { message: 'Un deal exige au moins un élément' })
  @ArrayMaxSize(DEAL_ITEMS_MAX, {
    message: `${DEAL_ITEMS_MAX} éléments maximum par deal`,
  })
  @ValidateNested({ each: true })
  @Type(() => DealItemDto)
  items!: DealItemDto[];
}

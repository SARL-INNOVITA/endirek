import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Familles (miroir de ListingFamily). */
const FAMILIES = ['good', 'service'] as const;

/** Niveaux de modération (miroir de ModerationLevel). */
const MODERATION_LEVELS = ['standard', 'sensitive', 'forbidden'] as const;

/** Contrainte de slug : minuscules, chiffres et tirets (kebab-case). */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ────────────────────────────────────────────────────────────────────────────
// Catégories
// ────────────────────────────────────────────────────────────────────────────

/** Corps de POST /admin/dealplace/categories. Le slug est la clé métier
 * (immuable ensuite) ; family/moderationLevel/position/actif configurables. */
export class CreateListingCategoryDto {
  @ApiProperty({ description: 'Slug (kebab-case, immuable après création)' })
  @IsString()
  @Length(2, 120)
  @Matches(SLUG_PATTERN, {
    message: 'Le slug doit être en kebab-case (minuscules, chiffres, tirets)',
  })
  slug!: string;

  @ApiProperty({ description: 'Famille', enum: FAMILIES })
  @IsIn(FAMILIES, { message: 'family doit être « good » ou « service »' })
  family!: (typeof FAMILIES)[number];

  @ApiProperty({ description: 'Libellé affiché en français' })
  @IsString()
  @Length(2, 120)
  labelFr!: string;

  @ApiProperty({ description: "Ordre d'affichage" })
  @IsInt()
  @Min(0)
  @Max(1000)
  position!: number;

  @ApiPropertyOptional({
    description: 'Niveau de modération',
    enum: MODERATION_LEVELS,
    default: 'standard',
  })
  @IsOptional()
  @IsIn(MODERATION_LEVELS, { message: 'moderationLevel invalide' })
  moderationLevel?: (typeof MODERATION_LEVELS)[number];

  @ApiPropertyOptional({ description: 'Catégorie active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Corps de PATCH /admin/dealplace/categories/:slug — slug/family immuables. */
export class UpdateListingCategoryDto {
  @ApiPropertyOptional({ description: 'Libellé affiché en français' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  labelFr?: string;

  @ApiPropertyOptional({ description: "Ordre d'affichage" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;

  @ApiPropertyOptional({
    description: 'Niveau de modération',
    enum: MODERATION_LEVELS,
  })
  @IsOptional()
  @IsIn(MODERATION_LEVELS, { message: 'moderationLevel invalide' })
  moderationLevel?: (typeof MODERATION_LEVELS)[number];

  @ApiPropertyOptional({ description: 'Catégorie active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Sous-catégories
// ────────────────────────────────────────────────────────────────────────────

/** Corps de POST /admin/dealplace/subcategories. */
export class CreateListingSubcategoryDto {
  @ApiProperty({ description: 'Slug (kebab-case, immuable après création)' })
  @IsString()
  @Length(2, 120)
  @Matches(SLUG_PATTERN, {
    message: 'Le slug doit être en kebab-case (minuscules, chiffres, tirets)',
  })
  slug!: string;

  @ApiProperty({ description: 'Slug de la catégorie parente' })
  @IsString()
  @Length(2, 120)
  categorySlug!: string;

  @ApiProperty({ description: 'Libellé affiché en français' })
  @IsString()
  @Length(1, 120)
  labelFr!: string;

  @ApiProperty({ description: "Ordre d'affichage" })
  @IsInt()
  @Min(0)
  @Max(1000)
  position!: number;

  @ApiPropertyOptional({ description: 'Sous-catégorie active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Corps de PATCH /admin/dealplace/subcategories/:slug — slug/categorySlug
 * immuables (une sous-catégorie ne change pas de catégorie). */
export class UpdateListingSubcategoryDto {
  @ApiPropertyOptional({ description: 'Libellé affiché en français' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  labelFr?: string;

  @ApiPropertyOptional({ description: "Ordre d'affichage" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;

  @ApiPropertyOptional({ description: 'Sous-catégorie active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Tags
// ────────────────────────────────────────────────────────────────────────────

/** Corps de POST /admin/dealplace/tags. */
export class CreateListingTagDto {
  @ApiProperty({ description: 'Slug (kebab-case, immuable après création)' })
  @IsString()
  @Length(2, 60)
  @Matches(SLUG_PATTERN, {
    message: 'Le slug doit être en kebab-case (minuscules, chiffres, tirets)',
  })
  slug!: string;

  @ApiProperty({ description: 'Libellé affiché en français' })
  @IsString()
  @MaxLength(60)
  labelFr!: string;

  @ApiPropertyOptional({ description: 'Tag actif', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Corps de PATCH /admin/dealplace/tags/:slug — slug immuable. */
export class UpdateListingTagDto {
  @ApiPropertyOptional({ description: 'Libellé affiché en français' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  labelFr?: string;

  @ApiPropertyOptional({ description: 'Tag actif' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

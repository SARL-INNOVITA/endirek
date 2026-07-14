import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsDateString,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PAGE_ATTRIBUTES_MAX } from './create-page.dto';

/**
 * Corps de PATCH /pages/:id — patch partiel du propriétaire. pageType et
 * urlSlug sont IMMUABLES (absents d'ici) ; le statut passe par DELETE
 * (soft) et le backoffice ; les horaires par PUT /pages/:id/hours.
 *
 * Pattern nullable (miroir UpdateProfileDto) : `@ValidateIf` plutôt que
 * `@IsOptional` pour que `null` soit REFUSÉ sur les champs NOT NULL
 * (name/bio/attributes) mais accepté comme remise à vide sur les nullables
 * (phone, avatarUrl, coverUrl, vacationUntil, vacationMessage).
 */
export class UpdatePageDto {
  @ApiPropertyOptional({ description: 'Nom de la page (2 à 80 caractères)' })
  @ValidateIf((dto: UpdatePageDto) => dto.name !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le nom doit être une chaîne' })
  @Length(2, 80, { message: 'Le nom doit contenir entre 2 et 80 caractères' })
  name?: string;

  @ApiPropertyOptional({ description: 'Bio de la page (500 caractères max)' })
  @ValidateIf((dto: UpdatePageDto) => dto.bio !== undefined)
  @IsString({ message: 'La bio doit être une chaîne' })
  @MaxLength(500, { message: 'La bio ne peut pas dépasser 500 caractères' })
  bio?: string;

  @ApiPropertyOptional({
    description: 'Commune du référentiel La Réunion (position recalculée)',
  })
  @ValidateIf((dto: UpdatePageDto) => dto.city !== undefined)
  @IsString({ message: 'La commune doit être une chaîne' })
  @Length(1, 80, {
    message: 'La commune doit contenir entre 1 et 80 caractères',
  })
  city?: string;

  @ApiPropertyOptional({
    description: 'Téléphone de contact (30 caractères max) — null pour effacer',
  })
  @ValidateIf(
    (dto: UpdatePageDto) => dto.phone !== undefined && dto.phone !== null,
  )
  @IsString({ message: 'Le téléphone doit être une chaîne' })
  @MaxLength(30, {
    message: 'Le téléphone ne peut pas dépasser 30 caractères',
  })
  phone?: string | null;

  @ApiPropertyOptional({
    description: 'Chips d’attributs (5 max, 30 caractères chacune)',
  })
  @ValidateIf((dto: UpdatePageDto) => dto.attributes !== undefined)
  @ArrayMaxSize(PAGE_ATTRIBUTES_MAX, {
    message: `${PAGE_ATTRIBUTES_MAX} attributs maximum par page`,
  })
  @IsString({ each: true, message: 'Chaque attribut doit être une chaîne' })
  @Length(1, 30, {
    each: true,
    message: 'Chaque attribut doit contenir entre 1 et 30 caractères',
  })
  attributes?: string[];

  @ApiPropertyOptional({
    description:
      'URL de l’avatar (upload Endirek — /media/upload) — null pour effacer',
  })
  @ValidateIf(
    (dto: UpdatePageDto) =>
      dto.avatarUrl !== undefined && dto.avatarUrl !== null,
  )
  @IsString({ message: "L'URL de l'avatar doit être une chaîne" })
  @MaxLength(500, {
    message: "L'URL de l'avatar ne peut pas dépasser 500 caractères",
  })
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'URL de la couverture (upload Endirek — /media/upload) — null pour ' +
      'effacer',
  })
  @ValidateIf(
    (dto: UpdatePageDto) => dto.coverUrl !== undefined && dto.coverUrl !== null,
  )
  @IsString({ message: "L'URL de la couverture doit être une chaîne" })
  @MaxLength(500, {
    message: "L'URL de la couverture ne peut pas dépasser 500 caractères",
  })
  coverUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'En congés jusqu’à cette date ISO 8601 (D70) — null pour terminer ' +
      'les congés',
    example: '2026-08-15T00:00:00.000Z',
  })
  @ValidateIf(
    (dto: UpdatePageDto) =>
      dto.vacationUntil !== undefined && dto.vacationUntil !== null,
  )
  @IsDateString(
    {},
    { message: 'vacationUntil doit être une date ISO 8601 valide' },
  )
  vacationUntil?: string | null;

  @ApiPropertyOptional({
    description:
      'Message de congés affiché avec le statut (200 caractères max) — ' +
      'null pour effacer',
  })
  @ValidateIf(
    (dto: UpdatePageDto) =>
      dto.vacationMessage !== undefined && dto.vacationMessage !== null,
  )
  @IsString({ message: 'Le message de congés doit être une chaîne' })
  @MaxLength(200, {
    message: 'Le message de congés ne peut pas dépasser 200 caractères',
  })
  vacationMessage?: string | null;
}

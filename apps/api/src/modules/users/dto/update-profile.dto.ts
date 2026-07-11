import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsObject,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Corps de PATCH /users/me/profile — sémantique PATCH : seuls les champs
 * PRÉSENTS dans le corps sont modifiés.
 *
 * Subtilité null / undefined (alignée sur la couche persistance) :
 * - undefined (champ absent) → colonne inchangée ;
 * - null → remise à vide, UNIQUEMENT pour les champs nullables
 *   (city, avatarUrl, coverUrl) ;
 * - displayName, bio et settings sont NOT NULL : null y est refusé (400).
 * On utilise @ValidateIf plutôt que @IsOptional : @IsOptional laisserait
 * passer null sans validation, y compris sur les champs NOT NULL.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Nom affiché (2 à 50 caractères)',
    example: 'Jean Payet',
    minLength: 2,
    maxLength: 50,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((dto: UpdateProfileDto) => dto.displayName !== undefined)
  @IsString({ message: 'Le nom affiché doit être une chaîne de caractères' })
  @Length(2, 50, {
    message: 'Le nom affiché doit contenir entre 2 et 50 caractères',
  })
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Biographie (500 caractères maximum)',
    example: 'Amoureux des sentiers du volcan et des piques-niques du dimanche.',
    maxLength: 500,
  })
  @ValidateIf((dto: UpdateProfileDto) => dto.bio !== undefined)
  @IsString({ message: 'La biographie doit être une chaîne de caractères' })
  @MaxLength(500, {
    message: 'La biographie ne peut pas dépasser 500 caractères',
  })
  bio?: string;

  @ApiPropertyOptional({
    description: 'Ville (80 caractères maximum, null pour effacer)',
    example: 'Saint-Pierre',
    maxLength: 80,
    nullable: true,
  })
  @ValidateIf(
    (dto: UpdateProfileDto) => dto.city !== undefined && dto.city !== null,
  )
  @IsString({ message: 'La ville doit être une chaîne de caractères' })
  @MaxLength(80, { message: 'La ville ne peut pas dépasser 80 caractères' })
  city?: string | null;

  @ApiPropertyOptional({
    description:
      'Profil Dealplace (CP2.2) : « Ce que je recherche » — texte libre ' +
      'PUBLIC affiché sur le volet Dealplace du profil (500 caractères ' +
      'maximum, null pour effacer)',
    example:
      'Je recherche des services utiles et des biens de qualité à La Réunion.',
    maxLength: 500,
    nullable: true,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf(
    (dto: UpdateProfileDto) =>
      dto.dealplaceSeeking !== undefined && dto.dealplaceSeeking !== null,
  )
  @IsString({
    message: '« Ce que je recherche » doit être une chaîne de caractères',
  })
  @MaxLength(500, {
    message: '« Ce que je recherche » ne peut pas dépasser 500 caractères',
  })
  dealplaceSeeking?: string | null;

  @ApiPropertyOptional({
    description: "URL de la photo de profil (null pour retirer la photo)",
    example: 'https://exemple.re/avatar.jpg',
    nullable: true,
  })
  @ValidateIf(
    (dto: UpdateProfileDto) =>
      dto.avatarUrl !== undefined && dto.avatarUrl !== null,
  )
  @IsUrl({}, { message: "L'URL de la photo de profil est invalide" })
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    description: 'URL de la photo de couverture (null pour retirer la photo)',
    example: 'https://exemple.re/couverture.jpg',
    nullable: true,
  })
  @ValidateIf(
    (dto: UpdateProfileDto) =>
      dto.coverUrl !== undefined && dto.coverUrl !== null,
  )
  @IsUrl({}, { message: "L'URL de la photo de couverture est invalide" })
  coverUrl?: string | null;

  @ApiPropertyOptional({
    description: "Préférences de l'utilisateur (objet libre : thème, langue, notifications...)",
    example: { theme: 'sombre' },
    type: Object,
  })
  @ValidateIf((dto: UpdateProfileDto) => dto.settings !== undefined)
  @IsObject({ message: 'Les préférences doivent être un objet' })
  settings?: Record<string, unknown>;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

/** Corps de POST /conversations — démarre (ou reprend) MA conversation sur
 * une annonce (D63) OU une page (Lot 3 — D75) en envoyant le PREMIER message
 * (get-or-create : pas de fil vide). Exactement UNE cible parmi
 * listingId / pageId — la règle croisée est vérifiée au SERVICE (400). */
export class StartConversationDto {
  @ApiPropertyOptional({
    description:
      "Identifiant de l'annonce visée — annonce 'active' uniquement (404 " +
      'sinon), jamais la sienne (400). Exclusif avec pageId.',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: "listingId doit être un identifiant d'annonce valide",
  })
  listingId?: string;

  @ApiPropertyOptional({
    description:
      "Identifiant de la page visée (Lot 3 — D75) — page 'active' uniquement " +
      '(404 sinon), jamais la sienne (400). Exclusif avec listingId.',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'pageId doit être un identifiant de page valide',
  })
  pageId?: string;

  @ApiProperty({
    description: 'Premier message du fil (1 à 2000 caractères après trim)',
    example: 'Bonjour ! Votre panier péi est-il toujours disponible ?',
    minLength: 1,
    maxLength: 2000,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Le message doit être une chaîne de caractères' })
  @Length(1, 2000, {
    message: 'Le message doit contenir entre 1 et 2000 caractères',
  })
  body!: string;
}

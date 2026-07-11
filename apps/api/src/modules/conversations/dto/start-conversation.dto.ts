import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';

/** Corps de POST /conversations — démarre (ou reprend) MA conversation sur
 * une annonce en envoyant le PREMIER message (get-or-create, décision D63 :
 * pas de fil vide). */
export class StartConversationDto {
  @ApiProperty({
    description:
      "Identifiant de l'annonce visée — annonce 'active' uniquement (404 " +
      'sinon), jamais la sienne (400)',
  })
  @IsUUID(undefined, {
    message: "listingId doit être un identifiant d'annonce valide",
  })
  @IsNotEmpty({ message: 'listingId est obligatoire' })
  listingId!: string;

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

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

/** Corps de POST /conversations/:id/messages — un message TEXTE (CP2.3 :
 * pas de pièces jointes). Le corps est trimé avant validation. */
export class SendMessageDto {
  @ApiProperty({
    description: 'Texte du message (1 à 2000 caractères après trim)',
    example: 'Bonjour, votre annonce est-elle toujours disponible ?',
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

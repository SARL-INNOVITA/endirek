import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Corps de POST /posts/:id/reactions et /comments/:id/reactions.
 *
 * L'emoji n'est PAS validé ici contre une liste en dur : la palette vit
 * dans la table reaction_types (pilotable backoffice) et la vérification
 * se fait dans ReactionsService contre cette table (400 avec la liste des
 * emojis valides sinon).
 */
export class ReactDto {
  @ApiProperty({
    description: 'Emoji de réaction (un des emojis actifs de reaction_types)',
    example: '👍',
  })
  @IsString({ message: 'emoji doit être une chaîne' })
  @IsNotEmpty({ message: 'emoji est obligatoire' })
  emoji!: string;
}

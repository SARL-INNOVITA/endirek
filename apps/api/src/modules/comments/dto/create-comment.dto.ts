import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

/** Corps de POST /posts/:id/comments — commentaire principal ou réponse. */
export class CreateCommentDto {
  @ApiProperty({ description: 'Texte du commentaire (1 à 1000 caractères)' })
  @IsString({ message: 'Le texte doit être une chaîne' })
  @Length(1, 1000, {
    message: 'Le texte doit contenir entre 1 et 1000 caractères',
  })
  body!: string;

  @ApiPropertyOptional({
    description:
      'Identifiant du commentaire PRINCIPAL (depth 0) auquel répondre — ' +
      'absent : commentaire principal. Répondre à une réponse est refusé ' +
      '(option A, profondeur limitée à 1 au Lot 1).',
  })
  @IsOptional()
  @IsString({ message: 'parentCommentId doit être une chaîne' })
  @IsNotEmpty({ message: 'parentCommentId ne peut pas être vide' })
  parentCommentId?: string;
}

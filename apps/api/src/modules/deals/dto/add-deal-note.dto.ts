import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

/** Corps de POST /deals/:id/notes — note de la timeline « Suivi du deal ». */
export class AddDealNoteDto {
  @ApiProperty({
    description: 'Texte de la note (1 à 1000 caractères après trim)',
    minLength: 1,
    maxLength: 1000,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'La note doit être une chaîne' })
  @Length(1, 1000, {
    message: 'La note doit contenir entre 1 et 1000 caractères',
  })
  body!: string;
}

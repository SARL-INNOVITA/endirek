import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

/** Corps de POST /deals/:id/dispute — déclaration de litige (motif requis). */
export class DisputeDealDto {
  @ApiProperty({
    description: 'Motif du litige (10 à 1000 caractères après trim)',
    minLength: 10,
    maxLength: 1000,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Le motif doit être une chaîne' })
  @Length(10, 1000, {
    message: 'Le motif doit contenir entre 10 et 1000 caractères',
  })
  reason!: string;
}

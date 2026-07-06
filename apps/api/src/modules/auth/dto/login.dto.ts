import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/** Corps de POST /auth/login (email normalisé : trim + minuscules). */
export class LoginDto {
  @ApiProperty({
    description: 'Adresse email du compte',
    example: 'equipe@endirek.invalid',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Adresse email invalide' })
  email!: string;

  @ApiProperty({ description: 'Mot de passe', example: 'motdepasse-solide' })
  @IsString({ message: 'Le mot de passe est requis' })
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  password!: string;
}

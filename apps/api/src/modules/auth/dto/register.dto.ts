import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

/**
 * Corps de POST /auth/register.
 * L'email est normalisé (trim + minuscules) dès la transformation du DTO —
 * le service renormalise par sécurité (source unique : email en minuscules).
 */
export class RegisterDto {
  @ApiProperty({
    description: "Adresse email du compte (unicité insensible à la casse)",
    example: 'nouveau@example.com',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Adresse email invalide' })
  email!: string;

  @ApiProperty({
    description: 'Mot de passe (8 caractères minimum)',
    example: 'motdepasse-solide',
    minLength: 8,
  })
  @IsString({ message: 'Le mot de passe est requis' })
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères',
  })
  password!: string;

  @ApiProperty({
    description: 'Nom affiché (2 à 50 caractères)',
    example: 'Jean Payet',
    minLength: 2,
    maxLength: 50,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Le nom affiché est requis' })
  @Length(2, 50, {
    message: 'Le nom affiché doit contenir entre 2 et 50 caractères',
  })
  displayName!: string;
}

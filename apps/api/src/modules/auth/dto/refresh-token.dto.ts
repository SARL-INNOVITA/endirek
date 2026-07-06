import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Corps de POST /auth/refresh. */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Jeton de rafraîchissement émis à la connexion',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
  })
  @IsString({ message: 'Le jeton de rafraîchissement est requis' })
  @IsNotEmpty({ message: 'Le jeton de rafraîchissement est requis' })
  refreshToken!: string;
}

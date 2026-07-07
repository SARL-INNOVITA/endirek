import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** POST /admin/notifications/system. */
export class CreateSystemNotificationDto {
  @ApiPropertyOptional({
    description:
      'Destinataire unique. A omettre si broadcast=true.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Envoyer a tous les comptes actifs du driver mock/dev',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  broadcast?: boolean;

  @ApiPropertyOptional({ description: 'Titre court affiche par le client' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ description: 'Message de la notification systeme' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  message!: string;
}

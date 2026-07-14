import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PostMediaInputDto } from '../../posts/dto/create-post.dto';

/** Natures de publication d'une page (D73). */
export const PAGE_POST_KINDS = ['free', 'menu', 'offer', 'event'] as const;

export type PagePostKind = (typeof PAGE_POST_KINDS)[number];

/**
 * Corps de POST /pages/:id/posts — publication AU NOM de la page (D73).
 *
 * - `free`  : publication libre (body OBLIGATOIRE, title/media optionnels) ;
 * - `menu`  : menu du jour AUTO-COMPOSÉ depuis le menu programmé du jour
 *   (restaurant uniquement) — body = intro optionnelle ;
 * - `offer` : offre AUTO-COMPOSÉE depuis offerId — body = intro optionnelle ;
 * - `event` : événement AUTO-COMPOSÉ depuis eventId — body = intro optionnelle.
 *
 * Les règles croisées par nature (body requis pour free, offerId/eventId
 * requis, menu du jour existant...) sont vérifiées au SERVICE (400).
 */
export class PublishPagePostDto {
  @ApiProperty({
    description: 'Nature de la publication',
    enum: PAGE_POST_KINDS,
    example: 'menu',
  })
  @IsIn(PAGE_POST_KINDS, {
    message: 'kind doit être « free », « menu », « offer » ou « event »',
  })
  kind!: PagePostKind;

  @ApiPropertyOptional({
    description:
      'Texte : OBLIGATOIRE pour une publication libre (1 à 2000 caractères), ' +
      'intro optionnelle ajoutée en tête du corps auto-composé sinon',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le texte doit être une chaîne de caractères' })
  @MaxLength(2000, {
    message: 'Le texte ne peut pas dépasser 2000 caractères',
  })
  body?: string;

  @ApiPropertyOptional({
    description: 'Titre (publication libre uniquement, 120 caractères max)',
  })
  @IsOptional()
  @IsString({ message: 'Le titre doit être une chaîne' })
  @MaxLength(120, { message: 'Le titre ne peut pas dépasser 120 caractères' })
  title?: string;

  @ApiPropertyOptional({
    description:
      'Images (publication libre uniquement, 4 max, upload Endirek)',
    type: [PostMediaInputDto],
  })
  @IsOptional()
  @ArrayMaxSize(4, { message: '4 médias maximum par publication' })
  @ValidateNested({ each: true })
  @Type(() => PostMediaInputDto)
  media?: PostMediaInputDto[];

  @ApiPropertyOptional({
    description: "Identifiant de l'offre à publier (kind = 'offer')",
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: "offerId doit être un identifiant d'offre valide",
  })
  offerId?: string;

  @ApiPropertyOptional({
    description: "Identifiant de l'événement à publier (kind = 'event')",
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: "eventId doit être un identifiant d'événement valide",
  })
  eventId?: string;
}

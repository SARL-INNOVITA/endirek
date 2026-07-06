import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Position géographique d'un post ({ lat, lng } WGS84). */
export class PostLocationDto {
  @ApiProperty({ description: 'Latitude WGS84', example: -21.0096 })
  @IsNumber({}, { message: 'lat doit être un nombre' })
  @Min(-90, { message: 'lat doit être comprise entre -90 et 90' })
  @Max(90, { message: 'lat doit être comprise entre -90 et 90' })
  lat!: number;

  @ApiProperty({ description: 'Longitude WGS84', example: 55.2707 })
  @IsNumber({}, { message: 'lng doit être un nombre' })
  @Min(-180, { message: 'lng doit être comprise entre -180 et 180' })
  @Max(180, { message: 'lng doit être comprise entre -180 et 180' })
  lng!: number;
}

/** Média attaché à un post (URLs issues de POST /media/upload — toute URL
 * externe est refusée par le service : 400). */
export class PostMediaInputDto {
  @ApiProperty({
    description:
      "URL de l'image, telle que retournée par POST /media/upload — elle " +
      "doit provenir de l'hébergement Endirek (base " +
      '`${API_PUBLIC_URL}/uploads/`) ; toute URL externe est refusée (400 ' +
      '« Les médias doivent provenir de l’upload Endirek (/media/upload) »)',
  })
  @IsString({ message: "L'URL du média doit être une chaîne" })
  @IsNotEmpty({ message: "L'URL du média est obligatoire" })
  url!: string;

  @ApiPropertyOptional({
    description:
      'URL de la miniature (retournée par /media/upload) — même contrainte ' +
      "d'origine Endirek que url (400 sinon)",
  })
  @IsOptional()
  @IsString({ message: 'thumbnailUrl doit être une chaîne' })
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Largeur en pixels' })
  @IsOptional()
  @IsInt({ message: 'width doit être un entier' })
  @Min(1, { message: 'width doit être positif' })
  width?: number;

  @ApiPropertyOptional({ description: 'Hauteur en pixels' })
  @IsOptional()
  @IsInt({ message: 'height doit être un entier' })
  @Min(1, { message: 'height doit être positif' })
  height?: number;

  @ApiPropertyOptional({
    description: "Type de média — 'image' uniquement au Lot 1",
    enum: ['image'],
    default: 'image',
  })
  @IsOptional()
  @IsIn(['image'], {
    message:
      'Seules les images sont disponibles au Lot 1 (vidéos : lot ultérieur)',
  })
  mediaType?: 'image';

  @ApiPropertyOptional({
    description: "Ordre d'affichage (0 = premier) — index du tableau si absent",
  })
  @IsOptional()
  @IsInt({ message: 'position doit être un entier' })
  @Min(0, { message: 'position doit être positive ou nulle' })
  position?: number;
}

/** Corps de POST /posts — création d'une publication. */
export class CreatePostDto {
  @ApiProperty({
    description: 'Type de publication (slug de post_types, actif)',
    example: 'weather',
  })
  @IsString({ message: 'typeSlug doit être une chaîne' })
  @IsNotEmpty({ message: 'typeSlug est obligatoire' })
  typeSlug!: string;

  @ApiPropertyOptional({ description: 'Titre (120 caractères max)' })
  @IsOptional()
  @IsString({ message: 'Le titre doit être une chaîne' })
  @MaxLength(120, {
    message: 'Le titre ne peut pas dépasser 120 caractères',
  })
  title?: string;

  @ApiProperty({ description: 'Texte de la publication (1 à 2000 caractères)' })
  @IsString({ message: 'Le texte doit être une chaîne' })
  @Length(1, 2000, {
    message: 'Le texte doit contenir entre 1 et 2000 caractères',
  })
  body!: string;

  @ApiPropertyOptional({
    description:
      'Position { lat, lng } — requise seulement pour apparaître sur la ' +
      'carte (un post météo/trafic/danger SANS position reste légal : ' +
      'feed uniquement)',
    type: PostLocationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PostLocationDto)
  location?: PostLocationDto;

  @ApiPropertyOptional({
    description:
      'Commune affichée (80 caractères max) — déduite de la commune la ' +
      'plus proche si absente (ou vide/blanche : une chaîne vide vaut ' +
      '« non fournie ») alors qu’une position est fournie',
  })
  @IsOptional()
  @IsString({ message: 'La ville doit être une chaîne' })
  @MaxLength(80, { message: 'La ville ne peut pas dépasser 80 caractères' })
  city?: string;

  @ApiPropertyOptional({
    description: 'Médias attachés (4 maximum, images uniquement au Lot 1)',
    type: [PostMediaInputDto],
  })
  @IsOptional()
  @IsArray({ message: 'media doit être un tableau' })
  @ArrayMaxSize(4, { message: '4 médias maximum par publication' })
  @ValidateNested({ each: true })
  @Type(() => PostMediaInputDto)
  media?: PostMediaInputDto[];
}

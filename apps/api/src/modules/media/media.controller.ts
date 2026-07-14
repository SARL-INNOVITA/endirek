import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  MediaService,
  UploadedDocument,
  UploadedMedia,
} from './media.service';

/**
 * Contrôleur médias — contrat d'API étape 4 (+ Lot 3).
 *
 * POST /api/v1/media/upload (authentifié via le guard JWT global) — images.
 * POST /api/v1/media/upload-document (Lot 3 — D77) — documents PDF des pages.
 * TODO (lot ultérieur) : upload de vidéos.
 */
@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  // Multer configuré au niveau du module (media.module.ts) : stockage en
  // MÉMOIRE (aucun fichier temporaire disque) + limite de taille pilotée
  // par MEDIA_MAX_FILE_SIZE_MB.
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Uploader une image (champ multipart « file »)',
    description:
      'Images JPEG, PNG ou WebP uniquement (validation par décodage réel, ' +
      'pas par le mimetype déclaré), 8 Mo max par défaut. Orientation EXIF ' +
      'corrigée, miniature 400 px (webp) générée. Les URLs retournées sont ' +
      'publiques (servies sur /uploads/, hors authentification). ' +
      'Vidéos : non disponibles au Lot 1.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image JPEG, PNG ou WebP (8 Mo max).',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Image stockée : { url, thumbnailUrl, width, height, mediaType }',
  })
  @ApiResponse({
    status: 400,
    description:
      'Fichier invalide : seules les images JPEG, PNG ou WebP sont acceptées',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 413, description: 'Fichier trop volumineux (8 Mo max)' })
  upload(@UploadedFile() file?: Express.Multer.File): Promise<UploadedMedia> {
    return this.mediaService.upload(file);
  }

  @Post('upload-document')
  // Même configuration multer que /upload : mémoire + limite de taille
  // MEDIA_MAX_FILE_SIZE_MB partagée avec les images.
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Uploader un document PDF (champ multipart « file »)',
    description:
      'Documents PDF uniquement (validation par magic bytes %PDF-, pas par ' +
      'le mimetype déclaré), 8 Mo max par défaut. Alimente la section ' +
      '« Nos cartes » des pages restaurant (Lot 3 — D77). L’URL retournée ' +
      'est publique (servie sur /uploads/, hors authentification).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document PDF (8 Mo max).',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document stocké : { url, fileSizeBytes, mediaType }',
  })
  @ApiResponse({
    status: 400,
    description: 'Fichier invalide : seuls les documents PDF sont acceptés',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 413, description: 'Fichier trop volumineux (8 Mo max)' })
  uploadDocument(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadedDocument> {
    return this.mediaService.uploadDocument(file);
  }
}

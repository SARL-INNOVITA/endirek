import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { SharpConstructor } from 'sharp';
import {
  MEDIA_STORAGE_ADAPTER,
  MediaStorageAdapter,
} from '../../adapters/media-storage/media-storage.adapter';

// sharp est publié en CommonJS pur (module.exports = fonction, sans export
// `default` au runtime) : require direct pour rester fidèle au runtime — un
// import default TypeScript (sans esModuleInterop) chercherait `.default`
// qui n'existe pas.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp') as SharpConstructor;

/**
 * Formats d'image ACCEPTÉS au Lot 1, indexés par le format DÉTECTÉ par sharp
 * (jamais par le mimetype déclaré ni le nom de fichier client). L'extension
 * et le type MIME transmis à l'adapter de stockage en sont dérivés.
 *
 * TODO (lot ultérieur) : vidéos — non implémentées au Lot 1. Le champ
 * mediaType ('image') de la réponse est déjà prêt à accueillir 'video'.
 */
const ALLOWED_IMAGE_FORMATS: Record<
  string,
  { extension: string; mimeType: string }
> = {
  jpeg: { extension: 'jpg', mimeType: 'image/jpeg' },
  png: { extension: 'png', mimeType: 'image/png' },
  webp: { extension: 'webp', mimeType: 'image/webp' },
};

/** Largeur cible des miniatures (ratio conservé, format webp). */
const THUMBNAIL_WIDTH = 400;

const INVALID_IMAGE_MESSAGE =
  'Fichier invalide : seules les images JPEG, PNG ou WebP sont acceptées';

/** Réponse de POST /media/upload — forme MEDIA partielle du contrat. */
export interface UploadedMedia {
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  mediaType: 'image';
}

const INVALID_DOCUMENT_MESSAGE =
  'Fichier invalide : seuls les documents PDF sont acceptés';

/** Réponse de POST /media/upload-document (Lot 3 — D77) : documents PDF des
 * pages (« Nos cartes »). */
export interface UploadedDocument {
  url: string;
  fileSizeBytes: number;
  mediaType: 'document';
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_STORAGE_ADAPTER)
    private readonly storage: MediaStorageAdapter,
  ) {}

  /**
   * Traite un upload d'image :
   * 1. validation par DÉCODAGE réel (sharp.metadata()) — le mimetype déclaré
   *    par le client ne prouve rien (un .txt renommé .png est rejeté) ;
   * 2. correction d'orientation EXIF (rotate()) puis ré-encodage dans le
   *    format d'origine ;
   * 3. génération d'une miniature de 400 px de large (ratio conservé, webp,
   *    jamais agrandie si l'original est plus étroit) ;
   * 4. écriture des deux fichiers via l'adapter de stockage (noms aléatoires,
   *    extension dérivée du format détecté).
   *
   * La limite de taille (MEDIA_MAX_FILE_SIZE_MB, défaut 8 Mo) est appliquée
   * en amont par multer (413) — voir media.module.ts.
   */
  async upload(file?: Express.Multer.File): Promise<UploadedMedia> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(
        'Fichier manquant : envoyez une image dans le champ multipart « file ».',
      );
    }

    // 1. Décodage réel : format détecté à partir des octets, pas du mimetype.
    let detectedFormat: string | undefined;
    try {
      detectedFormat = (await sharp(file.buffer).metadata()).format;
    } catch {
      throw new BadRequestException(INVALID_IMAGE_MESSAGE);
    }
    const format = detectedFormat
      ? ALLOWED_IMAGE_FORMATS[detectedFormat]
      : undefined;
    if (!format) {
      throw new BadRequestException(INVALID_IMAGE_MESSAGE);
    }

    // 2 + 3. Orientation EXIF corrigée, puis miniature. Une image tronquée ou
    // corrompue peut passer metadata() mais échouer ici → 400 également.
    let data: Buffer;
    let width: number;
    let height: number;
    let thumbnail: Buffer;
    try {
      const rotated = await sharp(file.buffer)
        .rotate()
        .toBuffer({ resolveWithObject: true });
      data = rotated.data;
      // Dimensions APRÈS rotation (une photo portrait EXIF 90° est bien
      // renvoyée avec width < height).
      width = rotated.info.width;
      height = rotated.info.height;

      thumbnail = await sharp(data)
        .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
        .webp()
        .toBuffer();
    } catch {
      throw new BadRequestException(INVALID_IMAGE_MESSAGE);
    }

    // 4. Persistance via l'adapter (local ou s3 — le service n'en sait rien).
    const original = await this.storage.save(data, format);
    const thumb = await this.storage.save(thumbnail, {
      extension: 'webp',
      mimeType: 'image/webp',
    });

    return {
      url: original.publicUrl,
      thumbnailUrl: thumb.publicUrl,
      width,
      height,
      mediaType: 'image',
    };
  }

  /**
   * Traite un upload de document PDF (Lot 3 — D77, section « Nos cartes »
   * des pages restaurant) :
   * 1. validation par MAGIC BYTES (%PDF-) — comme les images, le mimetype
   *    déclaré et le nom de fichier client ne prouvent rien ;
   * 2. écriture TELLE QUELLE via l'adapter de stockage (nom aléatoire,
   *    extension pdf) — aucun retraitement (pas d'équivalent sharp).
   *
   * Même limite de taille que les images (MEDIA_MAX_FILE_SIZE_MB — multer,
   * 413 en amont).
   */
  async uploadDocument(file?: Express.Multer.File): Promise<UploadedDocument> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(
        'Fichier manquant : envoyez un PDF dans le champ multipart « file ».',
      );
    }

    // 1. Magic bytes : tout PDF commence par « %PDF- » (ISO 32000). Décodage
    // ASCII des 5 premiers octets — un .exe renommé .pdf est rejeté.
    const header = file.buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new BadRequestException(INVALID_DOCUMENT_MESSAGE);
    }

    // 2. Persistance via l'adapter (nom aléatoire, jamais le nom client).
    const stored = await this.storage.save(file.buffer, {
      extension: 'pdf',
      mimeType: 'application/pdf',
    });

    return {
      url: stored.publicUrl,
      fileSizeBytes: file.buffer.length,
      mediaType: 'document',
    };
  }
}

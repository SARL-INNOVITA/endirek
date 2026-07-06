import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  MediaFileMetadata,
  MediaStorageAdapter,
  StoredMediaFile,
} from './media-storage.adapter';

/**
 * Driver LOCAL de stockage des médias (développement, sans S3).
 *
 * - Écrit sous le dossier d'upload absolu (config media.uploadDir résolue),
 *   dans des sous-dossiers par date AAAA/MM pour éviter les dossiers géants.
 * - Noms de fichiers ALÉATOIRES (crypto) + extension dérivée du format
 *   détecté — le nom envoyé par le client n'est JAMAIS utilisé (ni le nom,
 *   ni son extension : aucune injection de chemin possible).
 * - Les fichiers sont servis statiquement sur /uploads/ (voir main.ts) :
 *   l'URL publique est construite à partir de l'URL publique de l'API.
 */
export class LocalMediaStorage implements MediaStorageAdapter {
  constructor(
    /** Dossier d'upload ABSOLU (déjà résolu par resolveUploadDir). */
    private readonly uploadDir: string,
    /** URL publique de l'API, sans slash final (ex. http://localhost:3001). */
    private readonly publicBaseUrl: string,
  ) {}

  async save(
    buffer: Buffer,
    metadata: MediaFileMetadata,
  ): Promise<StoredMediaFile> {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const fileName = `${randomBytes(16).toString('hex')}.${metadata.extension}`;

    // Chemin relatif TOUJOURS avec des « / » (il sert aussi d'URL).
    const relativePath = `${year}/${month}/${fileName}`;
    const directory = path.join(this.uploadDir, year, month);

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, fileName), buffer);

    return {
      relativePath,
      publicUrl: `${this.publicBaseUrl}/uploads/${relativePath}`,
    };
  }

  async delete(relativePath: string): Promise<void> {
    const root = path.resolve(this.uploadDir);
    const absolute = path.resolve(root, relativePath);

    // Garde-fou : refuser tout chemin qui sortirait du dossier d'upload.
    if (absolute !== root && !absolute.startsWith(root + path.sep)) {
      throw new Error("Chemin de média invalide : hors du dossier d'upload.");
    }

    try {
      await fs.unlink(absolute);
    } catch (error) {
      // Suppression idempotente : un fichier déjà absent n'est pas une erreur.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

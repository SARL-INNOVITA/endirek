/**
 * Adapter de stockage des médias — interface stable + token d'injection.
 *
 * Même pattern que la couche persistance (src/database) : le code métier
 * n'injecte que le token MEDIA_STORAGE_ADAPTER et ne connaît que cette
 * interface. Le driver actif est choisi par MEDIA_STORAGE_DRIVER :
 * - 'local' : disque local (LocalMediaStorage) — développement ;
 * - 's3'    : stockage compatible S3/Hetzner — NON implémenté au Lot 1,
 *   le démarrage échoue avec une erreur explicite.
 */

/** Fichier média persisté par l'adapter. */
export interface StoredMediaFile {
  /** Chemin relatif au sein du stockage (ex. « 2026/07/a1b2….webp »). */
  relativePath: string;
  /** URL publique complète du fichier (consommable telle quelle). */
  publicUrl: string;
}

/** Métadonnées nécessaires à l'écriture d'un fichier. */
export interface MediaFileMetadata {
  /**
   * Extension SÛRE, dérivée du format réellement DÉTECTÉ au décodage
   * (jamais du nom de fichier envoyé par le client).
   */
  extension: string;
  /** Type MIME réel (utile au driver s3 pour le Content-Type). */
  mimeType: string;
}

export interface MediaStorageAdapter {
  /** Écrit un fichier et retourne son chemin relatif + son URL publique. */
  save(buffer: Buffer, metadata: MediaFileMetadata): Promise<StoredMediaFile>;
  /** Supprime un fichier (silencieux si déjà absent). */
  delete(relativePath: string): Promise<void>;
}

/** Token d'injection de l'adapter de stockage des médias. */
export const MEDIA_STORAGE_ADAPTER = Symbol('MEDIA_STORAGE_ADAPTER');

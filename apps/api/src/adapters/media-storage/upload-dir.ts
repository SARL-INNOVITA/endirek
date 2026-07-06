import * as path from 'node:path';

/**
 * Résout le dossier d'upload (config media.uploadDir) en chemin ABSOLU.
 *
 * Un chemin relatif (ex. « ./uploads ») est résolu par rapport à la RACINE
 * de l'application API (apps/api), et non au cwd du process : le serveur
 * peut ainsi être lancé depuis la racine du monorepo
 * (node apps/api/dist/main.js) sans que les fichiers atterrissent ailleurs.
 *
 * Compilé, ce fichier vit dans dist/adapters/media-storage/ : la racine de
 * l'application est donc trois niveaux au-dessus (… → dist → apps/api).
 */
export function resolveUploadDir(configuredDir: string): string {
  if (path.isAbsolute(configuredDir)) {
    return configuredDir;
  }
  const apiRoot = path.resolve(__dirname, '..', '..', '..');
  return path.resolve(apiRoot, configuredDir);
}

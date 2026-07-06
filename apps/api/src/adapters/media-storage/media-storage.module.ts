import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig, MediaConfig } from '../../config/configuration';
import { LocalMediaStorage } from './local-media-storage';
import {
  MEDIA_STORAGE_ADAPTER,
  MediaStorageAdapter,
} from './media-storage.adapter';
import { resolveUploadDir } from './upload-dir';

/**
 * MediaStorageModule — sélectionne l'implémentation de l'adapter de stockage
 * selon la configuration `media.driver` (MEDIA_STORAGE_DRIVER), miroir du
 * pattern de la couche persistance (DB_DRIVER) :
 *
 * - 'local' (défaut) : LocalMediaStorage — fichiers sur disque, servis sur
 *   /uploads/. Aucune infrastructure requise.
 * - 's3' : PAS ENCORE IMPLÉMENTÉ au Lot 1 — le démarrage échoue volontairement
 *   avec une erreur explicite plutôt que de faire semblant de fonctionner.
 *
 * Le code métier n'injecte que le token MEDIA_STORAGE_ADAPTER.
 */
const mediaStorageProvider: Provider = {
  provide: MEDIA_STORAGE_ADAPTER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): MediaStorageAdapter => {
    const media = configService.getOrThrow<MediaConfig>('media');
    const appConfig = configService.getOrThrow<AppConfig>('app');

    switch (media.driver) {
      case 'local':
        return new LocalMediaStorage(
          resolveUploadDir(media.uploadDir),
          appConfig.publicUrl.replace(/\/+$/, ''),
        );
      case 's3':
        throw new Error(
          'Adapter S3 non implémenté au Lot 1 — utilisez MEDIA_STORAGE_DRIVER=local',
        );
      default:
        throw new Error(
          `MEDIA_STORAGE_DRIVER inconnu : « ${media.driver} » ` +
            '(valeurs supportées : local, s3).',
        );
    }
  },
};

@Module({
  providers: [mediaStorageProvider],
  exports: [MEDIA_STORAGE_ADAPTER],
})
export class MediaStorageModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaStorageModule } from '../../adapters/media-storage/media-storage.module';
import { MediaConfig } from '../../config/configuration';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

/**
 * MediaModule — upload de médias (étape 4 du Lot 1, images uniquement).
 *
 * Multer est configuré ici pour tout le module :
 * - stockage en MÉMOIRE (memoryStorage) : le buffer est validé par décodage
 *   sharp puis écrit via l'adapter de stockage — aucun fichier temporaire
 *   disque n'est jamais créé ;
 * - limite de taille pilotée par MEDIA_MAX_FILE_SIZE_MB (défaut 8 Mo) :
 *   dépassement → 413 (Payload Too Large) levé par l'interceptor multer.
 */
@Module({
  imports: [
    MediaStorageModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const media = configService.getOrThrow<MediaConfig>('media');
        return {
          storage: memoryStorage(),
          limits: { fileSize: media.maxFileSizeMb * 1024 * 1024 },
        };
      },
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}

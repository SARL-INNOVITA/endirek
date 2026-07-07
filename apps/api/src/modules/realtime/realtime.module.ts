import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuthConfig } from '../../config/configuration';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Module temps réel (Lot 1 étape 5) — gateway socket.io minimale sur le
 * namespace par défaut : diffusion des notifications in-app en direct
 * ('notification.created') et rafraîchissement léger de la carte
 * ('map.updated'). PAS de messagerie.
 *
 * JwtModule est enregistré ICI (secret auth.jwtSecret) pour vérifier le jeton
 * au handshake — même configuration que le module auth (le guard HTTP passe de
 * toute façon secret/durée explicitement à chaque vérification). Les
 * repositories viennent de DatabaseModule (@Global).
 *
 * RealtimeGateway est EXPORTÉ : NotificationsService l'injecte pour émettre
 * après persistance ; PostsService peut l'injecter pour 'map.updated'.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const auth = configService.getOrThrow<AuthConfig>('auth');
        return { secret: auth.jwtSecret };
      },
    }),
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}

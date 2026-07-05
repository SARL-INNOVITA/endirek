import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { HealthModule } from './modules/health/health.module';

/**
 * Module racine de l'API Endirek.
 *
 * Étape 1 (socle) : seuls ConfigModule (configuration typée globale) et
 * HealthModule (healthcheck) sont câblés.
 *
 * Les autres dossiers de src/modules ne contiennent que des README à ce stade ;
 * chaque module métier sera importé ici au fil des étapes du Lot 1
 * (étape 3 : auth, users — étape 4 : posts, feed, etc. — étape 5 : map,
 * cameras, notifications, realtime — étape 6 : moderation, admin).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    HealthModule,
  ],
})
export class AppModule {}

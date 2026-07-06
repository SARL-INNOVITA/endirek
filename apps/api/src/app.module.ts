import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';

/**
 * Module racine de l'API Endirek.
 *
 * Étape 1 (socle) : ConfigModule (configuration typée globale) et
 * HealthModule (healthcheck).
 * Étape 2 : DatabaseModule (couche persistance — driver mock en mémoire par
 * défaut, tokens de repositories exposés globalement).
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
    DatabaseModule,
    HealthModule,
  ],
})
export class AppModule {}

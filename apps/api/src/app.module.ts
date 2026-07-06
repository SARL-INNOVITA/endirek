import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

/**
 * Module racine de l'API Endirek.
 *
 * Étape 1 (socle) : ConfigModule (configuration typée globale) et
 * HealthModule (healthcheck).
 * Étape 2 : DatabaseModule (couche persistance — driver mock en mémoire par
 * défaut, tokens de repositories exposés globalement).
 * Étape 3 : AuthModule (register/login/refresh/me + guard JWT GLOBAL via
 * APP_GUARD — toute route non @Public() exige un Bearer token),
 * UsersModule (profils, follows, export RGPD, suppression RGPD) et
 * AdminModule (gestion des utilisateurs du backoffice — rôles
 * moderator/super_admin uniquement).
 *
 * Chaque module métier restant sera importé ici au fil des étapes du Lot 1
 * (étape 4 : posts, feed, etc. — étape 5 : map, cameras, notifications,
 * realtime — étape 6 : moderation et le reste du backoffice admin).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}

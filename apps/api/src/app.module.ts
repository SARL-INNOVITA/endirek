import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CamerasModule } from './modules/cameras/cameras.module';
import { CommentsModule } from './modules/comments/comments.module';
import { HealthModule } from './modules/health/health.module';
import { MapModule } from './modules/map/map.module';
import { MediaModule } from './modules/media/media.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PostsModule } from './modules/posts/posts.module';
import { ReactionsModule } from './modules/reactions/reactions.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SavedPostsModule } from './modules/saved-posts/saved-posts.module';
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
 * Étape 4 : MediaModule (upload d'images via l'adapter de stockage
 * MEDIA_STORAGE_DRIVER — fichiers servis sur /uploads/, voir main.ts),
 * PostsModule (publications, feed scoré, types de posts, listes de profil —
 * le fil d'actualité vit dans PostsModule, voir modules/feed/README.md),
 * MapModule (endpoints préparatoires : communes et marqueurs posts),
 * CommentsModule (fil deux niveaux option A + notifications in-app),
 * ReactionsModule (réactions emoji sur posts et commentaires),
 * SavedPostsModule (enregistrements — collection « Général »),
 * ModerationModule (signalements côté utilisateur) et l'extension du
 * AdminModule (modération des publications + file des signalements).
 *
 * Étape 5 : RealtimeModule (gateway socket.io — notifications en direct et
 * rafraîchissement carte), NotificationsModule (création centralisée +
 * lecture des notifications in-app), CamerasModule (caméras météo/trafic +
 * détail public) et l'extension du MapModule (overview/cameras) et du
 * AdminModule (backoffice caméras).
 *
 * Étape 6 : le reste du backoffice admin (types de posts).
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
    MediaModule,
    PostsModule,
    CommentsModule,
    ReactionsModule,
    SavedPostsModule,
    ModerationModule,
    RealtimeModule,
    NotificationsModule,
    CamerasModule,
    MapModule,
    HealthModule,
  ],
})
export class AppModule {}

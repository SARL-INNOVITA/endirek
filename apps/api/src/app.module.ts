import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CamerasModule } from './modules/cameras/cameras.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { DealplaceModule } from './modules/dealplace/dealplace.module';
import { DealsModule } from './modules/deals/deals.module';
import { HealthModule } from './modules/health/health.module';
import { MapModule } from './modules/map/map.module';
import { MediaModule } from './modules/media/media.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PagesModule } from './modules/pages/pages.module';
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
 *
 * Lot 2 — CP2.1 : DealplaceModule (taxonomie biens/services + annonces —
 * PREMIÈRE fonctionnalité du Lot 2 ; le backoffice Dealplace vit dans
 * AdminModule qui importe DealplaceModule pour l'assembler).
 *
 * Lot 2 — CP2.3 : ConversationsModule (messagerie 1-to-1 liée aux annonces,
 * temps réel via la gateway du Lot 1 — event 'message.created').
 *
 * Lot 2 — CP2.4 : DealsModule (deals contractuels — machine à états,
 * éléments validables, ajustements, litiges — + avis détaillés et stats du
 * profil Dealplace).
 *
 * Lot 3 : PagesModule (pages restaurants & entreprises — identité, horaires,
 * plats/menus programmés, cartes PDF, offres, événements, abonnés,
 * publications au nom de la page ; le backoffice Pages vit dans AdminModule
 * qui importe PagesModule pour l'assembler, le signalement de page dans
 * ModerationModule).
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
    DealplaceModule,
    ConversationsModule,
    DealsModule,
    PagesModule,
    HealthModule,
  ],
})
export class AppModule {}

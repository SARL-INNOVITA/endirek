import { Module } from '@nestjs/common';
import { CamerasModule } from '../cameras/cameras.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsModule } from '../posts/posts.module';
import { AdminCamerasController } from './admin-cameras.controller';
import { AdminCommentsController } from './admin-comments.controller';
import { AdminCommentsService } from './admin-comments.service';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminPostTypesController } from './admin-post-types.controller';
import { AdminPostTypesService } from './admin-post-types.service';
import { AdminPostsController } from './admin-posts.controller';
import { AdminPostsService } from './admin-posts.service';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

/**
 * Module admin — backoffice (Lot 1).
 *
 * Étape 3 : gestion des UTILISATEURS — liste paginée avec recherche/filtre,
 * profil complet, suspension et réactivation.
 * Étape 4 : modération des PUBLICATIONS (liste tous statuts + compteur de
 * signalements ouverts, détail avec signalements liés, masquage/republication)
 * et file des SIGNALEMENTS (liste filtrée avec extrait de cible, traitement
 * reviewed/action_taken/dismissed).
 * Toutes les routes sont réservées aux rôles moderator et super_admin
 * (guard JWT global + RolesGuard sur chaque contrôleur).
 *
 * Étape 5 : gestion des CAMÉRAS météo/trafic (les 6 routes /admin/cameras),
 * déléguée à CamerasService (source unique partagée avec la carte publique).
 * Le paramétrage des types de posts arrive à l'étape 6.
 *
 * PostsModule est importé pour FeedPostAssembler : la forme FEED_POST servie
 * au backoffice est assemblée par la MÊME source unique que le feed public.
 * CamerasModule fournit CamerasService (backoffice caméras) ;
 * NotificationsModule fournit NotificationsService (notification
 * « report_handled » émise au traitement d'un signalement). Les repositories
 * sont fournis par DatabaseModule (@Global) via les tokens d'injection.
 */
@Module({
  imports: [PostsModule, CamerasModule, NotificationsModule],
  controllers: [
    AdminUsersController,
    AdminPostsController,
    AdminReportsController,
    AdminCamerasController,
    AdminPostTypesController,
    AdminCommentsController,
    AdminNotificationsController,
  ],
  providers: [
    AdminUsersService,
    AdminPostsService,
    AdminReportsService,
    AdminPostTypesService,
    AdminCommentsService,
    AdminNotificationsService,
  ],
})
export class AdminModule {}

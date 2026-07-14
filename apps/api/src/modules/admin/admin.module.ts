import { Module } from '@nestjs/common';
import { CamerasModule } from '../cameras/cameras.module';
import { DealplaceModule } from '../dealplace/dealplace.module';
import { DealsModule } from '../deals/deals.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PagesModule } from '../pages/pages.module';
import { PostsModule } from '../posts/posts.module';
import { AdminCamerasController } from './admin-cameras.controller';
import { AdminCommentsController } from './admin-comments.controller';
import { AdminCommentsService } from './admin-comments.service';
import { AdminConversationsController } from './admin-conversations.controller';
import { AdminConversationsService } from './admin-conversations.service';
import { AdminPagesController } from './admin-pages.controller';
import { AdminPagesService } from './admin-pages.service';
import { AdminDealplaceTaxonomyController } from './admin-dealplace-taxonomy.controller';
import { AdminDealplaceTaxonomyService } from './admin-dealplace-taxonomy.service';
import { AdminDealsController } from './admin-deals.controller';
import { AdminListingsController } from './admin-listings.controller';
import { AdminListingsService } from './admin-listings.service';
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
 *
 * Lot 2 — CP2.1 : backoffice Dealplace (annonces + taxonomie). DealplaceModule
 * est importé pour ListingAssembler : la forme LISTING/LISTING_CARD servie au
 * backoffice est assemblée par la MÊME source unique que l'annuaire public.
 *
 * Lot 2 — CP2.5 : modération avancée Dealplace (D65-D67) — file des
 * signalements étendue aux ANNONCES (extrait de cible + compteur sur la liste
 * admin des annonces), DEALS (liste/détail/arbitrage des litiges — délégué à
 * DealsService, pattern « service métier hôte » : la machine à états reste au
 * module deals) et CONVERSATIONS (liste, fils en clair, masquage doux d'un
 * message).
 */
@Module({
  imports: [
    PostsModule,
    CamerasModule,
    NotificationsModule,
    DealplaceModule,
    DealsModule,
    PagesModule,
  ],
  controllers: [
    AdminUsersController,
    AdminPostsController,
    AdminReportsController,
    AdminCamerasController,
    AdminPostTypesController,
    AdminCommentsController,
    AdminNotificationsController,
    AdminListingsController,
    AdminDealplaceTaxonomyController,
    AdminDealsController,
    AdminConversationsController,
    AdminPagesController,
  ],
  providers: [
    AdminUsersService,
    AdminPostsService,
    AdminReportsService,
    AdminPostTypesService,
    AdminCommentsService,
    AdminNotificationsService,
    AdminListingsService,
    AdminDealplaceTaxonomyService,
    AdminConversationsService,
    AdminPagesService,
  ],
})
export class AdminModule {}

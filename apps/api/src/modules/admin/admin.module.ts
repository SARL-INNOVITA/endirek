import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
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
 * Étape 6 (reste du backoffice minimal) : gestion des caméras météo/trafic
 * et paramétrage des types de posts — voir README.md du module.
 *
 * PostsModule est importé pour FeedPostAssembler : la forme FEED_POST servie
 * au backoffice est assemblée par la MÊME source unique que le feed public.
 * Les repositories sont fournis par DatabaseModule (@Global) via les tokens
 * d'injection.
 */
@Module({
  imports: [PostsModule],
  controllers: [
    AdminUsersController,
    AdminPostsController,
    AdminReportsController,
  ],
  providers: [AdminUsersService, AdminPostsService, AdminReportsService],
})
export class AdminModule {}

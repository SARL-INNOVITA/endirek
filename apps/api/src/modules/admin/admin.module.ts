import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

/**
 * Module admin — backoffice (Lot 1).
 *
 * Étape 3 (ce module, périmètre actuel) : gestion des UTILISATEURS —
 * liste paginée avec recherche/filtre, profil complet, suspension et
 * réactivation. Routes réservées aux rôles moderator et super_admin
 * (guard JWT global + RolesGuard, voir AdminUsersController).
 *
 * Étape 6 (backoffice minimal complet) : modération des posts et
 * commentaires, traitement des signalements, gestion des caméras et des
 * types de posts — voir README.md du module.
 *
 * Les repositories sont fournis par DatabaseModule (@Global) via les
 * tokens d'injection.
 */
@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminModule {}

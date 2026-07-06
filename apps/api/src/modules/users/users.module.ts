import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Module utilisateurs (Lot 1 étape 3) — profils complet/public, follows,
 * listes followers/following paginées, export RGPD et suppression RGPD.
 *
 * Les repositories sont fournis par DatabaseModule (@Global) via les tokens
 * d'injection ; le guard JWT global (AuthModule) protège toutes les routes.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

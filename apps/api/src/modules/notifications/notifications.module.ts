import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Module notifications (Lot 1 étape 5) — endpoints de lecture des
 * notifications in-app de l'utilisateur courant (liste paginée, compteur de
 * non-lues, marquage lu/tout-lu) et CRÉATION CENTRALISÉE (NotificationsService.
 * create persiste ET émet en temps réel).
 *
 * NotificationsService est EXPORTÉ : les modules producteurs (commentaires,
 * réactions, admin — traitement de signalement) l'importent pour créer leurs
 * notifications via ce point unique, au lieu d'écrire dans le repository.
 *
 * Importe RealtimeModule pour la gateway d'émission. Les repositories viennent
 * de DatabaseModule (@Global).
 */
@Module({
  imports: [RealtimeModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

/**
 * Module conversations 1-to-1 (Lot 2 — CP2.3) : messagerie privée temps réel
 * LIÉE À UNE ANNONCE (décision D63).
 *
 * Périmètre STRICT du checkpoint :
 * - démarrage d'un fil depuis une annonce (get-or-create + premier message) ;
 * - liste de mes conversations (cartes) + badge de non-lus ;
 * - messages d'un fil (pagination) + envoi + marquage lu ;
 * - diffusion temps réel via la GATEWAY DU LOT 1 (RealtimeModule, event
 *   'message.created' vers la room privée du destinataire — pas de second
 *   canal, pas de namespace dédié).
 *
 * HORS périmètre (checkpoints ultérieurs) : deals contractuels (CP2.4 — le
 * fil accueillera la négociation), pièces jointes, suppression/édition de
 * message, conversations sans annonce, messagerie de groupe. Les repositories
 * (conversations) sont fournis globalement par DatabaseModule via les tokens.
 */
@Module({
  imports: [RealtimeModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}

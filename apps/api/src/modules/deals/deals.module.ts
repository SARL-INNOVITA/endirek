import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { UserDealProfileController } from './user-deal-profile.controller';

/**
 * Module deals contractuels (Lot 2 — CP2.4, décision D64) : le cœur du
 * Dealplace — machine à états (proposed → active → completed + declined/
 * cancelled/disputed), éléments et sous-éléments validables par les DEUX
 * parties, ajustements appliqués à l'acceptation, notes de suivi, annulation
 * amiable en deux temps, litige (terminal), avis détaillés sur deal conclu,
 * stats du profil Dealplace (mockup 05).
 *
 * Notifications in-app type 'deal' sur les JALONS (NotificationsModule) +
 * event socket `deal.updated` (RealtimeModule — gateway du Lot 1). HORS
 * périmètre : arbitrage des litiges et modération backoffice des deals
 * (CP2.5+), paiement (hors app — la valeur des éléments est indicative).
 */
@Module({
  imports: [NotificationsModule, RealtimeModule],
  controllers: [DealsController, UserDealProfileController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}

import { Module } from '@nestjs/common';
import { DealplaceModule } from '../dealplace/dealplace.module';
import { PostsModule } from '../posts/posts.module';
import { ListingModerationController } from './listing-moderation.controller';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

/**
 * Module modération — versant UTILISATEUR des signalements :
 * POST /posts/:id/report (Lot 1) et POST /dealplace/listings/:id/report
 * (Lot 2 — CP2.5, D65). Anti-doublon 409, la cible reste active tant que la
 * modération n'a pas agi. La file de traitement backoffice vit dans le
 * module admin (notification « report_handled »).
 *
 * Importe PostsModule (PostsService.loadVisiblePost) et DealplaceModule
 * (DealplaceService.loadVisibleListing) pour la visibilité des cibles.
 * Repositories via DatabaseModule (@Global).
 */
@Module({
  imports: [PostsModule, DealplaceModule],
  controllers: [ModerationController, ListingModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}

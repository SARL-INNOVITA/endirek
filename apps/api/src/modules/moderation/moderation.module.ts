import { Module } from '@nestjs/common';
import { DealplaceModule } from '../dealplace/dealplace.module';
import { PagesModule } from '../pages/pages.module';
import { PostsModule } from '../posts/posts.module';
import { ListingModerationController } from './listing-moderation.controller';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { PageModerationController } from './page-moderation.controller';

/**
 * Module modération — versant UTILISATEUR des signalements :
 * POST /posts/:id/report (Lot 1), POST /dealplace/listings/:id/report
 * (Lot 2 — CP2.5, D65) et POST /pages/:id/report (Lot 3 — D76).
 * Anti-doublon 409, la cible reste active tant que la modération n'a pas
 * agi. La file de traitement backoffice vit dans le module admin
 * (notification « report_handled »).
 *
 * Importe PostsModule (PostsService.loadVisiblePost), DealplaceModule
 * (DealplaceService.loadVisibleListing) et PagesModule
 * (PagesService.loadVisiblePage) pour la visibilité des cibles.
 * Repositories via DatabaseModule (@Global).
 */
@Module({
  imports: [PostsModule, DealplaceModule, PagesModule],
  controllers: [
    ModerationController,
    ListingModerationController,
    PageModerationController,
  ],
  providers: [ModerationService],
})
export class ModerationModule {}

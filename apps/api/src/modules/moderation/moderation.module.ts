import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

/**
 * Module modération (Lot 1) — à l'étape 4, le versant UTILISATEUR des
 * signalements : POST /posts/:id/report (anti-doublon 409, le post reste
 * actif). La file de traitement backoffice (liste, prise de décision,
 * notification « report_handled ») arrive à l'étape 6.
 *
 * Importe PostsModule pour la visibilité des posts
 * (PostsService.loadVisiblePost). Repositories via DatabaseModule (@Global).
 */
@Module({
  imports: [PostsModule],
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}

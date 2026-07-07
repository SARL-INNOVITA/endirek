import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsModule } from '../posts/posts.module';
import { CommentReactionsController } from './comment-reactions.controller';
import { PostReactionsController } from './post-reactions.controller';
import { ReactionsService } from './reactions.service';

/**
 * Module réactions (Lot 1 étape 4) — réactions emoji sur les posts et les
 * commentaires : upsert (changer d'emoji remplace), retrait idempotent,
 * palette validée contre la table reaction_types (pilotable backoffice,
 * jamais hardcodée), compteurs dénormalisés maintenus par les repositories.
 *
 * Importe PostsModule pour la règle de visibilité des posts
 * (PostsService.loadVisiblePost) et NotificationsModule pour la notification
 * 'reaction' à l'auteur d'un post (NotificationsService — persistance +
 * émission temps réel). Les repositories viennent de DatabaseModule (@Global).
 */
@Module({
  imports: [PostsModule, NotificationsModule],
  controllers: [PostReactionsController, CommentReactionsController],
  providers: [ReactionsService],
})
export class ReactionsModule {}

import { Module } from '@nestjs/common';
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
 * (PostsService.loadVisiblePost). Les repositories viennent de
 * DatabaseModule (@Global).
 */
@Module({
  imports: [PostsModule],
  controllers: [PostReactionsController, CommentReactionsController],
  providers: [ReactionsService],
})
export class ReactionsModule {}

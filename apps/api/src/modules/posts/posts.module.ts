import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { FeedPostAssembler } from './feed-post.assembler';
import { FeedService } from './feed.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { UserPostsController } from './user-posts.controller';

/**
 * Module publications (Lot 1 étape 4) — création, feed scoré, détail,
 * modification/suppression par l'auteur, listes de profil et types de posts.
 *
 * Le FIL D'ACTUALITÉ vit ici (FeedService) plutôt que dans un module feed
 * séparé : il partage repositories et assembler avec le reste des posts —
 * voir modules/feed/README.md.
 *
 * FeedPostAssembler (forme FEED_POST du contrat) est EXPORTÉ : les modules
 * des phases suivantes (interactions, saved-posts, admin) importeront
 * PostsModule pour assembler la même forme — source unique.
 *
 * Importe RealtimeModule (étape 5) pour émettre l'événement léger
 * 'map.updated' à la création d'un post visible carte.
 */
@Module({
  imports: [RealtimeModule],
  controllers: [PostsController, UserPostsController],
  providers: [PostsService, FeedService, FeedPostAssembler],
  exports: [FeedPostAssembler, PostsService],
})
export class PostsModule {}

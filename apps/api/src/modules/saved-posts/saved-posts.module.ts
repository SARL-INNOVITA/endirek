import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { PostSaveController } from './post-save.controller';
import { SavedPostsService } from './saved-posts.service';
import { UserSavedPostsController } from './user-saved-posts.controller';

/**
 * Module enregistrements (Lot 1 étape 4) — save/unsave idempotents dans la
 * collection par défaut « Général » (créée au besoin) et liste « mes posts
 * enregistrés » en forme FEED_POST. Les collections personnalisées sont
 * prévues pour un lot ultérieur (le schéma les supporte déjà).
 *
 * Importe PostsModule pour la visibilité des posts
 * (PostsService.loadVisiblePost) et l'assemblage FEED_POST
 * (FeedPostAssembler) — source unique. Repositories via DatabaseModule
 * (@Global).
 */
@Module({
  imports: [PostsModule],
  controllers: [PostSaveController, UserSavedPostsController],
  providers: [SavedPostsService],
})
export class SavedPostsModule {}

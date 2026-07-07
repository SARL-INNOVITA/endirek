import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsModule } from '../posts/posts.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { PostCommentsController } from './post-comments.controller';

/**
 * Module commentaires (Lot 1 étape 4) — fil de commentaires d'un post
 * (racines paginées + réponses imbriquées, option A stricte : profondeur
 * limitée à 1), création avec notifications in-app (types 'comment' et
 * 'reply') et suppression douce par l'auteur du commentaire ou du post.
 *
 * Importe PostsModule pour la règle de visibilité des posts
 * (PostsService.loadVisiblePost) et la forme AUTEUR
 * (FeedPostAssembler.loadAuthors) — source unique, rien n'est réassemblé
 * à la main. Importe NotificationsModule pour créer les notifications
 * 'comment'/'reply' via NotificationsService (persistance + émission temps
 * réel). Les repositories viennent de DatabaseModule (@Global).
 */
@Module({
  imports: [PostsModule, NotificationsModule],
  controllers: [PostCommentsController, CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}

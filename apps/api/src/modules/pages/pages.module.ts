import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PageAssembler } from './page.assembler';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { UserPagesController } from './user-pages.controller';

/**
 * Module pages restaurants & entreprises (Lot 3 — D69-D76).
 *
 * Importe PostsModule pour FeedPostAssembler (publications de page — D73) et
 * RealtimeModule pour l'événement map.updated. Les repositories viennent de
 * DatabaseModule (@Global). Exporte PageAssembler et PagesService pour les
 * modules moderation (signalement de page — D76) et admin (backoffice Pages).
 */
@Module({
  imports: [PostsModule, RealtimeModule],
  controllers: [PagesController, UserPagesController],
  providers: [PagesService, PageAssembler],
  exports: [PagesService, PageAssembler],
})
export class PagesModule {}

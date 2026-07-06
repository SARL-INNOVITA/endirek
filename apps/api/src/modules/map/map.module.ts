import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { MapController } from './map.controller';
import { MapService } from './map.service';

/**
 * Module carte (endpoints préparatoires de l'étape 4) : référentiel des
 * communes et marqueurs posts. Importe PostsModule pour la forme AUTEUR
 * (FeedPostAssembler.loadAuthors) — source unique du contrat.
 *
 * L'écran carte complet (caméras, modes, clustering) arrive à l'étape 5.
 */
@Module({
  imports: [PostsModule],
  controllers: [MapController],
  providers: [MapService],
})
export class MapModule {}

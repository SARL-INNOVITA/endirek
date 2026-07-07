import { Module } from '@nestjs/common';
import { CamerasModule } from '../cameras/cameras.module';
import { PostsModule } from '../posts/posts.module';
import { MapController } from './map.controller';
import { MapService } from './map.service';

/**
 * Module carte (Lot 1 étape 5) — page Carte (mode Météo & trafic) : communes,
 * marqueurs posts météo/trafic/danger et caméras actives, plus la vue
 * d'ensemble /overview (un seul appel mobile).
 *
 * Importe PostsModule pour la forme AUTEUR (FeedPostAssembler.loadAuthors —
 * source unique du contrat) et CamerasModule pour la liste publique des
 * caméras actives (CamerasService). Les repositories (posts, post_types)
 * viennent de DatabaseModule (@Global).
 */
@Module({
  imports: [PostsModule, CamerasModule],
  controllers: [MapController],
  providers: [MapService],
})
export class MapModule {}

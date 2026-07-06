import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { FeedPost } from '../../common/mappers/post.mapper';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FeedService } from './feed.service';
import { PagedFeedPosts, PostsService, PostTypeView } from './posts.service';

/**
 * Contrôleur publications — contrat d'API étape 4.
 *
 * Toutes les routes exigent un jeton (guard JWT global). Les routes
 * statiques (types, feed, slug/...) sont déclarées AVANT ':id' pour ne
 * jamais être capturées par le paramètre dynamique.
 */
@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly feedService: FeedService,
  ) {}

  @Get('types')
  @ApiOperation({
    summary: 'Types de publication actifs (triés par position)',
    description:
      'Table de référence post_types pilotable par le backoffice — le ' +
      'mobile construit sa bottom sheet de composition avec cette liste.',
  })
  @ApiResponse({ status: 200, description: 'Liste des types actifs' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  listTypes(): Promise<PostTypeView[]> {
    return this.postsService.listTypes();
  }

  @Get('feed')
  @ApiOperation({
    summary: "Fil d'actualité scoré (récence, proximité, type, popularité, abonnements)",
    description:
      'Scoring MVP sur la fenêtre des 200 posts actifs les plus récents, ' +
      'ordre stable, pagination offset/limit. lat/lng (optionnels, ' +
      'ensemble) activent le bonus de proximité.',
  })
  @ApiResponse({ status: 200, description: '{ items: FEED_POST[], total }' })
  @ApiResponse({ status: 400, description: 'Paramètres invalides' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  getFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FeedQueryDto,
  ): Promise<PagedFeedPosts> {
    return this.feedService.getFeed(user.userId, {
      limit: query.limit,
      offset: query.offset,
      lat: query.lat,
      lng: query.lng,
    });
  }

  @Post()
  @ApiOperation({
    summary: 'Créer une publication',
    description:
      'Type actif obligatoire. Type carte (showsOnMap) + location → ' +
      'mapExpiresAt = now + durée du type ; sans location le post est ' +
      'feed-only (légal). La location, si fournie, doit se situer à La ' +
      'Réunion (400 sinon — produit mono-île au Lot 1). city déduite de ' +
      'la commune la plus proche si absente ou vide. urlSlug généré ' +
      'unique. 4 médias max (images), URLs issues de POST /media/upload ' +
      'uniquement (400 sinon).',
  })
  @ApiResponse({ status: 201, description: 'FEED_POST créé' })
  @ApiResponse({
    status: 400,
    description:
      'Données invalides, position hors de La Réunion ou média externe',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ): Promise<FeedPost> {
    return this.postsService.create(user.userId, dto);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: "Détail d'une publication par urlSlug",
    description:
      "Mêmes règles de visibilité que GET /posts/:id : 'deleted' → 404 ; " +
      "'hidden' → 404 sauf auteur et rôles moderator/super_admin.",
  })
  @ApiParam({ name: 'slug', description: 'urlSlug public de la publication' })
  @ApiResponse({ status: 200, description: 'FEED_POST' })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  getBySlug(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ): Promise<FeedPost> {
    return this.postsService.getBySlug(user, slug);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détail d'une publication",
    description:
      "'deleted' → 404 ; 'hidden' → 404 sauf pour l'auteur et les rôles " +
      'moderator/super_admin.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({ status: 200, description: 'FEED_POST' })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<FeedPost> {
    return this.postsService.getById(user, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier une publication (title/body — auteur uniquement)',
    description:
      'Type et location ne sont pas modifiables au MVP (règles carte figées ' +
      'à la création).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({ status: 200, description: 'FEED_POST mis à jour' })
  @ApiResponse({ status: 403, description: "Le viewer n'est pas l'auteur" })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<FeedPost> {
    return this.postsService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une publication (auteur uniquement — soft-delete)',
    description:
      "status='deleted' : la ligne reste (RGPD/audit), le post disparaît du " +
      'feed, de la carte et du détail.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la publication' })
  @ApiResponse({ status: 204, description: 'Publication supprimée' })
  @ApiResponse({ status: 403, description: "Le viewer n'est pas l'auteur" })
  @ApiResponse({ status: 404, description: 'Publication introuvable' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.postsService.remove(user, id);
  }
}

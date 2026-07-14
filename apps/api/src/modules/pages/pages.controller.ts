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
  Put,
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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  DishView,
  MenuDayView,
  PageEventView,
  PageOfferView,
  PageView,
} from '../../common/mappers/page.mapper';
import { FeedPost } from '../../common/mappers/post.mapper';
import { PagedFeedPosts } from '../posts/posts.service';
import { CreateDishDto } from './dto/create-dish.dto';
import { CreatePageDto } from './dto/create-page.dto';
import { CreatePageDocumentDto } from './dto/create-page-document.dto';
import { CreatePageEventDto } from './dto/create-page-event.dto';
import { CreatePageOfferDto } from './dto/create-page-offer.dto';
import {
  PageContentQueryDto,
  PageMenusQueryDto,
} from './dto/page-content-query.dto';
import { PublishPagePostDto } from './dto/publish-page-post.dto';
import { ReplaceHoursDto } from './dto/replace-hours.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { UpdatePageEventDto } from './dto/update-page-event.dto';
import { UpdatePageOfferDto } from './dto/update-page-offer.dto';
import { UpsertMenuDto } from './dto/upsert-menu.dto';
import {
  DishListView,
  MenuWeekView,
  PageEventsView,
  PageOffersView,
  PagesService,
} from './pages.service';

/**
 * Contrôleur des pages restaurants & entreprises (Lot 3 — D69-D76).
 *
 * ORDRE DES ROUTES : la route statique `slug/:slug` est déclarée AVANT
 * `:id` (sinon « slug » serait interprété comme un id). Le signalement de
 * page (POST /pages/:id/report) vit dans le module moderation (D76).
 */
@ApiTags('pages')
@ApiBearerAuth()
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  // ── Création / lecture ─────────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Créer une page professionnelle',
    description:
      'Restaurant ou entreprise (pageType immuable). La page est ACTIVE ' +
      'immédiatement (« validation légère » — D69) ; le badge vérifié est ' +
      'accordé au backoffice. Commune du référentiel La Réunion obligatoire ' +
      '(position = centre de la commune).',
  })
  @ApiResponse({ status: 201, description: 'PAGE' })
  @ApiResponse({ status: 400, description: 'Commune inconnue ou corps invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePageDto,
  ): Promise<PageView> {
    return this.pagesService.create(user, dto);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: "Détail d'une page par son slug public" })
  @ApiParam({ name: 'slug', description: 'urlSlug public de la page' })
  @ApiResponse({ status: 200, description: 'PAGE' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  getBySlug(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ): Promise<PageView> {
    return this.pagesService.getBySlug(user, slug);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détail d'une page",
    description:
      "Page 'active' visible de tous ; 'hidden' → 404 sauf propriétaire/" +
      "modération ; 'deleted' → 404 (miroir des annonces — D69). Contient " +
      'les horaires, documents, statut d’ouverture dérivé (D70), isOwner et ' +
      'myFollow contextualisés pour l’appelant.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: 'PAGE' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PageView> {
    return this.pagesService.getById(user, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier une page (propriétaire)',
    description:
      'Patch partiel — pageType et urlSlug immuables. Congés posés via ' +
      'vacationUntil/vacationMessage (D70).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: 'PAGE à jour' })
  @ApiResponse({ status: 400, description: 'Corps invalide' })
  @ApiResponse({ status: 403, description: 'Seul le propriétaire peut gérer cette page' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
  ): Promise<PageView> {
    return this.pagesService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une page (propriétaire — suppression douce définitive)',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 204, description: 'Page supprimée' })
  @ApiResponse({ status: 403, description: 'Seul le propriétaire peut gérer cette page' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.pagesService.remove(user, id);
  }

  // ── Horaires (D70) ─────────────────────────────────────────────────────────

  @Put(':id/hours')
  @ApiOperation({
    summary: 'Remplacer les horaires de la page (propriétaire)',
    description:
      'REMPLACE toutes les plages ([] = aucune : la page apparaît ' +
      '« Fermé »). 4 plages max par jour, sans chevauchement, ouverture < ' +
      'fermeture (pas de plage à cheval sur minuit — D70).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: 'PAGE à jour' })
  @ApiResponse({ status: 400, description: 'Plages incohérentes' })
  @ApiResponse({ status: 403, description: 'Seul le propriétaire peut gérer cette page' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  replaceHours(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReplaceHoursDto,
  ): Promise<PageView> {
    return this.pagesService.replaceHours(user, id, dto);
  }

  // ── Menus programmés (D71 — restaurant) ────────────────────────────────────

  @Get(':id/menus')
  @ApiOperation({
    summary: 'Menus de la semaine (sélecteur de jours du mockup 08)',
    description:
      "7 jours consécutifs à partir de `from` (défaut : aujourd'hui, heure " +
      'Réunion) — les jours sans menu ont items: []. Restaurant uniquement ' +
      '(400 sur une page entreprise).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: '{ days: MENU_DAY[7] }' })
  @ApiResponse({ status: 400, description: 'Page entreprise (pas de menus)' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  getMenus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: PageMenusQueryDto,
  ): Promise<MenuWeekView> {
    return this.pagesService.getMenuWeek(user, id, query.from);
  }

  @Put(':id/menus/:date')
  @ApiOperation({
    summary: "Programmer le menu d'une date (propriétaire)",
    description:
      'Crée ou REMPLACE le menu du jour de la date (YYYY-MM-DD) avec la ' +
      'liste ORDONNÉE de plats — [] supprime le menu (D71).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiParam({ name: 'date', description: "Date calendaire 'YYYY-MM-DD'" })
  @ApiResponse({ status: 200, description: 'MENU_DAY à jour' })
  @ApiResponse({ status: 400, description: 'Date ou plats invalides' })
  @ApiResponse({ status: 403, description: 'Seul le propriétaire peut gérer cette page' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  upsertMenu(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('date') date: string,
    @Body() dto: UpsertMenuDto,
  ): Promise<MenuDayView> {
    return this.pagesService.upsertMenu(user, id, date, dto);
  }

  // ── Plats (D71 — restaurant) ───────────────────────────────────────────────

  @Get(':id/dishes')
  @ApiOperation({
    summary: 'Bibliothèque de plats (propriétaire/modération)',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: '{ items: DISH[] }' })
  @ApiResponse({ status: 403, description: 'Réservé au propriétaire' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  listDishes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DishListView> {
    return this.pagesService.listDishes(user, id);
  }

  @Post(':id/dishes')
  @ApiOperation({
    summary: 'Créer un plat prédéfini (propriétaire)',
    description:
      'Prix en CENTIMES, au moins un des deux (à emporter / sur place — ' +
      'D71). Image issue de /media/upload.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 201, description: 'DISH' })
  @ApiResponse({ status: 400, description: 'Prix manquant ou page entreprise' })
  @ApiResponse({ status: 403, description: 'Seul le propriétaire peut gérer cette page' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  createDish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateDishDto,
  ): Promise<DishView> {
    return this.pagesService.createDish(user, id, dto);
  }

  @Patch(':id/dishes/:dishId')
  @ApiOperation({ summary: 'Modifier un plat (propriétaire)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiParam({ name: 'dishId', description: 'Identifiant du plat' })
  @ApiResponse({ status: 200, description: 'DISH à jour' })
  @ApiResponse({ status: 400, description: 'Corps invalide' })
  @ApiResponse({ status: 404, description: 'Page ou plat introuvable' })
  updateDish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('dishId') dishId: string,
    @Body() dto: UpdateDishDto,
  ): Promise<DishView> {
    return this.pagesService.updateDish(user, id, dishId, dto);
  }

  @Delete(':id/dishes/:dishId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un plat (propriétaire)',
    description:
      'Suppression douce qui RETIRE le plat de tous les menus programmés (D71).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiParam({ name: 'dishId', description: 'Identifiant du plat' })
  @ApiResponse({ status: 204, description: 'Plat supprimé' })
  @ApiResponse({ status: 404, description: 'Page ou plat introuvable' })
  async removeDish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('dishId') dishId: string,
  ): Promise<void> {
    await this.pagesService.removeDish(user, id, dishId);
  }

  // ── Documents « Nos cartes » (D71/D77 — restaurant) ────────────────────────

  @Post(':id/documents')
  @ApiOperation({
    summary: 'Attacher un document « Nos cartes » (propriétaire)',
    description:
      'URL issue de POST /media/upload-document (PDF), 5 documents max par ' +
      'page. Retourne la PAGE à jour (section documents).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 201, description: 'PAGE à jour' })
  @ApiResponse({ status: 400, description: 'URL invalide ou quota atteint' })
  @ApiResponse({ status: 403, description: 'Seul le propriétaire peut gérer cette page' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  createDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreatePageDocumentDto,
  ): Promise<PageView> {
    return this.pagesService.createDocument(user, id, dto);
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Détacher un document (propriétaire)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiParam({ name: 'documentId', description: 'Identifiant du document' })
  @ApiResponse({ status: 204, description: 'Document détaché' })
  @ApiResponse({ status: 404, description: 'Page ou document introuvable' })
  async removeDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.pagesService.removeDocument(user, id, documentId);
  }

  // ── Offres (D72) ───────────────────────────────────────────────────────────

  @Get(':id/offers')
  @ApiOperation({
    summary: "Offres d'une page",
    description:
      'Le public voit les offres NON EXPIRÉES ; all=true (propriétaire/' +
      'modération) inclut l’historique complet.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: '{ items: OFFER[] }' })
  @ApiResponse({ status: 403, description: 'Historique réservé au propriétaire' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  listOffers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: PageContentQueryDto,
  ): Promise<PageOffersView> {
    return this.pagesService.listOffers(user, id, query.all === true);
  }

  @Post(':id/offers')
  @ApiOperation({ summary: 'Créer une offre (propriétaire)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 201, description: 'OFFER' })
  @ApiResponse({ status: 400, description: 'Période incohérente' })
  @ApiResponse({ status: 403, description: 'Seul le propriétaire peut gérer cette page' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  createOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreatePageOfferDto,
  ): Promise<PageOfferView> {
    return this.pagesService.createOffer(user, id, dto);
  }

  @Patch(':id/offers/:offerId')
  @ApiOperation({ summary: 'Modifier une offre (propriétaire)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiParam({ name: 'offerId', description: "Identifiant de l'offre" })
  @ApiResponse({ status: 200, description: 'OFFER à jour' })
  @ApiResponse({ status: 404, description: 'Page ou offre introuvable' })
  updateOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('offerId') offerId: string,
    @Body() dto: UpdatePageOfferDto,
  ): Promise<PageOfferView> {
    return this.pagesService.updateOffer(user, id, offerId, dto);
  }

  @Delete(':id/offers/:offerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une offre (propriétaire — soft)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiParam({ name: 'offerId', description: "Identifiant de l'offre" })
  @ApiResponse({ status: 204, description: 'Offre supprimée' })
  @ApiResponse({ status: 404, description: 'Page ou offre introuvable' })
  async removeOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('offerId') offerId: string,
  ): Promise<void> {
    await this.pagesService.removeOffer(user, id, offerId);
  }

  // ── Événements (D72) ───────────────────────────────────────────────────────

  @Get(':id/events')
  @ApiOperation({
    summary: "Événements d'une page",
    description:
      'Le public voit les événements À VENIR et EN COURS (tri par date de ' +
      'début) ; all=true (propriétaire/modération) inclut les passés.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: '{ items: EVENT[] }' })
  @ApiResponse({ status: 403, description: 'Historique réservé au propriétaire' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  listEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: PageContentQueryDto,
  ): Promise<PageEventsView> {
    return this.pagesService.listEvents(user, id, query.all === true);
  }

  @Post(':id/events')
  @ApiOperation({ summary: 'Créer un événement (propriétaire)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 201, description: 'EVENT' })
  @ApiResponse({ status: 400, description: 'Période incohérente' })
  @ApiResponse({ status: 403, description: 'Seul le propriétaire peut gérer cette page' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  createEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreatePageEventDto,
  ): Promise<PageEventView> {
    return this.pagesService.createEvent(user, id, dto);
  }

  @Patch(':id/events/:eventId')
  @ApiOperation({ summary: 'Modifier un événement (propriétaire)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiParam({ name: 'eventId', description: "Identifiant de l'événement" })
  @ApiResponse({ status: 200, description: 'EVENT à jour' })
  @ApiResponse({ status: 404, description: 'Page ou événement introuvable' })
  updateEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdatePageEventDto,
  ): Promise<PageEventView> {
    return this.pagesService.updateEvent(user, id, eventId, dto);
  }

  @Delete(':id/events/:eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un événement (propriétaire — soft)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiParam({ name: 'eventId', description: "Identifiant de l'événement" })
  @ApiResponse({ status: 204, description: 'Événement supprimé' })
  @ApiResponse({ status: 404, description: 'Page ou événement introuvable' })
  async removeEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
  ): Promise<void> {
    await this.pagesService.removeEvent(user, id, eventId);
  }

  // ── Abonnements (D74) ──────────────────────────────────────────────────────

  @Post(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "S'abonner à une page",
    description: 'Idempotent — jamais sa propre page (400).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 204, description: 'Abonné' })
  @ApiResponse({ status: 400, description: 'Sa propre page' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  async follow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.pagesService.follow(user, id);
  }

  @Delete(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Se désabonner d’une page',
    description:
      'Idempotent — permis même si la page est masquée/supprimée (404 ' +
      'seulement si l’identifiant est inconnu).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 204, description: 'Désabonné' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  async unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.pagesService.unfollow(user, id);
  }

  // ── Publications de la page (D73) ──────────────────────────────────────────

  @Get(':id/posts')
  @ApiOperation({
    summary: "Publications d'une page",
    description:
      'FEED_POST actifs pour tous ; le propriétaire et la modération voient ' +
      'aussi les masqués (miroir des listes de profil).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 200, description: '{ items: FEED_POST[], total }' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  listPosts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PagedFeedPosts> {
    return this.pagesService.listPosts(user, id, pagination);
  }

  @Post(':id/posts')
  @ApiOperation({
    summary: 'Publier au nom de la page (propriétaire)',
    description:
      "kind = 'free' (publication libre), 'menu' (menu du jour auto-composé, " +
      "carte jusqu'à 23 h Réunion), 'offer' (offre auto-composée, carte " +
      "jusqu'à 23 h) ou 'event' (événement auto-composé, carte de J-3 à la " +
      'fin effective) — D73. Le post est un INSTANTANÉ des entités.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiResponse({ status: 201, description: 'FEED_POST créé' })
  @ApiResponse({
    status: 400,
    description:
      'Règle de nature non respectée (texte manquant, menu du jour absent, ' +
      'offre expirée, événement passé, page masquée...)',
  })
  @ApiResponse({ status: 403, description: 'Seul le propriétaire peut gérer cette page' })
  @ApiResponse({ status: 404, description: 'Page, offre ou événement introuvable' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PublishPagePostDto,
  ): Promise<FeedPost> {
    return this.pagesService.publish(user, id, dto);
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  DishView,
  MenuDayView,
  OwnerPageCard,
  PageCardView,
  PageEventView,
  PageOfferView,
  PageView,
  eventEffectiveEnd,
  toDishView,
  toPageEventView,
  toPageOfferView,
} from '../../common/mappers/page.mapper';
import { FeedPost } from '../../common/mappers/post.mapper';
import {
  addDaysToDateString,
  reunionDateString,
  reunionEndOfDayAt23,
} from '../../common/time/reunion-time';
import {
  PAGES_REPOSITORY,
  POSTS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import {
  Dish,
  Page,
  PageEvent,
  PageOffer,
} from '../../database/domain/entities';
import {
  CreatePostMediaSpec,
  PageHourSpec,
  PageParams,
  PagesRepository,
  PostsRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import { findCommuneByName } from '../../database/seed/communes';
import { AppConfig } from '../../config/configuration';
import { FeedPostAssembler } from '../posts/feed-post.assembler';
import { PagedFeedPosts } from '../posts/posts.service';
import {
  randomSlugSuffix,
  slugify,
} from '../posts/slug.util';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PageAssembler } from './page.assembler';
import { CreateDishDto } from './dto/create-dish.dto';
import { CreatePageDto } from './dto/create-page.dto';
import {
  CreatePageDocumentDto,
  PAGE_DOCUMENTS_MAX,
} from './dto/create-page-document.dto';
import { CreatePageEventDto } from './dto/create-page-event.dto';
import { CreatePageOfferDto } from './dto/create-page-offer.dto';
import { PublishPagePostDto } from './dto/publish-page-post.dto';
import { ReplaceHoursDto } from './dto/replace-hours.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { UpdatePageEventDto } from './dto/update-page-event.dto';
import { UpdatePageOfferDto } from './dto/update-page-offer.dto';
import { UpsertMenuDto } from './dto/upsert-menu.dto';

/** Liste de plats (bibliothèque du propriétaire). */
export interface DishListView {
  items: DishView[];
}

/** Semaine de menus (GET /pages/:id/menus) — 7 jours consécutifs, les jours
 * sans menu ont `items: []`. */
export interface MenuWeekView {
  days: MenuDayView[];
}

/** Liste d'offres d'une page. */
export interface PageOffersView {
  items: PageOfferView[];
}

/** Liste d'événements d'une page. */
export interface PageEventsView {
  items: PageEventView[];
}

/** Liste des pages du propriétaire (« Mes pages » — active + hidden). */
export interface OwnerPagesView {
  items: OwnerPageCard[];
}

/** Liste des pages actives d'un profil public. */
export interface PublicPagesView {
  items: PageCardView[];
}

/** Nombre maximal de plages horaires par jour (D70). */
const HOURS_PER_DAY_MAX = 4;

/** Nombre de tentatives de génération d'un urlSlug unique. */
const SLUG_MAX_ATTEMPTS = 5;

/** Fenêtre calendaire admise pour PUT /pages/:id/menus/:date, en jours
 * autour d'aujourd'hui (garde-fou de saisie — la programmation utile reste
 * la semaine glissante). */
const MENU_DATE_WINDOW_DAYS = 366;

/** Format de date calendaire accepté ('YYYY-MM-DD'). */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Service pages restaurants & entreprises (Lot 3 — D69-D76) : toutes les
 * règles métier des pages (les repositories ne portent que les contraintes
 * structurelles).
 *
 * Visibilité (miroir des annonces — D69) : 'active' visible de tous ;
 * 'hidden' → 404 sauf propriétaire + moderator/super_admin ; 'deleted' →
 * 404 pour tous. Menus/plats/documents sont RÉSERVÉS aux restaurants (400
 * sur une page entreprise — D71). Les publications au nom de la page (D73)
 * sont AUTO-COMPOSÉES depuis les entités (menu du jour, offre, événement),
 * sauf la publication libre.
 */
@Injectable()
export class PagesService {
  constructor(
    @Inject(PAGES_REPOSITORY)
    private readonly pagesRepository: PagesRepository,
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    private readonly assembler: PageAssembler,
    private readonly feedPostAssembler: FeedPostAssembler,
    private readonly configService: ConfigService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Lecture
  // ──────────────────────────────────────────────────────────────────────────

  /** Détail d'une page (GET /pages/:id). */
  async getById(viewer: AuthenticatedUser, id: string): Promise<PageView> {
    const page = await this.loadVisiblePage(viewer, id);
    return this.assembler.assembleOne(page, viewer.userId);
  }

  /** Détail d'une page par slug public (GET /pages/slug/:slug). */
  async getBySlug(viewer: AuthenticatedUser, slug: string): Promise<PageView> {
    const page = await this.pagesRepository.findByUrlSlug(slug);
    this.assertVisible(page, viewer);
    return this.assembler.assembleOne(page as Page, viewer.userId);
  }

  /** Mes pages — active + hidden (GET /users/me/pages, miroir D61 : le
   * propriétaire distingue ses pages masquées). */
  async listMine(viewer: AuthenticatedUser): Promise<OwnerPagesView> {
    const pages = await this.pagesRepository.listByOwner(viewer.userId, {
      statuses: ['active', 'hidden'],
    });
    return { items: await this.assembler.assembleOwnerCards(pages) };
  }

  /** Pages ACTIVES d'un utilisateur visible (GET /users/:id/pages). */
  async listByUser(userId: string): Promise<PublicPagesView> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.status !== 'active') {
      throw new NotFoundException('Utilisateur introuvable');
    }
    const pages = await this.pagesRepository.listByOwner(userId, {
      statuses: ['active'],
    });
    return { items: await this.assembler.assembleCards(pages) };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Création / modification / suppression (propriétaire uniquement)
  // ──────────────────────────────────────────────────────────────────────────

  /** Crée une page (POST /pages) — active immédiatement (« validation
   * légère » — D69), badge vérifié réservé au backoffice. */
  async create(viewer: AuthenticatedUser, dto: CreatePageDto): Promise<PageView> {
    const commune = this.resolveCommune(dto.city);
    this.assertUploadedUrls(
      [dto.avatarUrl, dto.coverUrl].filter(
        (value): value is string => value !== undefined,
      ),
    );
    const urlSlug = await this.generateUniqueSlug(dto.name);
    const page = await this.pagesRepository.create({
      ownerId: viewer.userId,
      pageType: dto.pageType,
      name: dto.name,
      urlSlug,
      bio: dto.bio ?? '',
      avatarUrl: dto.avatarUrl ?? null,
      coverUrl: dto.coverUrl ?? null,
      city: commune.name,
      location: { lat: commune.lat, lng: commune.lng },
      phone: dto.phone ?? null,
      attributes: this.normalizeAttributes(dto.attributes),
    });
    return this.assembler.assembleOne(page, viewer.userId);
  }

  /** Modifie une page (PATCH /pages/:id) — pageType/urlSlug immuables ;
   * changer de commune recalcule la position (centre de la commune). */
  async update(
    viewer: AuthenticatedUser,
    id: string,
    dto: UpdatePageDto,
  ): Promise<PageView> {
    const page = await this.loadOwnPage(viewer, id);
    this.assertUploadedUrls(
      [dto.avatarUrl, dto.coverUrl].filter(
        (value): value is string => value !== undefined && value !== null,
      ),
    );

    let city: string | undefined;
    let location: { lat: number; lng: number } | undefined;
    if (dto.city !== undefined) {
      const commune = this.resolveCommune(dto.city);
      city = commune.name;
      location = { lat: commune.lat, lng: commune.lng };
    }

    // Cohérence congés sur l'état RÉSULTANT : un message sans date de fin
    // n'aurait aucun support d'affichage (le statut dérivé l'ignore — D70).
    // Lever les congés (vacationUntil → null) efface IMPLICITEMENT le
    // message si le patch ne le pose pas explicitement.
    const nextVacationUntil =
      dto.vacationUntil !== undefined
        ? dto.vacationUntil === null
          ? null
          : new Date(dto.vacationUntil)
        : page.vacationUntil;
    let vacationMessagePatch = dto.vacationMessage;
    if (dto.vacationUntil === null && dto.vacationMessage === undefined) {
      vacationMessagePatch = null;
    }
    const nextVacationMessage =
      vacationMessagePatch !== undefined
        ? vacationMessagePatch
        : page.vacationMessage;
    if (nextVacationMessage !== null && nextVacationUntil === null) {
      throw new BadRequestException(
        'Un message de congés exige une date de fin (vacationUntil)',
      );
    }

    const updated = await this.pagesRepository.update(id, {
      name: dto.name,
      bio: dto.bio,
      avatarUrl: dto.avatarUrl,
      coverUrl: dto.coverUrl,
      city,
      location,
      phone: dto.phone,
      attributes:
        dto.attributes === undefined
          ? undefined
          : this.normalizeAttributes(dto.attributes),
      vacationUntil:
        dto.vacationUntil === undefined
          ? undefined
          : dto.vacationUntil === null
            ? null
            : new Date(dto.vacationUntil),
      vacationMessage: vacationMessagePatch,
    });
    return this.assembler.assembleOne(updated, viewer.userId);
  }

  /** Supprime une page (DELETE /pages/:id) — soft-delete définitif (D69). */
  async remove(viewer: AuthenticatedUser, id: string): Promise<void> {
    await this.loadOwnPage(viewer, id);
    await this.pagesRepository.setStatus(id, 'deleted');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Horaires (D70)
  // ──────────────────────────────────────────────────────────────────────────

  /** Remplace TOUTES les plages horaires (PUT /pages/:id/hours). */
  async replaceHours(
    viewer: AuthenticatedUser,
    id: string,
    dto: ReplaceHoursDto,
  ): Promise<PageView> {
    const page = await this.loadOwnPage(viewer, id);

    const specs: PageHourSpec[] = dto.hours.map((hour) => ({
      weekday: hour.weekday,
      opensMinute: this.parseHhMm(hour.opensAt),
      closesMinute: this.parseHhMm(hour.closesAt),
    }));
    // Cohérence par plage puis par jour : ouverture < fermeture, 4 plages
    // max par jour, aucun chevauchement au sein d'un même jour.
    for (const spec of specs) {
      if (spec.opensMinute >= spec.closesMinute) {
        throw new BadRequestException(
          "L'heure d'ouverture doit précéder l'heure de fermeture " +
            '(pas de plage à cheval sur minuit)',
        );
      }
    }
    for (let weekday = 0; weekday <= 6; weekday++) {
      const daily = specs
        .filter((spec) => spec.weekday === weekday)
        .sort((a, b) => a.opensMinute - b.opensMinute);
      if (daily.length > HOURS_PER_DAY_MAX) {
        throw new BadRequestException(
          `${HOURS_PER_DAY_MAX} plages maximum par jour`,
        );
      }
      for (let i = 1; i < daily.length; i++) {
        if (daily[i].opensMinute < daily[i - 1].closesMinute) {
          throw new BadRequestException(
            'Les plages horaires d’un même jour ne peuvent pas se chevaucher',
          );
        }
      }
    }

    await this.pagesRepository.replaceHours(id, specs);
    return this.assembler.assembleOne(
      (await this.pagesRepository.findById(page.id)) as Page,
      viewer.userId,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Plats (D71 — restaurant uniquement)
  // ──────────────────────────────────────────────────────────────────────────

  /** Bibliothèque de plats (GET /pages/:id/dishes) — propriétaire/modération. */
  async listDishes(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<DishListView> {
    const page = await this.loadVisiblePage(viewer, id);
    this.assertOwnerOrModerator(page, viewer);
    this.assertRestaurant(page);
    const dishes = await this.pagesRepository.listDishes(id);
    return { items: dishes.map(toDishView) };
  }

  /** Crée un plat (POST /pages/:id/dishes). */
  async createDish(
    viewer: AuthenticatedUser,
    id: string,
    dto: CreateDishDto,
  ): Promise<DishView> {
    const page = await this.loadOwnPage(viewer, id);
    this.assertRestaurant(page);
    this.assertAtLeastOnePrice(
      dto.priceTakeawayCents ?? null,
      dto.priceDineInCents ?? null,
    );
    if (dto.imageUrl !== undefined) {
      this.assertUploadedUrls([dto.imageUrl]);
    }
    const dish = await this.pagesRepository.createDish({
      pageId: id,
      name: dto.name,
      description: dto.description ?? '',
      imageUrl: dto.imageUrl ?? null,
      priceTakeawayCents: dto.priceTakeawayCents ?? null,
      priceDineInCents: dto.priceDineInCents ?? null,
    });
    return toDishView(dish);
  }

  /** Modifie un plat (PATCH /pages/:id/dishes/:dishId). */
  async updateDish(
    viewer: AuthenticatedUser,
    id: string,
    dishId: string,
    dto: UpdateDishDto,
  ): Promise<DishView> {
    const page = await this.loadOwnPage(viewer, id);
    this.assertRestaurant(page);
    const dish = await this.loadOwnDish(page, dishId);
    this.assertAtLeastOnePrice(
      dto.priceTakeawayCents !== undefined
        ? dto.priceTakeawayCents
        : dish.priceTakeawayCents,
      dto.priceDineInCents !== undefined
        ? dto.priceDineInCents
        : dish.priceDineInCents,
    );
    if (dto.imageUrl !== undefined && dto.imageUrl !== null) {
      this.assertUploadedUrls([dto.imageUrl]);
    }
    const updated = await this.pagesRepository.updateDish(dishId, {
      name: dto.name,
      description: dto.description,
      imageUrl: dto.imageUrl,
      priceTakeawayCents: dto.priceTakeawayCents,
      priceDineInCents: dto.priceDineInCents,
    });
    return toDishView(updated);
  }

  /** Supprime un plat (DELETE /pages/:id/dishes/:dishId) — suppression douce
   * qui RETIRE le plat des menus programmés (D71). */
  async removeDish(
    viewer: AuthenticatedUser,
    id: string,
    dishId: string,
  ): Promise<void> {
    const page = await this.loadOwnPage(viewer, id);
    this.assertRestaurant(page);
    await this.loadOwnDish(page, dishId);
    await this.pagesRepository.softDeleteDish(dishId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Menus programmés (D71 — restaurant uniquement)
  // ──────────────────────────────────────────────────────────────────────────

  /** Semaine de menus (GET /pages/:id/menus?from=YYYY-MM-DD) — 7 jours
   * consécutifs à partir de `from` (défaut : aujourd'hui, heure Réunion),
   * jours sans menu inclus avec `items: []` (sélecteur du mockup 08). */
  async getMenuWeek(
    viewer: AuthenticatedUser,
    id: string,
    from?: string,
  ): Promise<MenuWeekView> {
    const page = await this.loadVisiblePage(viewer, id);
    this.assertRestaurant(page);
    const fromDate = from ?? reunionDateString(new Date());
    this.assertMenuDateInWindow(fromDate);
    const toDate = addDaysToDateString(fromDate, 6);
    const menus = await this.pagesRepository.listMenusWithDishes(
      id,
      fromDate,
      toDate,
    );
    const byDate = new Map(menus.map((menu) => [menu.menu.menuDate, menu]));
    const days: MenuDayView[] = [];
    for (let offset = 0; offset <= 6; offset++) {
      const date = addDaysToDateString(fromDate, offset);
      const menu = byDate.get(date);
      days.push({
        date,
        items: menu ? menu.dishes.map(toDishView) : [],
      });
    }
    return { days };
  }

  /** Crée ou remplace le menu d'une date (PUT /pages/:id/menus/:date) —
   * [] supprime le menu du jour (D71). */
  async upsertMenu(
    viewer: AuthenticatedUser,
    id: string,
    date: string,
    dto: UpsertMenuDto,
  ): Promise<MenuDayView> {
    const page = await this.loadOwnPage(viewer, id);
    this.assertRestaurant(page);
    if (!DATE_ONLY_PATTERN.test(date)) {
      throw new BadRequestException(
        "La date du menu doit être au format 'YYYY-MM-DD'",
      );
    }
    this.assertMenuDateInWindow(date);

    // Les plats doivent appartenir à la page et être ACTIFS ; les doublons
    // sont refusés (UNIQUE (menu, plat) côté SQL).
    const uniqueIds = new Set(dto.dishIds);
    if (uniqueIds.size !== dto.dishIds.length) {
      throw new BadRequestException(
        'Un même plat ne peut apparaître qu’une fois dans le menu',
      );
    }
    const dishes = await this.pagesRepository.findDishesByIds(dto.dishIds);
    const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
    for (const dishId of dto.dishIds) {
      const dish = dishesById.get(dishId);
      if (!dish || dish.pageId !== id || dish.status !== 'active') {
        throw new BadRequestException(
          `Plat inconnu ou supprimé : ${dishId}`,
        );
      }
    }

    const result = await this.pagesRepository.upsertMenu(id, date, dto.dishIds);
    return {
      date,
      items: result ? result.dishes.map(toDishView) : [],
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Documents « Nos cartes » (D71/D77 — restaurant uniquement)
  // ──────────────────────────────────────────────────────────────────────────

  /** Attache un document (POST /pages/:id/documents) — URL issue de
   * /media/upload-document, 5 documents max par page. */
  async createDocument(
    viewer: AuthenticatedUser,
    id: string,
    dto: CreatePageDocumentDto,
  ): Promise<PageView> {
    const page = await this.loadOwnPage(viewer, id);
    this.assertRestaurant(page);
    this.assertUploadedUrls([dto.url]);
    const documents = await this.pagesRepository.listDocumentsByPageIds([id]);
    if ((documents[id] ?? []).length >= PAGE_DOCUMENTS_MAX) {
      throw new BadRequestException(
        `${PAGE_DOCUMENTS_MAX} documents maximum par page`,
      );
    }
    await this.pagesRepository.createDocument({
      pageId: id,
      label: dto.label,
      url: dto.url,
      fileSizeBytes: dto.fileSizeBytes,
    });
    return this.assembler.assembleOne(
      (await this.pagesRepository.findById(id)) as Page,
      viewer.userId,
    );
  }

  /** Détache un document (DELETE /pages/:id/documents/:documentId) —
   * suppression définitive de la ligne (le fichier uploadé n'est pas purgé,
   * comme les autres uploads orphelins — limite connue). */
  async removeDocument(
    viewer: AuthenticatedUser,
    id: string,
    documentId: string,
  ): Promise<void> {
    await this.loadOwnPage(viewer, id);
    const document = await this.pagesRepository.findDocumentById(documentId);
    if (!document || document.pageId !== id) {
      throw new NotFoundException('Document introuvable');
    }
    await this.pagesRepository.deleteDocument(documentId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Offres (D72)
  // ──────────────────────────────────────────────────────────────────────────

  /** Offres d'une page (GET /pages/:id/offers) — le public voit les offres
   * NON EXPIRÉES ; `all=true` (propriétaire/modération) inclut l'historique. */
  async listOffers(
    viewer: AuthenticatedUser,
    id: string,
    all: boolean,
  ): Promise<PageOffersView> {
    const page = await this.loadVisiblePage(viewer, id);
    if (all) {
      this.assertOwnerOrModerator(page, viewer);
    }
    const now = new Date();
    const offers = await this.pagesRepository.listOffers(id);
    const views = offers.map((offer) => toPageOfferView(offer, now));
    return {
      items: all
        ? views
        : views.filter(
            (offer) =>
              offer.isCurrent ||
              (offer.startsAt !== null &&
                offer.startsAt.getTime() > now.getTime()),
          ),
    };
  }

  /** Crée une offre (POST /pages/:id/offers). */
  async createOffer(
    viewer: AuthenticatedUser,
    id: string,
    dto: CreatePageOfferDto,
  ): Promise<PageOfferView> {
    const page = await this.loadOwnPage(viewer, id);
    const startsAt = dto.startsAt === undefined ? null : new Date(dto.startsAt);
    const endsAt = dto.endsAt === undefined ? null : new Date(dto.endsAt);
    this.assertPeriod(startsAt, endsAt);
    if (dto.imageUrl !== undefined) {
      this.assertUploadedUrls([dto.imageUrl]);
    }
    const offer = await this.pagesRepository.createOffer({
      pageId: page.id,
      title: dto.title,
      description: dto.description ?? '',
      imageUrl: dto.imageUrl ?? null,
      startsAt,
      endsAt,
    });
    return toPageOfferView(offer, new Date());
  }

  /** Modifie une offre (PATCH /pages/:id/offers/:offerId). */
  async updateOffer(
    viewer: AuthenticatedUser,
    id: string,
    offerId: string,
    dto: UpdatePageOfferDto,
  ): Promise<PageOfferView> {
    const page = await this.loadOwnPage(viewer, id);
    const offer = await this.loadOwnOffer(page, offerId);
    const nextStartsAt =
      dto.startsAt !== undefined
        ? dto.startsAt === null
          ? null
          : new Date(dto.startsAt)
        : offer.startsAt;
    const nextEndsAt =
      dto.endsAt !== undefined
        ? dto.endsAt === null
          ? null
          : new Date(dto.endsAt)
        : offer.endsAt;
    this.assertPeriod(nextStartsAt, nextEndsAt);
    if (dto.imageUrl !== undefined && dto.imageUrl !== null) {
      this.assertUploadedUrls([dto.imageUrl]);
    }
    const updated = await this.pagesRepository.updateOffer(offerId, {
      title: dto.title,
      description: dto.description,
      imageUrl: dto.imageUrl,
      startsAt: dto.startsAt === undefined ? undefined : nextStartsAt,
      endsAt: dto.endsAt === undefined ? undefined : nextEndsAt,
    });
    return toPageOfferView(updated, new Date());
  }

  /** Supprime une offre (DELETE /pages/:id/offers/:offerId) — soft. */
  async removeOffer(
    viewer: AuthenticatedUser,
    id: string,
    offerId: string,
  ): Promise<void> {
    const page = await this.loadOwnPage(viewer, id);
    await this.loadOwnOffer(page, offerId);
    await this.pagesRepository.setOfferStatus(offerId, 'deleted');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Événements (D72)
  // ──────────────────────────────────────────────────────────────────────────

  /** Événements d'une page (GET /pages/:id/events) — le public voit les
   * événements À VENIR et EN COURS ; `all=true` (propriétaire/modération)
   * inclut les passés. Tri startsAt croissant (le prochain d'abord). */
  async listEvents(
    viewer: AuthenticatedUser,
    id: string,
    all: boolean,
  ): Promise<PageEventsView> {
    const page = await this.loadVisiblePage(viewer, id);
    if (all) {
      this.assertOwnerOrModerator(page, viewer);
    }
    const now = new Date();
    const events = await this.pagesRepository.listEvents(id);
    const views = events.map((event) => toPageEventView(event, now));
    return {
      items: all ? views : views.filter((event) => event.timing !== 'past'),
    };
  }

  /** Crée un événement (POST /pages/:id/events). */
  async createEvent(
    viewer: AuthenticatedUser,
    id: string,
    dto: CreatePageEventDto,
  ): Promise<PageEventView> {
    const page = await this.loadOwnPage(viewer, id);
    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt === undefined ? null : new Date(dto.endsAt);
    this.assertPeriod(startsAt, endsAt);
    if (dto.imageUrl !== undefined) {
      this.assertUploadedUrls([dto.imageUrl]);
    }
    const event = await this.pagesRepository.createEvent({
      pageId: page.id,
      title: dto.title,
      description: dto.description ?? '',
      imageUrl: dto.imageUrl ?? null,
      startsAt,
      endsAt,
    });
    return toPageEventView(event, new Date());
  }

  /** Modifie un événement (PATCH /pages/:id/events/:eventId). */
  async updateEvent(
    viewer: AuthenticatedUser,
    id: string,
    eventId: string,
    dto: UpdatePageEventDto,
  ): Promise<PageEventView> {
    const page = await this.loadOwnPage(viewer, id);
    const event = await this.loadOwnEvent(page, eventId);
    const nextStartsAt =
      dto.startsAt !== undefined ? new Date(dto.startsAt) : event.startsAt;
    const nextEndsAt =
      dto.endsAt !== undefined
        ? dto.endsAt === null
          ? null
          : new Date(dto.endsAt)
        : event.endsAt;
    this.assertPeriod(nextStartsAt, nextEndsAt);
    if (dto.imageUrl !== undefined && dto.imageUrl !== null) {
      this.assertUploadedUrls([dto.imageUrl]);
    }
    const updated = await this.pagesRepository.updateEvent(eventId, {
      title: dto.title,
      description: dto.description,
      imageUrl: dto.imageUrl,
      startsAt: dto.startsAt === undefined ? undefined : nextStartsAt,
      endsAt: dto.endsAt === undefined ? undefined : nextEndsAt,
    });
    return toPageEventView(updated, new Date());
  }

  /** Supprime un événement (DELETE /pages/:id/events/:eventId) — soft. */
  async removeEvent(
    viewer: AuthenticatedUser,
    id: string,
    eventId: string,
  ): Promise<void> {
    const page = await this.loadOwnPage(viewer, id);
    await this.loadOwnEvent(page, eventId);
    await this.pagesRepository.setEventStatus(eventId, 'deleted');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Abonnements (D74)
  // ──────────────────────────────────────────────────────────────────────────

  /** S'abonner à une page (POST /pages/:id/follow) — idempotent, jamais sa
   * propre page (400). */
  async follow(viewer: AuthenticatedUser, id: string): Promise<void> {
    const page = await this.loadVisiblePage(viewer, id);
    if (page.ownerId === viewer.userId) {
      throw new BadRequestException(
        'Vous ne pouvez pas suivre votre propre page',
      );
    }
    await this.pagesRepository.follow(id, viewer.userId);
  }

  /** Se désabonner (DELETE /pages/:id/follow) — idempotent ; permis même si
   * la page est masquée/supprimée (404 seulement si l'id est inconnu —
   * miroir du unfollow utilisateur). */
  async unfollow(viewer: AuthenticatedUser, id: string): Promise<void> {
    const page = await this.pagesRepository.findById(id);
    if (!page) {
      throw new NotFoundException('Page introuvable');
    }
    await this.pagesRepository.unfollow(id, viewer.userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Publications de la page (D73)
  // ──────────────────────────────────────────────────────────────────────────

  /** Publications de la page (GET /pages/:id/posts) — actives pour tous,
   * active + hidden pour le propriétaire et la modération (miroir des listes
   * de profil). */
  async listPosts(
    viewer: AuthenticatedUser,
    id: string,
    params: PageParams,
  ): Promise<PagedFeedPosts> {
    const page = await this.loadVisiblePage(viewer, id);
    const canSeeHidden =
      page.ownerId === viewer.userId ||
      viewer.role === 'moderator' ||
      viewer.role === 'super_admin';
    const result = await this.postsRepository.listByPagePaged(id, {
      statuses: canSeeHidden ? ['active', 'hidden'] : ['active'],
      limit: params.limit,
      offset: params.offset,
    });
    return {
      items: await this.feedPostAssembler.assemble(result.items, viewer.userId),
      total: result.total,
    };
  }

  /**
   * Publie AU NOM de la page (POST /pages/:id/posts — D73). La publication
   * libre suit les règles du composer ; menu/offre/événement sont
   * AUTO-COMPOSÉS depuis les entités de la page (le post est un INSTANTANÉ :
   * l'édition ultérieure du menu ou de l'offre ne le met pas à jour) :
   * - menu  : menu du jour (heure Réunion) non vide obligatoire, carte
   *   jusqu'à 23 h 00 locales ;
   * - offer : offre active non expirée, carte jusqu'à 23 h 00 locales ;
   * - event : événement non passé, carte de J-3 (mapVisibleFrom) à la fin
   *   effective (endsAt ?? début + 6 h).
   * Pas de notification aux abonnés (anti-flood — le feed et la carte s'en
   * chargent) ; event socket map.updated si le post est visible carte.
   */
  async publish(
    viewer: AuthenticatedUser,
    id: string,
    dto: PublishPagePostDto,
  ): Promise<FeedPost> {
    const page = await this.loadOwnPage(viewer, id);
    if (page.status !== 'active') {
      // Une page masquée ne publie pas : ses contenus sont déjà retirés du
      // flux (D69) — publier serait un contournement.
      throw new BadRequestException(
        'Une page masquée ne peut pas publier',
      );
    }

    const now = new Date();
    let composed: {
      typeSlug: string;
      title: string | null;
      body: string;
      media: CreatePostMediaSpec[];
      mapExpiresAt: Date | null;
      mapVisibleFrom: Date | null;
    };

    if (dto.kind === 'free') {
      if (!dto.body || dto.body.length === 0) {
        throw new BadRequestException(
          'Le texte est obligatoire pour une publication libre',
        );
      }
      const media = dto.media ?? [];
      this.assertUploadedUrls(
        media.flatMap((item) =>
          [item.url, item.thumbnailUrl].filter(
            (value): value is string => value !== undefined,
          ),
        ),
      );
      composed = {
        typeSlug: 'free',
        title: dto.title ?? null,
        body: dto.body,
        media: media.map((item, index) => ({
          mediaType: item.mediaType ?? 'image',
          url: item.url,
          thumbnailUrl: item.thumbnailUrl ?? null,
          width: item.width ?? null,
          height: item.height ?? null,
          position: item.position ?? index,
        })),
        mapExpiresAt: null,
        mapVisibleFrom: null,
      };
    } else if (dto.kind === 'menu') {
      this.assertRestaurant(page);
      const today = reunionDateString(now);
      const menus = await this.pagesRepository.listMenusWithDishes(
        id,
        today,
        today,
      );
      const menu = menus[0];
      if (!menu || menu.dishes.length === 0) {
        throw new BadRequestException(
          "Aucun menu programmé pour aujourd'hui",
        );
      }
      composed = {
        typeSlug: 'menu',
        title: 'Menu du jour',
        body: this.composeMenuBody(page, menu.dishes, dto.body),
        media: [],
        // Visible carte jusqu'à 23 h locales (D73). Publié après 23 h, le
        // post reste feed-only (fenêtre déjà close — comportement assumé).
        mapExpiresAt: reunionEndOfDayAt23(now),
        mapVisibleFrom: null,
      };
    } else if (dto.kind === 'offer') {
      if (!dto.offerId) {
        throw new BadRequestException(
          "offerId est obligatoire pour publier une offre",
        );
      }
      const offer = await this.pagesRepository.findOfferById(dto.offerId);
      if (!offer || offer.pageId !== id || offer.status !== 'active') {
        throw new NotFoundException('Offre introuvable');
      }
      if (offer.endsAt !== null && offer.endsAt.getTime() < now.getTime()) {
        throw new BadRequestException('Cette offre est expirée');
      }
      composed = {
        typeSlug: 'offer',
        title: offer.title,
        body: this.composeWithIntro(offer.description, dto.body),
        media: this.entityImageAsMedia(offer.imageUrl),
        mapExpiresAt: reunionEndOfDayAt23(now),
        mapVisibleFrom: null,
      };
    } else {
      if (!dto.eventId) {
        throw new BadRequestException(
          'eventId est obligatoire pour publier un événement',
        );
      }
      const event = await this.pagesRepository.findEventById(dto.eventId);
      if (!event || event.pageId !== id || event.status !== 'active') {
        throw new NotFoundException('Événement introuvable');
      }
      const effectiveEnd = eventEffectiveEnd(event);
      if (effectiveEnd.getTime() < now.getTime()) {
        throw new BadRequestException('Cet événement est déjà passé');
      }
      composed = {
        typeSlug: 'event',
        title: event.title,
        body: this.composeEventBody(event, dto.body),
        media: this.entityImageAsMedia(event.imageUrl),
        // Carte de J-3 avant le début à la fin effective (D73).
        mapExpiresAt: effectiveEnd,
        mapVisibleFrom: new Date(
          event.startsAt.getTime() - 3 * 24 * 3_600_000,
        ),
      };
    }

    const urlSlug = await this.generateUniquePostSlug(
      composed.title,
      composed.body,
    );
    const post = await this.postsRepository.create({
      authorId: viewer.userId,
      pageId: page.id,
      typeSlug: composed.typeSlug,
      title: composed.title,
      body: composed.body,
      location: page.location,
      city: page.city,
      urlSlug,
      mapExpiresAt: composed.mapExpiresAt,
      mapVisibleFrom: composed.mapVisibleFrom,
      media: composed.media,
    });

    // Rafraîchissement carte (miroir PostsService.create) : seulement si le
    // post est visible carte MAINTENANT (fenêtre ouverte).
    if (
      post.mapExpiresAt !== null &&
      post.mapExpiresAt.getTime() > now.getTime() &&
      (post.mapVisibleFrom === null ||
        post.mapVisibleFrom.getTime() <= now.getTime())
    ) {
      this.realtime.emitMapUpdated('post.created');
    }

    return this.feedPostAssembler.assembleOne(post, viewer.userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides partagées avec les modules moderation / admin
  // ──────────────────────────────────────────────────────────────────────────

  /** Charge une page VISIBLE par l'appelant (miroir des annonces — D69) :
   * 'active' pour tous ; 'hidden' → propriétaire/modération seulement ;
   * 'deleted' → 404 pour tous. Exposé pour le module moderation. */
  async loadVisiblePage(viewer: AuthenticatedUser, id: string): Promise<Page> {
    const page = await this.pagesRepository.findById(id);
    this.assertVisible(page, viewer);
    return page as Page;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** 404 si la page n'existe pas / est supprimée / est masquée pour un tiers
   * (MÊME message : ne pas révéler l'existence d'une page masquée). */
  private assertVisible(
    page: Page | null,
    viewer: AuthenticatedUser,
  ): asserts page is Page {
    if (!page || page.status === 'deleted') {
      throw new NotFoundException('Page introuvable');
    }
    if (
      page.status === 'hidden' &&
      page.ownerId !== viewer.userId &&
      viewer.role !== 'moderator' &&
      viewer.role !== 'super_admin'
    ) {
      throw new NotFoundException('Page introuvable');
    }
  }

  /** Charge une page pour son PROPRIÉTAIRE : 404 si absente/supprimée (ou
   * masquée pour un tiers), 403 si l'appelant n'est pas le propriétaire. */
  private async loadOwnPage(
    viewer: AuthenticatedUser,
    id: string,
  ): Promise<Page> {
    const page = await this.loadVisiblePage(viewer, id);
    if (page.ownerId !== viewer.userId) {
      throw new ForbiddenException(
        'Seul le propriétaire peut gérer cette page',
      );
    }
    return page;
  }

  /** 403 si l'appelant n'est ni propriétaire ni modération (historique des
   * offres/événements, bibliothèque de plats). */
  private assertOwnerOrModerator(page: Page, viewer: AuthenticatedUser): void {
    if (
      page.ownerId !== viewer.userId &&
      viewer.role !== 'moderator' &&
      viewer.role !== 'super_admin'
    ) {
      throw new ForbiddenException(
        'Seul le propriétaire peut consulter cette ressource',
      );
    }
  }

  /** 400 si la page n'est pas un restaurant (menus/plats/cartes — D71). */
  private assertRestaurant(page: Page): void {
    if (page.pageType !== 'restaurant') {
      throw new BadRequestException(
        'Les menus, plats et cartes sont réservés aux pages restaurant',
      );
    }
  }

  /** Charge un plat de la page (404 si absent, d'une autre page ou déjà
   * supprimé). */
  private async loadOwnDish(page: Page, dishId: string): Promise<Dish> {
    const dish = await this.pagesRepository.findDishById(dishId);
    if (!dish || dish.pageId !== page.id || dish.status === 'deleted') {
      throw new NotFoundException('Plat introuvable');
    }
    return dish;
  }

  /** Charge une offre de la page (404 si absente, d'une autre page ou déjà
   * supprimée). */
  private async loadOwnOffer(page: Page, offerId: string): Promise<PageOffer> {
    const offer = await this.pagesRepository.findOfferById(offerId);
    if (!offer || offer.pageId !== page.id || offer.status === 'deleted') {
      throw new NotFoundException('Offre introuvable');
    }
    return offer;
  }

  /** Charge un événement de la page (404 si absent, d'une autre page ou
   * déjà supprimé). */
  private async loadOwnEvent(
    page: Page,
    eventId: string,
  ): Promise<PageEvent> {
    const event = await this.pagesRepository.findEventById(eventId);
    if (!event || event.pageId !== page.id || event.status === 'deleted') {
      throw new NotFoundException('Événement introuvable');
    }
    return event;
  }

  /** 'HH:MM' (validé par le DTO) → minutes depuis minuit. */
  private parseHhMm(hhmm: string): number {
    const [hours, minutes] = hhmm.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /** 400 si aucun des deux prix n'est renseigné (D71). */
  private assertAtLeastOnePrice(
    takeaway: number | null,
    dineIn: number | null,
  ): void {
    if (takeaway === null && dineIn === null) {
      throw new BadRequestException(
        'Au moins un prix est requis : à emporter ou sur place',
      );
    }
  }

  /** 400 si la période est incohérente (startsAt > endsAt). */
  private assertPeriod(startsAt: Date | null, endsAt: Date | null): void {
    if (
      startsAt !== null &&
      endsAt !== null &&
      endsAt.getTime() < startsAt.getTime()
    ) {
      throw new BadRequestException('endsAt doit être postérieure à startsAt');
    }
  }

  /** 400 si la date sort de la fenêtre calendaire admise (± 366 jours). */
  private assertMenuDateInWindow(date: string): void {
    const today = reunionDateString(new Date());
    const min = addDaysToDateString(today, -MENU_DATE_WINDOW_DAYS);
    const max = addDaysToDateString(today, MENU_DATE_WINDOW_DAYS);
    // Comparaison lexicographique des 'YYYY-MM-DD' = comparaison de dates.
    if (date < min || date > max) {
      throw new BadRequestException(
        'La date du menu est hors de la fenêtre admise (± 1 an)',
      );
    }
  }

  /** Commune du référentiel La Réunion (insensible casse/espaces) — 400
   * sinon (miroir des annonces — D54). */
  private resolveCommune(city: string): {
    name: string;
    lat: number;
    lng: number;
  } {
    const commune = findCommuneByName(city);
    if (!commune) {
      throw new BadRequestException(
        `Commune inconnue : « ${city} » — choisissez une commune de La Réunion`,
      );
    }
    return commune;
  }

  /** Attributs normalisés : trim, chaînes vides écartées. */
  private normalizeAttributes(attributes: string[] | undefined): string[] {
    return (attributes ?? [])
      .map((attribute) => attribute.trim())
      .filter((attribute) => attribute.length > 0);
  }

  /** Garde anti-URL-externe (miroir strict de la garde des posts —
   * PostsService.assertUploadedMediaUrls) : chaque URL doit provenir de
   * l'upload Endirek (/media/upload ou /media/upload-document). */
  private assertUploadedUrls(urls: string[]): void {
    if (urls.length === 0) {
      return;
    }
    const { publicUrl } = this.configService.getOrThrow<AppConfig>('app');
    const allowedBase = `${publicUrl.replace(/\/+$/, '')}/uploads/`;
    for (const url of urls) {
      if (!url.startsWith(allowedBase)) {
        throw new BadRequestException(
          "Les médias doivent provenir de l'upload Endirek (/media/upload)",
        );
      }
    }
  }

  /** urlSlug UNIQUE d'une page : slugify(nom) + suffixe aléatoire (miroir
   * des annonces). */
  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'page';
    for (let attempt = 0; attempt < SLUG_MAX_ATTEMPTS; attempt++) {
      const candidate = `${base}-${randomSlugSuffix()}`;
      if (!(await this.pagesRepository.findByUrlSlug(candidate))) {
        return candidate;
      }
    }
    // Dernier recours : double suffixe (collision quasi impossible).
    return `${base}-${randomSlugSuffix()}${randomSlugSuffix()}`;
  }

  /** urlSlug UNIQUE d'un post de page (miroir PostsService). */
  private async generateUniquePostSlug(
    title: string | null,
    body: string,
  ): Promise<string> {
    const base = slugify(title ?? body.slice(0, 60)) || 'publication';
    for (let attempt = 0; attempt < SLUG_MAX_ATTEMPTS; attempt++) {
      const candidate = `${base}-${randomSlugSuffix()}`;
      if (!(await this.postsRepository.findByUrlSlug(candidate))) {
        return candidate;
      }
    }
    return `${base}-${randomSlugSuffix()}${randomSlugSuffix()}`;
  }

  /** Corps auto-composé du post « Menu du jour » (D73) : intro optionnelle
   * puis un plat par ligne avec ses prix (format français, centimes). */
  private composeMenuBody(
    page: Page,
    dishes: Dish[],
    intro: string | undefined,
  ): string {
    const lines = dishes.map((dish) => {
      const prices: string[] = [];
      if (dish.priceTakeawayCents !== null) {
        prices.push(`${formatCents(dish.priceTakeawayCents)} à emporter`);
      }
      if (dish.priceDineInCents !== null) {
        prices.push(`${formatCents(dish.priceDineInCents)} sur place`);
      }
      return `• ${dish.name} — ${prices.join(' / ')}`;
    });
    const header = intro && intro.length > 0
      ? intro
      : `Au menu aujourd'hui chez ${page.name} :`;
    return `${header}\n${lines.join('\n')}`;
  }

  /** Corps auto-composé d'un post d'offre : intro optionnelle + description. */
  private composeWithIntro(
    description: string,
    intro: string | undefined,
  ): string {
    if (intro && intro.length > 0) {
      return description.length > 0 ? `${intro}\n${description}` : intro;
    }
    return description;
  }

  /** Corps auto-composé d'un post d'événement : intro/description + date. */
  private composeEventBody(event: PageEvent, intro: string | undefined): string {
    const base = this.composeWithIntro(event.description, intro);
    const dateLine = `📅 ${formatReunionDateTime(event.startsAt)}`;
    return base.length > 0 ? `${base}\n${dateLine}` : dateLine;
  }

  /** Image d'une offre/d'un événement → média unique du post composé
   * (dimensions inconnues : null). */
  private entityImageAsMedia(imageUrl: string | null): CreatePostMediaSpec[] {
    if (imageUrl === null) {
      return [];
    }
    return [
      {
        mediaType: 'image',
        url: imageUrl,
        thumbnailUrl: null,
        width: null,
        height: null,
        position: 0,
      },
    ];
  }
}

/** Centimes → montant français lisible : 1250 → '12,50 €' ; 700 → '7 €'. */
function formatCents(cents: number): string {
  const euros = Math.floor(cents / 100);
  const remainder = cents % 100;
  if (remainder === 0) {
    return `${euros} €`;
  }
  return `${euros},${String(remainder).padStart(2, '0')} €`;
}

/** Instant → date/heure locale Réunion lisible : 'le 16/07/2026 à 19 h'. */
function formatReunionDateTime(instant: Date): string {
  const shifted = new Date(instant.getTime() + 4 * 3_600_000);
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const year = shifted.getUTCFullYear();
  const hours = shifted.getUTCHours();
  const minutes = shifted.getUTCMinutes();
  const time =
    minutes === 0
      ? `${hours} h`
      : `${hours} h ${String(minutes).padStart(2, '0')}`;
  return `le ${day}/${month}/${year} à ${time}`;
}

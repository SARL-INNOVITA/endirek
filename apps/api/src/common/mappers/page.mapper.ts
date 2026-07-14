import {
  Dish,
  GeoPoint,
  Page,
  PageDocument,
  PageEvent,
  PageHour,
  PageOffer,
  PageStatus,
  PageType,
} from '../../database/domain/entities';
import { toReunionParts } from '../time/reunion-time';
import { PostAuthor } from './post.mapper';

/**
 * Projections « page professionnelle » du contrat d'API (Lot 3 — D69-D76) —
 * mutualisées entre les modules pages, conversations, map et admin. Source
 * unique des formes PAGE / PAGE_CARD / DISH / MENU_DAY / OFFER / EVENT :
 * aucun module ne reconstruit ces objets à la main.
 *
 * L'assemblage PAR LOT (abonnés, horaires, documents d'une liste de pages)
 * est fait par PageAssembler (modules/pages/page.assembler.ts) au-dessus de
 * ces projections pures.
 */

/** Statut d'ouverture DÉRIVÉ d'une page (D70) — jamais stocké : congés
 * prioritaires, sinon plages horaires du jour local Réunion. */
export interface PageOpenStatus {
  state: 'open' | 'closed' | 'vacation';
  /** Fin des congés — non nul seulement quand state = 'vacation'. */
  vacationUntil: Date | null;
  /** Message de congés optionnel du propriétaire. */
  vacationMessage: string | null;
}

/** Plage horaire du contrat — heures locales Réunion 'HH:MM'. */
export interface PageHourView {
  /** 0 = lundi ... 6 = dimanche. */
  weekday: number;
  opensAt: string;
  closesAt: string;
}

/** Document « Nos cartes » du contrat (D71). */
export interface PageDocumentView {
  id: string;
  label: string;
  url: string;
  fileSizeBytes: number;
  position: number;
  createdAt: Date;
}

/** Forme PAGE_CARD du contrat — listes (« Mes pages », profil, admin). */
export interface PageCardView {
  id: string;
  pageType: PageType;
  name: string;
  urlSlug: string;
  avatarUrl: string | null;
  city: string;
  verified: boolean;
  /** Abonnés au compte actif — calculé à la lecture (D74). */
  followersCount: number;
  openStatus: PageOpenStatus;
  createdAt: Date;
}

/** PAGE_CARD du propriétaire : + statut (miroir D61 — le propriétaire
 * distingue ses pages masquées par la modération). */
export interface OwnerPageCard extends PageCardView {
  status: PageStatus;
}

/** Forme PAGE du contrat — détail complet (écran de page mobile). */
export interface PageView extends PageCardView {
  coverUrl: string | null;
  bio: string;
  phone: string | null;
  attributes: string[];
  location: GeoPoint | null;
  /** Plages triées weekday puis heure d'ouverture. */
  hours: PageHourView[];
  /** Documents « Nos cartes » triés par position (restaurant — D71). */
  documents: PageDocumentView[];
  owner: PostAuthor;
  /** Publications 'active' de la page — calculé à la lecture. */
  postsCount: number;
  status: PageStatus;
  /** Le viewer est-il le propriétaire (affiche « Gérer la page ») ? */
  isOwner: boolean;
  /** Le viewer suit-il la page (état du bouton « Suivre ») ? */
  myFollow: boolean;
  updatedAt: Date;
}

/** Forme PLAT du contrat (D71) — prix en CENTIMES (12,50 € = 1250). */
export interface DishView {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  priceTakeawayCents: number | null;
  priceDineInCents: number | null;
  position: number;
}

/** Forme MENU_DAY du contrat (D71) — un jour du sélecteur de la semaine.
 * `items` vide = pas de menu programmé ce jour-là. */
export interface MenuDayView {
  /** Date calendaire locale Réunion 'YYYY-MM-DD'. */
  date: string;
  items: DishView[];
}

/** Forme OFFRE du contrat (D72). */
export interface PageOfferView {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  /** En cours à l'instant de la lecture (période absente = toujours). */
  isCurrent: boolean;
  createdAt: Date;
}

/** Position temporelle d'un événement à l'instant de la lecture (D72). */
export type PageEventTiming = 'upcoming' | 'ongoing' | 'past';

/** Forme ÉVÉNEMENT du contrat (D72). */
export interface PageEventView {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  startsAt: Date;
  endsAt: Date | null;
  timing: PageEventTiming;
  createdAt: Date;
}

/** Durée effective par défaut d'un événement sans endsAt, en heures (D72). */
export const EVENT_DEFAULT_DURATION_HOURS = 6;

/** Fin EFFECTIVE d'un événement : endsAt, sinon startsAt + 6 h (D72) —
 * partagée entre le timing dérivé et l'expiration carte du post (D73). */
export function eventEffectiveEnd(event: PageEvent): Date {
  return (
    event.endsAt ??
    new Date(
      event.startsAt.getTime() + EVENT_DEFAULT_DURATION_HOURS * 3_600_000,
    )
  );
}

/** Minutes depuis minuit → 'HH:MM' (affichage des plages horaires). */
export function minutesToHhMm(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Statut d'ouverture DÉRIVÉ (D70) — les congés priment tant que la date de
 * fin n'est pas passée, sinon 'open' si une plage du jour local Réunion
 * couvre l'heure locale, sinon 'closed'. Calcul PARTAGÉ entre les deux
 * drivers (le service assemble, jamais le repository) : parité garantie.
 */
export function computeOpenStatus(
  page: Pick<Page, 'vacationUntil' | 'vacationMessage'>,
  hours: PageHour[],
  now: Date,
): PageOpenStatus {
  if (page.vacationUntil !== null && page.vacationUntil.getTime() > now.getTime()) {
    return {
      state: 'vacation',
      vacationUntil: page.vacationUntil,
      vacationMessage: page.vacationMessage,
    };
  }
  const parts = toReunionParts(now);
  const open = hours.some(
    (hour) =>
      hour.weekday === parts.weekday &&
      hour.opensMinute <= parts.minutesOfDay &&
      parts.minutesOfDay < hour.closesMinute,
  );
  return {
    state: open ? 'open' : 'closed',
    vacationUntil: null,
    vacationMessage: null,
  };
}

/** Projette une plage horaire vers la forme du contrat. */
export function toPageHourView(hour: PageHour): PageHourView {
  return {
    weekday: hour.weekday,
    opensAt: minutesToHhMm(hour.opensMinute),
    closesAt: minutesToHhMm(hour.closesMinute),
  };
}

/** Projette un document « Nos cartes » vers la forme du contrat. */
export function toPageDocumentView(document: PageDocument): PageDocumentView {
  return {
    id: document.id,
    label: document.label,
    url: document.url,
    fileSizeBytes: document.fileSizeBytes,
    position: document.position,
    createdAt: document.createdAt,
  };
}

/** Données contextuelles d'une PAGE_CARD (calculées par lot par l'assembler). */
export interface PageCardContext {
  followersCount: number;
  openStatus: PageOpenStatus;
}

/** Projette une page + son contexte vers la forme PAGE_CARD. */
export function toPageCardView(page: Page, context: PageCardContext): PageCardView {
  return {
    id: page.id,
    pageType: page.pageType,
    name: page.name,
    urlSlug: page.urlSlug,
    avatarUrl: page.avatarUrl,
    city: page.city,
    verified: page.verified,
    followersCount: context.followersCount,
    openStatus: context.openStatus,
    createdAt: page.createdAt,
  };
}

/** Données contextuelles d'une PAGE complète. */
export interface PageViewContext extends PageCardContext {
  hours: PageHourView[];
  documents: PageDocumentView[];
  owner: PostAuthor;
  postsCount: number;
  isOwner: boolean;
  myFollow: boolean;
}

/** Projette une page + son contexte vers la forme PAGE (détail). */
export function toPageView(page: Page, context: PageViewContext): PageView {
  return {
    ...toPageCardView(page, context),
    coverUrl: page.coverUrl,
    bio: page.bio,
    phone: page.phone,
    attributes: [...page.attributes],
    location: page.location,
    hours: context.hours,
    documents: context.documents,
    owner: context.owner,
    postsCount: context.postsCount,
    status: page.status,
    isOwner: context.isOwner,
    myFollow: context.myFollow,
    updatedAt: page.updatedAt,
  };
}

/** Projette un plat vers la forme DISH du contrat. */
export function toDishView(dish: Dish): DishView {
  return {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    imageUrl: dish.imageUrl,
    priceTakeawayCents: dish.priceTakeawayCents,
    priceDineInCents: dish.priceDineInCents,
    position: dish.position,
  };
}

/** Projette une offre vers la forme OFFRE — isCurrent dérivé de `now`. */
export function toPageOfferView(offer: PageOffer, now: Date): PageOfferView {
  const started =
    offer.startsAt === null || offer.startsAt.getTime() <= now.getTime();
  const notEnded =
    offer.endsAt === null || offer.endsAt.getTime() >= now.getTime();
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    imageUrl: offer.imageUrl,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    isCurrent: started && notEnded,
    createdAt: offer.createdAt,
  };
}

/** Projette un événement vers la forme ÉVÉNEMENT — timing dérivé de `now`. */
export function toPageEventView(event: PageEvent, now: Date): PageEventView {
  let timing: PageEventTiming;
  if (event.startsAt.getTime() > now.getTime()) {
    timing = 'upcoming';
  } else if (eventEffectiveEnd(event).getTime() >= now.getTime()) {
    timing = 'ongoing';
  } else {
    timing = 'past';
  }
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    imageUrl: event.imageUrl,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timing,
    createdAt: event.createdAt,
  };
}

/**
 * Seed Lot 3 — pages restaurants & entreprises de démonstration.
 *
 * 2 pages pensées pour la démo (D69-D76) :
 *
 * 1. « Bon Goût » — page RESTAURANT du mockup 08, propriété de David Payet
 *    (n°13), Saint-Denis, VÉRIFIÉE. Horaires midi mardi→dimanche + soirs
 *    vendredi/samedi (lundi fermé), 6 plats prédéfinis, menus programmés sur
 *    la semaine GLISSANTE (aujourd'hui → J+6, sauf lundi), 2 documents
 *    « Nos cartes » (PDF de démo, comme les images picsum), 1 offre en
 *    cours, 1 événement à venir, 3 abonnés, 3 publications de page (menu du
 *    jour, offre, événement — visibles carte).
 * 2. « Ti Kaz Services » — page ENTREPRISE, propriété d'Émilie Técher (n°6),
 *    Saint-Benoît, non vérifiée. Horaires de bureau, pas de plats/menus/
 *    cartes (réservés aux restaurants — D71), 1 offre sans période,
 *    1 événement PASSÉ (démo de l'historique propriétaire), 2 abonnés,
 *    1 publication libre. C'est la cible du signalement de page du seed
 *    (interactions.seed.ts — D76).
 *
 * Les menus sont datés RELATIVEMENT au boot (semaine glissante — mêmes
 * garanties que minutesAgo) ; les fenêtres carte des publications de page
 * sont elles aussi RELATIVES (expiration dans quelques heures) pour que le
 * log de boot reste déterministe quel que soit l'instant de démarrage — à
 * l'exécution, le service pose les vraies fenêtres D73 (23 h Réunion, J-3).
 *
 * Reconstruits À CHAQUE appel (dates relatives recalculées, objets neufs).
 */

import {
  Dish,
  Page,
  PageDocument,
  PageEvent,
  PageFollow,
  PageHour,
  PageMenu,
  PageMenuItem,
  PageOffer,
  PostMedia,
} from '../domain/entities';
import {
  addDaysToDateString,
  reunionDateString,
  toReunionParts,
} from '../../common/time/reunion-time';
import { SeedPost } from './index';
import { communeByName } from './communes';
import { daysAgo, minutesAgo, pointNear, seedUuid } from './seed-utils';

// ────────────────────────────────────────────────────────────────────────────
// Pages
// ────────────────────────────────────────────────────────────────────────────

/** URL d'un PDF de démonstration public et stable (équivalent « picsum »
 * pour les documents) — remplacé par de vrais uploads /media/upload-document
 * dès qu'un restaurateur ajoute ses cartes. */
const DEMO_PDF_URL =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

/** Les 2 pages de démonstration — reconstruites à chaque appel. */
export function buildSeedPages(): Page[] {
  const bonGoutCreatedAt = daysAgo(35);
  const tiKazCreatedAt = daysAgo(18);
  return [
    {
      id: seedUuid('page', 1),
      ownerId: seedUuid('user', 13), // David Payet
      pageType: 'restaurant',
      name: 'Bon Goût',
      urlSlug: 'bon-gout-saint-denis-pg1',
      bio:
        'Cuisine créole maison, produits frais et locaux. Sur place ou à '
        + 'emporter à Saint-Denis.',
      avatarUrl: 'https://picsum.photos/seed/endirek-page-bongout-avatar/400/400',
      coverUrl: 'https://picsum.photos/seed/endirek-page-bongout-cover/1200/500',
      city: 'Saint-Denis',
      location: pointNear(communeByName('Saint-Denis'), 400, 2001),
      phone: '0262 20 41 74',
      attributes: ['Créole', 'Sur place', 'À emporter'],
      vacationUntil: null,
      vacationMessage: null,
      verified: true, // badge ✓ du mockup — accordé au backoffice (D69)
      status: 'active',
      createdAt: bonGoutCreatedAt,
      updatedAt: bonGoutCreatedAt,
      deletedAt: null,
    },
    {
      id: seedUuid('page', 2),
      ownerId: seedUuid('user', 6), // Émilie Técher
      pageType: 'business',
      name: 'Ti Kaz Services',
      urlSlug: 'ti-kaz-services-saint-benoit-pg2',
      bio:
        'Petits travaux, entretien de jardin et aide administrative sur '
        + 'tout l’Est. Devis gratuit, travail soigné.',
      avatarUrl: 'https://picsum.photos/seed/endirek-page-tikaz-avatar/400/400',
      coverUrl: 'https://picsum.photos/seed/endirek-page-tikaz-cover/1200/500',
      city: 'Saint-Benoît',
      location: pointNear(communeByName('Saint-Benoît'), 400, 2002),
      phone: '0692 55 12 30',
      attributes: ['Multiservices', 'Sur devis'],
      vacationUntil: null,
      vacationMessage: null,
      verified: false,
      status: 'active',
      createdAt: tiKazCreatedAt,
      updatedAt: tiKazCreatedAt,
      deletedAt: null,
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Horaires (D70) — weekday 0 = lundi ... 6 = dimanche, minutes locales.
// ────────────────────────────────────────────────────────────────────────────

/** Spécification déclarative d'une plage horaire seed. */
interface HourSpec {
  pageN: number;
  weekday: number;
  /** 'HH:MM' locales Réunion. */
  opens: string;
  closes: string;
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

const HOUR_SPECS: HourSpec[] = [
  // Bon Goût : service du midi du mardi (1) au dimanche (6) — lundi fermé.
  { pageN: 1, weekday: 1, opens: '11:30', closes: '14:30' },
  { pageN: 1, weekday: 2, opens: '11:30', closes: '14:30' },
  { pageN: 1, weekday: 3, opens: '11:30', closes: '14:30' },
  { pageN: 1, weekday: 4, opens: '11:30', closes: '14:30' },
  { pageN: 1, weekday: 5, opens: '11:30', closes: '14:30' },
  { pageN: 1, weekday: 6, opens: '11:30', closes: '14:30' },
  // ... et service du soir vendredi (4) et samedi (5).
  { pageN: 1, weekday: 4, opens: '18:30', closes: '21:30' },
  { pageN: 1, weekday: 5, opens: '18:30', closes: '21:30' },
  // Ti Kaz Services : horaires de bureau, lundi (0) → vendredi (4).
  { pageN: 2, weekday: 0, opens: '08:00', closes: '12:00' },
  { pageN: 2, weekday: 0, opens: '13:30', closes: '17:00' },
  { pageN: 2, weekday: 1, opens: '08:00', closes: '12:00' },
  { pageN: 2, weekday: 1, opens: '13:30', closes: '17:00' },
  { pageN: 2, weekday: 2, opens: '08:00', closes: '12:00' },
  { pageN: 2, weekday: 2, opens: '13:30', closes: '17:00' },
  { pageN: 2, weekday: 3, opens: '08:00', closes: '12:00' },
  { pageN: 2, weekday: 3, opens: '13:30', closes: '17:00' },
  { pageN: 2, weekday: 4, opens: '08:00', closes: '12:00' },
  { pageN: 2, weekday: 4, opens: '13:30', closes: '17:00' },
];

/** Les plages horaires de démonstration — reconstruites à chaque appel. */
export function buildSeedPageHours(): PageHour[] {
  return HOUR_SPECS.map((spec, index) => {
    const opensMinute = toMinutes(spec.opens);
    const closesMinute = toMinutes(spec.closes);
    if (opensMinute >= closesMinute) {
      throw new Error(
        `Seed pages : plage horaire invalide (${spec.opens} >= ${spec.closes}).`,
      );
    }
    return {
      id: seedUuid('page-hour', index + 1),
      pageId: seedUuid('page', spec.pageN),
      weekday: spec.weekday,
      opensMinute,
      closesMinute,
      position: index,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Documents « Nos cartes » (D71) — restaurant uniquement.
// ────────────────────────────────────────────────────────────────────────────

/** Les 2 documents de démonstration (mockup 08) — reconstruits à chaque appel. */
export function buildSeedPageDocuments(): PageDocument[] {
  return [
    {
      id: seedUuid('page-doc', 1),
      pageId: seedUuid('page', 1),
      label: 'Carte principale',
      url: DEMO_PDF_URL,
      fileSizeBytes: 13_264,
      position: 0,
      createdAt: daysAgo(30),
    },
    {
      id: seedUuid('page-doc', 2),
      pageId: seedUuid('page', 1),
      label: 'Carte boissons',
      url: DEMO_PDF_URL,
      fileSizeBytes: 8_742,
      position: 1,
      createdAt: daysAgo(30),
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Plats (D71) — prix en CENTIMES (à emporter / sur place, mockup 08).
// ────────────────────────────────────────────────────────────────────────────

/** Spécification déclarative d'un plat seed. */
interface DishSpec {
  n: number;
  name: string;
  description: string;
  imageSlug: string;
  takeawayCents: number | null;
  dineInCents: number | null;
}

const DISH_SPECS: DishSpec[] = [
  {
    n: 1,
    name: 'Rougail saucisses',
    description: 'Rougail saucisses, riz, grains, sauce piment maison.',
    imageSlug: 'endirek-dish-rougail-saucisses',
    takeawayCents: 700,
    dineInCents: 1200,
  },
  {
    n: 2,
    name: 'Cari poulet',
    description: 'Cari poulet, riz, rougail concombre.',
    imageSlug: 'endirek-dish-cari-poulet',
    takeawayCents: 750,
    dineInCents: 1250,
  },
  {
    n: 3,
    name: 'Bowl végétarien',
    description: 'Légumes rôtis, riz, pois chiches, sauce tahini.',
    imageSlug: 'endirek-dish-bowl-vegetarien',
    takeawayCents: 700,
    dineInCents: 1150,
  },
  {
    n: 4,
    name: 'Gratin de chouchou',
    description: 'Gratin de chouchou de Salazie, salade verte.',
    imageSlug: 'endirek-dish-gratin-chouchou',
    takeawayCents: 650,
    dineInCents: 1100,
  },
  {
    n: 5,
    name: 'Américain péi',
    description: 'Sandwich américain, frites maison, sauce au choix.',
    imageSlug: 'endirek-dish-americain',
    takeawayCents: 600,
    dineInCents: null, // à emporter uniquement
  },
  {
    n: 6,
    name: 'Salade de palmiste',
    description: 'Palmiste frais, vinaigrette combava — sur place uniquement.',
    imageSlug: 'endirek-dish-salade-palmiste',
    takeawayCents: null,
    dineInCents: 950,
  },
];

/** Les 6 plats de démonstration (page Bon Goût) — reconstruits à chaque appel. */
export function buildSeedDishes(): Dish[] {
  return DISH_SPECS.map((spec, index) => {
    const createdAt = daysAgo(32);
    return {
      id: seedUuid('dish', spec.n),
      pageId: seedUuid('page', 1),
      name: spec.name,
      description: spec.description,
      imageUrl: `https://picsum.photos/seed/${spec.imageSlug}/600/400`,
      priceTakeawayCents: spec.takeawayCents,
      priceDineInCents: spec.dineInCents,
      position: index,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Menus programmés (D71) — semaine GLISSANTE : aujourd'hui → J+6 (heure
// Réunion), sauf le lundi (jour de fermeture de Bon Goût). Toute fenêtre de
// 7 jours contient exactement un lundi → toujours 6 menus au boot.
// ────────────────────────────────────────────────────────────────────────────

/** Rotation des plats du jour (indices de DISH_SPECS, 3 plats par jour). */
const MENU_ROTATIONS: number[][] = [
  [1, 2, 3],
  [2, 4, 6],
  [1, 3, 5],
  [2, 3, 4],
  [1, 4, 6],
  [3, 5, 2],
  [1, 2, 6],
];

/** Menus de la semaine glissante avec leurs jours (interne, déterministe à
 * date de boot fixée). */
function menuDays(): Array<{ n: number; date: string; dishNs: number[] }> {
  const today = reunionDateString(new Date());
  const days: Array<{ n: number; date: string; dishNs: number[] }> = [];
  let n = 1;
  for (let offset = 0; offset <= 6; offset++) {
    const date = addDaysToDateString(today, offset);
    // weekday local du jour ciblé — le lundi (0) est fermé, pas de menu.
    const weekday = toReunionParts(
      new Date(new Date().getTime() + offset * 24 * 60 * 60_000),
    ).weekday;
    if (weekday === 0) {
      continue;
    }
    days.push({ n, date, dishNs: MENU_ROTATIONS[offset % MENU_ROTATIONS.length] });
    n++;
  }
  return days;
}

/** Les 6 menus programmés de la semaine glissante — reconstruits à chaque
 * appel (dates recalculées : la démo a TOUJOURS un menu aujourd'hui, sauf
 * le lundi). */
export function buildSeedPageMenus(): PageMenu[] {
  return menuDays().map((day) => {
    const createdAt = daysAgo(2);
    return {
      id: seedUuid('page-menu', day.n),
      pageId: seedUuid('page', 1),
      menuDate: day.date,
      createdAt,
      updatedAt: createdAt,
    };
  });
}

/** Les items ordonnés des menus programmés — reconstruits à chaque appel. */
export function buildSeedPageMenuItems(): PageMenuItem[] {
  const items: PageMenuItem[] = [];
  let itemN = 1;
  for (const day of menuDays()) {
    day.dishNs.forEach((dishN, position) => {
      items.push({
        id: seedUuid('page-menu-item', itemN++),
        menuId: seedUuid('page-menu', day.n),
        dishId: seedUuid('dish', dishN),
        position,
      });
    });
  }
  return items;
}

// ────────────────────────────────────────────────────────────────────────────
// Offres & événements (D72)
// ────────────────────────────────────────────────────────────────────────────

/** Les 2 offres de démonstration — reconstruites à chaque appel. */
export function buildSeedPageOffers(): PageOffer[] {
  return [
    {
      id: seedUuid('page-offer', 1),
      pageId: seedUuid('page', 1),
      title: 'Offre du midi −10 %',
      description:
        'Moins 10 % sur tous les plats de 11 h à 14 h, du mardi au '
        + 'vendredi. Valable sur place et à emporter.',
      imageUrl: 'https://picsum.photos/seed/endirek-offer-midi-bongout/800/450',
      startsAt: daysAgo(2),
      endsAt: minutesAgo(-7200), // se termine dans 5 jours
      status: 'active',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      id: seedUuid('page-offer', 2),
      pageId: seedUuid('page', 2),
      title: 'Diagnostic habitat offert',
      description:
        'Visite et diagnostic gratuits pour tout entretien de jardin ou '
        + 'petits travaux réservés avant la fin du mois.',
      imageUrl: null,
      startsAt: null,
      endsAt: null, // offre permanente (période optionnelle — D72)
      status: 'active',
      createdAt: daysAgo(6),
      updatedAt: daysAgo(6),
    },
  ];
}

/** Les 2 événements de démonstration — reconstruits à chaque appel. */
export function buildSeedPageEvents(): PageEvent[] {
  return [
    {
      id: seedUuid('page-event', 1),
      pageId: seedUuid('page', 1),
      title: 'Soirée musique live',
      description:
        'Concert de TeNöe & Friends dès 19 h — maloya et séga en terrasse. '
        + 'Entrée libre, carte du soir disponible.',
      imageUrl: 'https://picsum.photos/seed/endirek-event-musique-bongout/800/450',
      startsAt: minutesAgo(-2880), // dans 2 jours
      endsAt: minutesAgo(-3120), // dans 2 jours + 4 h
      status: 'active',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: seedUuid('page-event', 2),
      pageId: seedUuid('page', 2),
      title: 'Portes ouvertes de l’atelier',
      description:
        'Venez découvrir l’atelier et rencontrer l’équipe autour d’un café '
        + '— démonstrations et conseils entretien toute la matinée.',
      imageUrl: null,
      startsAt: daysAgo(10), // événement PASSÉ (démo historique propriétaire)
      endsAt: minutesAgo(14_220), // 3 h après le début
      status: 'active',
      createdAt: daysAgo(15),
      updatedAt: daysAgo(15),
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Abonnés (D74)
// ────────────────────────────────────────────────────────────────────────────

/** [pageN, userN, ageDays] — abonnements de démonstration. */
const PAGE_FOLLOW_SPECS: Array<[number, number, number]> = [
  [1, 4, 20], // Valérie suit Bon Goût
  [1, 11, 12], // Kévin suit Bon Goût
  [1, 14, 5], // Chloé suit Bon Goût
  [2, 3, 10], // Jean-Yves suit Ti Kaz Services
  [2, 8, 7], // Nadia suit Ti Kaz Services
];

/** Les 5 abonnements de page — reconstruits à chaque appel. */
export function buildSeedPageFollows(): PageFollow[] {
  const seen = new Set<string>();
  return PAGE_FOLLOW_SPECS.map(([pageN, userN, ageDays]) => {
    const key = `${pageN}|${userN}`;
    if (seen.has(key)) {
      throw new Error(
        `Seed pages : abonnement en doublon (page n°${pageN} ← user n°${userN}).`,
      );
    }
    seen.add(key);
    return {
      pageId: seedUuid('page', pageN),
      userId: seedUuid('user', userN),
      createdAt: daysAgo(ageDays),
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Publications de page (D73) — posts n°43-46, au nom des pages.
// Fenêtres carte RELATIVES (log de boot déterministe) : à l'exécution, le
// service pose les vraies fenêtres (23 h Réunion pour menu/offer, J-3 →
// fin pour event).
// ────────────────────────────────────────────────────────────────────────────

/** Les 4 publications de page — reconstruites à chaque appel. */
export function buildSeedPagePosts(): SeedPost[] {
  const bonGoutLocation = pointNear(communeByName('Saint-Denis'), 400, 2001);
  const menuCreatedAt = minutesAgo(180);
  const offerCreatedAt = minutesAgo(300);
  const eventCreatedAt = minutesAgo(1440);
  const freeCreatedAt = minutesAgo(2000);
  return [
    {
      id: seedUuid('post', 43),
      authorId: seedUuid('user', 13),
      pageId: seedUuid('page', 1),
      typeSlug: 'menu',
      title: 'Menu du jour',
      body:
        'Au menu aujourd’hui chez Bon Goût :\n'
        + '• Rougail saucisses — 7,00 € à emporter / 12,00 € sur place\n'
        + '• Cari poulet — 7,50 € / 12,50 €\n'
        + '• Bowl végétarien — 7,00 € / 11,50 €\n'
        + 'Service jusqu’à 14 h 30, pensez à commander pour l’emporté !',
      location: bonGoutLocation,
      city: 'Saint-Denis',
      visibility: 'public',
      status: 'active',
      urlSlug: 'menu-du-jour-bon-gout-pg43',
      mapExpiresAt: minutesAgo(-240), // expire dans 4 h (relatif — démo)
      mapVisibleFrom: null,
      createdAt: menuCreatedAt,
      updatedAt: menuCreatedAt,
    },
    {
      id: seedUuid('post', 44),
      authorId: seedUuid('user', 13),
      pageId: seedUuid('page', 1),
      typeSlug: 'offer',
      title: 'Offre du midi −10 %',
      body:
        'Moins 10 % sur tous les plats de 11 h à 14 h, du mardi au '
        + 'vendredi. Valable sur place et à emporter — venez goûter !',
      location: bonGoutLocation,
      city: 'Saint-Denis',
      visibility: 'public',
      status: 'active',
      urlSlug: 'offre-du-midi-bon-gout-pg44',
      mapExpiresAt: minutesAgo(-180), // expire dans 3 h (relatif — démo)
      mapVisibleFrom: null,
      createdAt: offerCreatedAt,
      updatedAt: offerCreatedAt,
    },
    {
      id: seedUuid('post', 45),
      authorId: seedUuid('user', 13),
      pageId: seedUuid('page', 1),
      typeSlug: 'event',
      title: 'Soirée musique live',
      body:
        'Concert de TeNöe & Friends dès 19 h — maloya et séga en terrasse. '
        + 'Entrée libre, carte du soir disponible. Vini bat un karé !',
      location: bonGoutLocation,
      city: 'Saint-Denis',
      visibility: 'public',
      status: 'active',
      urlSlug: 'soiree-musique-live-bon-gout-pg45',
      // Fenêtre d'événement (D73) : déjà visible (J-3 passé), expire à la
      // fin de l'événement (dans 2 jours + 4 h).
      mapExpiresAt: minutesAgo(-3120),
      mapVisibleFrom: minutesAgo(1500),
      createdAt: eventCreatedAt,
      updatedAt: eventCreatedAt,
    },
    {
      id: seedUuid('post', 46),
      authorId: seedUuid('user', 6),
      pageId: seedUuid('page', 2),
      typeSlug: 'free',
      title: null,
      body:
        'Ti Kaz Services agrandit son équipe ! Un deuxième jardinier nous '
        + 'rejoint en août — les créneaux du samedi rouvrent à la '
        + 'réservation. Mèrsi pou zot confiance 🌱',
      location: null, // publication libre : feed uniquement (D8)
      city: 'Saint-Benoît',
      visibility: 'public',
      status: 'active',
      urlSlug: 'ti-kaz-services-equipe-pg46',
      mapExpiresAt: null,
      mapVisibleFrom: null,
      createdAt: freeCreatedAt,
      updatedAt: freeCreatedAt,
    },
  ];
}

/** Les 2 médias des publications de page (offre + événement) — numérotés à
 * partir de 101 pour ne jamais collisionner avec les médias de posts.seed.ts
 * (préfixe seedUuid partagé « media »). */
export function buildSeedPagePostMedia(): PostMedia[] {
  return [
    {
      id: seedUuid('media', 101),
      postId: seedUuid('post', 44),
      mediaType: 'image',
      url: 'https://picsum.photos/seed/endirek-offer-midi-bongout/800/450',
      thumbnailUrl:
        'https://picsum.photos/seed/endirek-offer-midi-bongout/400/225',
      width: 800,
      height: 450,
      position: 1,
      createdAt: minutesAgo(300),
    },
    {
      id: seedUuid('media', 102),
      postId: seedUuid('post', 45),
      mediaType: 'image',
      url: 'https://picsum.photos/seed/endirek-event-musique-bongout/800/450',
      thumbnailUrl:
        'https://picsum.photos/seed/endirek-event-musique-bongout/400/225',
      width: 800,
      height: 450,
      position: 1,
      createdAt: minutesAgo(1440),
    },
  ];
}

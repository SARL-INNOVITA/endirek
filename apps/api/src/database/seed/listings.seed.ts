/**
 * Seed annonces Dealplace (Lot 2 — CP2.1) — 8 annonces réalistes La Réunion.
 *
 * Mix biens/services, plusieurs communes, valeurs FIXES et FOURCHETTES,
 * quelques annonces illustrées (medias picsum), tags variés, exchange_prefs
 * variés, catégories/sous-catégories RÉELLES de la taxonomie (0004 / mock
 * dealplace-reference). Les propriétaires référencent des utilisateurs du seed
 * existant (users.seed). Ids DÉTERMINISTES via seedUuid.
 *
 * RÈGLE PHOTO : chaque annonce de type 'good' (bien) porte AU MOINS 1 média
 * (miroir de la règle métier « photo obligatoire pour un bien »). Les services
 * peuvent ne pas avoir de photo.
 *
 * Reconstruit à chaque appel (dates relatives recalculées, objets neufs).
 */

import {
  ExchangePref,
  Listing,
  ListingExternalLink,
  ListingFamily,
  ListingMedia,
  ListingValueKind,
} from '../domain/entities';
import { SeedListingTagMap } from './index';
import { communeByName } from './communes';
import { minutesAgo, pointNear, seedUuid } from './seed-utils';

/** Spécification déclarative d'une annonce seed (le reste est dérivé). */
interface ListingSpec {
  n: number;
  /** Numéro d'utilisateur seed propriétaire (users.seed : 1..15). */
  ownerN: number;
  listingType: ListingFamily;
  title: string;
  description: string;
  categorySlug: string;
  subcategorySlug: string;
  valueKind: ListingValueKind;
  valueMin: number;
  /** Requis si valueKind='range', ignoré (null) si 'fixed'. */
  valueMax?: number;
  /** Commune (référentiel communes) — city stocké, location = centre + jitter. */
  commune: string;
  exchangePrefs: ExchangePref[];
  tagSlugs: string[];
  /** Slug public unique et lisible. */
  slug: string;
  /** Ancienneté en minutes (createdAt = minutesAgo(n)). */
  ageMinutes: number;
  /** Nombre d'images (biens : >= 1 obligatoire). Défaut 0. */
  mediaCount?: number;
  /** Base du slug picsum pour les médias. */
  mediaSlugBase?: string;
  externalLinks?: ListingExternalLink[];
  status?: 'active' | 'hidden';
}

const LISTING_SPECS: ListingSpec[] = [
  // 1 — Bien, fourchette, illustré (2 photos).
  {
    n: 1,
    ownerN: 4,
    listingType: 'good',
    title: 'Canapé d’angle convertible en tissu gris',
    description:
      'Canapé d’angle 5 places, convertible avec coffre de rangement. Très bon état, non fumeur, pas d’animaux. À récupérer sur Saint-Paul, aide au chargement possible. Fourchette selon négociation.',
    categorySlug: 'maison-mobilier-electromenager',
    subcategorySlug: 'meubles',
    valueKind: 'range',
    valueMin: 250,
    valueMax: 320,
    commune: 'Saint-Paul',
    exchangePrefs: ['money', 'goods'],
    tagSlugs: ['occasion', 'negociable', 'local'],
    slug: 'canape-angle-convertible-saint-paul-a1',
    ageMinutes: 90,
    mediaCount: 2,
    mediaSlugBase: 'canape-angle-gris',
  },
  // 2 — Bien, prix fixe, illustré (1 photo).
  {
    n: 2,
    ownerN: 13,
    listingType: 'good',
    title: 'iPhone 12 128 Go débloqué',
    description:
      'iPhone 12 noir, 128 Go, débloqué tout opérateur. Batterie à 87 %, écran nickel (toujours sous verre trempé + coque). Vendu avec câble. Remise en main propre au Moufia, Saint-Denis.',
    categorySlug: 'electronique-multimedia',
    subcategorySlug: 'telephonie',
    valueKind: 'fixed',
    valueMin: 330,
    commune: 'Saint-Denis',
    exchangePrefs: ['money'],
    tagSlugs: ['occasion', 'livraison'],
    slug: 'iphone-12-128go-saint-denis-b2',
    ageMinutes: 240,
    mediaCount: 1,
    mediaSlugBase: 'iphone-12-noir',
  },
  // 3 — Bien, gratuit (don), illustré (1 photo).
  {
    n: 3,
    ownerN: 15,
    listingType: 'good',
    title: 'Don : lot de pots et cache-pots en terre cuite',
    description:
      'Je donne une quinzaine de pots et cache-pots en terre cuite, plusieurs tailles, suite à réaménagement du jardin. Parfait pour les plantes péi. À venir chercher à Saint-Paul, le tout d’un coup de préférence.',
    categorySlug: 'bricolage-jardin-agriculture',
    subcategorySlug: 'jardin-plantes',
    valueKind: 'fixed',
    valueMin: 0,
    commune: 'Saint-Paul',
    exchangePrefs: ['open'],
    tagSlugs: ['gratuit', 'local', 'urgent'],
    slug: 'don-pots-terre-cuite-saint-paul-c3',
    ageMinutes: 30,
    mediaCount: 1,
    mediaSlugBase: 'pots-terre-cuite',
  },
  // 4 — Bien, prix fixe, illustré (2 photos), produit local.
  {
    n: 4,
    ownerN: 11,
    listingType: 'good',
    title: 'Miel de Cilaos et lentilles — panier péi',
    description:
      'Panier fermier de Cilaos : un pot de miel de la région (500 g) et 1 kg de lentilles de Cilaos récolte de l’année. Produits de mon exploitation, échange contre légumes péi possible.',
    categorySlug: 'produits-locaux-artisanat',
    subcategorySlug: 'produits-fermiers',
    valueKind: 'fixed',
    valueMin: 22,
    commune: 'Cilaos',
    exchangePrefs: ['money', 'goods'],
    tagSlugs: ['local', 'fait-main', 'echange-ok'],
    slug: 'miel-lentilles-cilaos-d4',
    ageMinutes: 150,
    mediaCount: 2,
    mediaSlugBase: 'panier-pei-cilaos',
  },
  // 5 — Service, fourchette, sans photo.
  {
    n: 5,
    ownerN: 3,
    listingType: 'service',
    title: 'Cours de conduite accompagnée — secteur Tampon',
    description:
      'Chauffeur expérimenté, je propose de l’accompagnement à la conduite sur le secteur du Tampon et de la Plaine des Cafres. Trajets montagne, brouillard, créneaux : on travaille vos points faibles. Tarif horaire selon le nombre de séances.',
    categorySlug: 'cours-formation',
    subcategorySlug: 'autres-cours-formation',
    valueKind: 'range',
    valueMin: 25,
    valueMax: 35,
    commune: 'Le Tampon',
    exchangePrefs: ['money'],
    tagSlugs: ['pro', 'local'],
    slug: 'conduite-accompagnee-tampon-e5',
    ageMinutes: 300,
  },
  // 6 — Service, prix fixe, sans photo, avec lien externe.
  {
    n: 6,
    ownerN: 6,
    listingType: 'service',
    title: 'Aide à domicile et petits travaux — Saint-Benoît',
    description:
      'Infirmière disponible en dehors de mes horaires pour de l’aide à domicile aux personnes âgées de l’Est : courses, compagnie, accompagnement rendez-vous. Sérieuse, véhiculée, références sur demande. Forfait à la demi-journée.',
    categorySlug: 'services-personnes-animaux',
    subcategorySlug: 'aide-domicile',
    valueKind: 'fixed',
    valueMin: 60,
    commune: 'Saint-Benoît',
    exchangePrefs: ['money'],
    tagSlugs: ['pro', 'local'],
    slug: 'aide-domicile-saint-benoit-f6',
    ageMinutes: 720,
    externalLinks: [
      { label: 'Mes disponibilités', url: 'https://exemple.re/emilie-aide' },
    ],
  },
  // 7 — Service, fourchette, illustré (1 photo — service peut avoir photo).
  {
    n: 7,
    ownerN: 7,
    listingType: 'service',
    title: 'Initiation surf et bodyboard à Saint-Leu',
    description:
      'Surfeur du coin, je propose des initiations surf/bodyboard sur les spots accessibles de Saint-Leu, matériel fourni. Groupes de 1 à 3 personnes, tous niveaux débutants. Photos de la session offertes. Prix selon la formule.',
    categorySlug: 'tourisme-loisirs-experiences',
    subcategorySlug: 'activites-nautiques',
    valueKind: 'range',
    valueMin: 30,
    valueMax: 50,
    commune: 'Saint-Leu',
    exchangePrefs: ['money', 'services'],
    tagSlugs: ['local', 'echange-ok'],
    slug: 'initiation-surf-saint-leu-g7',
    ageMinutes: 60,
    mediaCount: 1,
    mediaSlugBase: 'initiation-surf-saint-leu',
  },
  // 8 — Bien, prix fixe, illustré (1 photo), catégorie sensible (véhicules).
  {
    n: 8,
    ownerN: 9,
    listingType: 'good',
    title: 'Scooter 50cc — bon plan trajets Littoral',
    description:
      'Scooter 50cc en état de marche, idéal pour éviter les bouchons de la Route du Littoral. Entretien à jour, deux casques fournis. Carte grise en règle. À voir à La Possession.',
    categorySlug: 'vehicules-mobilite',
    subcategorySlug: 'deux-roues',
    valueKind: 'fixed',
    valueMin: 900,
    commune: 'La Possession',
    exchangePrefs: ['money', 'goods'],
    tagSlugs: ['occasion', 'negociable'],
    slug: 'scooter-50cc-la-possession-h8',
    ageMinutes: 1440,
    mediaCount: 1,
    mediaSlugBase: 'scooter-50cc-possession',
  },
];

/** L'annonce n a-t-elle une commune → location (centre + jitter déterministe) ?
 * Toutes nos annonces déclarent une commune (city obligatoire) et posent une
 * location au centre de la commune (règle : location = centre de commune). */
function listingLocation(spec: ListingSpec) {
  // Jitter faible (300 m) : on reste proche du centre de commune — l'adresse
  // exacte n'est de toute façon jamais stockée.
  return pointNear(communeByName(spec.commune), 300, 1000 + spec.n);
}

/** Les 8 annonces Dealplace de démonstration. */
export function buildSeedListings(): Listing[] {
  const seen = new Set<string>();
  return LISTING_SPECS.map((spec) => {
    if (seen.has(spec.slug)) {
      throw new Error(`Seed listings : url_slug en doublon (${spec.slug}).`);
    }
    seen.add(spec.slug);

    // Cohérence valeur : fixed => pas de max ; range => max >= min.
    const isRange = spec.valueKind === 'range';
    if (isRange && (spec.valueMax === undefined || spec.valueMax < spec.valueMin)) {
      throw new Error(
        `Seed listings : fourchette invalide pour « ${spec.slug} » (valueMax manquant ou < valueMin).`,
      );
    }
    // Règle photo : un bien doit avoir au moins un média.
    if (spec.listingType === 'good' && (spec.mediaCount ?? 0) < 1) {
      throw new Error(
        `Seed listings : le bien « ${spec.slug} » doit avoir au moins 1 photo (règle métier).`,
      );
    }
    // exchange_prefs non vide.
    if (spec.exchangePrefs.length === 0) {
      throw new Error(
        `Seed listings : exchange_prefs vide pour « ${spec.slug} » (sous-ensemble non vide requis).`,
      );
    }

    const createdAt = minutesAgo(spec.ageMinutes);
    return {
      id: seedUuid('listing', spec.n),
      ownerId: seedUuid('user', spec.ownerN),
      listingType: spec.listingType,
      title: spec.title,
      description: spec.description,
      categorySlug: spec.categorySlug,
      subcategorySlug: spec.subcategorySlug,
      valueKind: spec.valueKind,
      valueMin: spec.valueMin,
      valueMax: isRange ? spec.valueMax! : null,
      currency: 'EUR',
      city: spec.commune,
      location: listingLocation(spec),
      exchangePrefs: [...spec.exchangePrefs],
      externalLinks: spec.externalLinks ? spec.externalLinks.map((l) => ({ ...l })) : [],
      urlSlug: spec.slug,
      status: spec.status ?? 'active',
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    };
  });
}

/** Médias des annonces illustrées — URLs picsum.photos (placeholders démo).
 * Positions 1..count. Reconstruits à chaque appel. */
export function buildSeedListingMedia(): ListingMedia[] {
  const media: ListingMedia[] = [];
  let mediaN = 1;
  for (const spec of LISTING_SPECS) {
    const count = spec.mediaCount ?? 0;
    if (count === 0) {
      continue;
    }
    const base = spec.mediaSlugBase ?? spec.slug;
    const createdAt = minutesAgo(spec.ageMinutes);
    for (let position = 1; position <= count; position++) {
      const s = `${base}-${position}`;
      media.push({
        id: seedUuid('listingMedia', mediaN++),
        listingId: seedUuid('listing', spec.n),
        mediaType: 'image',
        url: `https://picsum.photos/seed/${s}/800/600`,
        thumbnailUrl: `https://picsum.photos/seed/${s}/400/300`,
        width: 800,
        height: 600,
        position,
        createdAt,
      });
    }
  }
  return media;
}

/** Associations annonce <-> tags (listing_tag_map). Reconstruites à chaque appel. */
export function buildSeedListingTagMap(): SeedListingTagMap[] {
  const map: SeedListingTagMap[] = [];
  for (const spec of LISTING_SPECS) {
    for (const tagSlug of spec.tagSlugs) {
      map.push({ listingId: seedUuid('listing', spec.n), tagSlug });
    }
  }
  return map;
}

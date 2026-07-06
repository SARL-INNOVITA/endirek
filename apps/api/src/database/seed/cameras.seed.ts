/**
 * Seed caméras — 12 caméras publiques fictives, UNE par commune du
 * référentiel : 7 trafic (grands axes plausibles : Route du Littoral, RN1,
 * RN2...) et 5 météo (cirques, hauts et littoral exposés).
 *
 * URLs en https://cams.endirek.invalid/... : TLD `.invalid` réservé par la
 * RFC 2606 (jamais enregistrable ni routable) — au Lot 1 étape 5, le
 * backoffice permettra de saisir les vraies URLs de flux publics.
 * `camera_number` est numéroté 1..12 dans l'ordre de déclaration (la
 * séquence mock reprend ensuite à 13).
 */

import { Camera } from '../domain/entities';
import { communeByName } from './communes';
import { daysAgo, pointNear, seedUuid } from './seed-utils';

/** Spécification déclarative d'une caméra seed (le reste est dérivé). */
interface CameraSpec {
  n: number;
  name: string;
  slug: string;
  category: 'weather' | 'traffic';
  description: string;
  commune: string;
  districtName?: string;
  status?: 'active' | 'inactive' | 'error';
}

const CAMERA_SPECS: CameraSpec[] = [
  // ── Trafic (7) ────────────────────────────────────────────────────────────
  {
    n: 1,
    name: 'Route du Littoral — sortie tunnel',
    slug: 'littoral-la-possession',
    category: 'traffic',
    description:
      'Vue sur la Route du Littoral côté La Possession, sens Ouest → Saint-Denis.',
    commune: 'La Possession',
  },
  {
    n: 2,
    name: 'Entrée ouest de Saint-Denis',
    slug: 'entree-ouest-saint-denis',
    category: 'traffic',
    description: 'Arrivée de la Route du Littoral au niveau du Barachois.',
    commune: 'Saint-Denis',
    districtName: 'Le Barachois',
  },
  {
    n: 3,
    name: 'RN1 — échangeur de Savanna',
    slug: 'rn1-savanna-saint-paul',
    category: 'traffic',
    description: 'Trafic RN1 à hauteur de Savanna, dans les deux sens.',
    commune: 'Saint-Paul',
    districtName: 'Savanna',
  },
  {
    n: 4,
    name: 'RN2 — La Cressonnière',
    slug: 'rn2-cressonniere-saint-andre',
    category: 'traffic',
    description: 'Trafic RN2 à l’entrée de Saint-André, secteur des travaux.',
    commune: 'Saint-André',
    districtName: 'La Cressonnière',
  },
  {
    n: 5,
    name: 'RN2 — entrée nord de Saint-Benoît',
    slug: 'rn2-saint-benoit-nord',
    category: 'traffic',
    description: 'Trafic RN2 à l’arrivée sur Saint-Benoît depuis Saint-André.',
    commune: 'Saint-Benoît',
  },
  {
    n: 6,
    name: 'RN1 — échangeur du Gol',
    slug: 'rn1-le-gol-saint-louis',
    category: 'traffic',
    description: 'Trafic RN1 au niveau du Gol, sens Saint-Louis → Saint-Pierre.',
    commune: 'Saint-Louis',
    districtName: 'Le Gol',
  },
  {
    n: 7,
    name: 'RN2 — entrée est de Saint-Pierre',
    slug: 'rn2-grands-bois-saint-pierre',
    category: 'traffic',
    description: 'Trafic RN2 à hauteur de Grands Bois, en direction du centre.',
    commune: 'Saint-Pierre',
    districtName: 'Grands Bois',
    // Flux en panne : la caméra remonte une erreur (cas d'écran à gérer).
    status: 'error',
  },
  // ── Météo (5) ─────────────────────────────────────────────────────────────
  {
    n: 8,
    name: 'Météo Cilaos — vue sur le cirque',
    slug: 'meteo-cilaos-cirque',
    category: 'weather',
    description: 'Panorama sur le cirque de Cilaos et le Piton des Neiges.',
    commune: 'Cilaos',
  },
  {
    n: 9,
    name: 'Météo Salazie — Hell-Bourg',
    slug: 'meteo-salazie-hell-bourg',
    category: 'weather',
    description: 'Ciel et nébulosité au-dessus de Hell-Bourg.',
    commune: 'Salazie',
    districtName: 'Hell-Bourg',
  },
  {
    n: 10,
    name: 'Météo Plaine des Cafres',
    slug: 'meteo-plaine-des-cafres',
    category: 'weather',
    description: 'Brouillard et visibilité sur les hauts du Tampon (RN3).',
    commune: 'Le Tampon',
    districtName: 'Plaine des Cafres',
  },
  {
    n: 11,
    name: 'Houle et lagon — Saint-Leu',
    slug: 'houle-lagon-saint-leu',
    category: 'weather',
    description: 'État de la mer et de la houle depuis le front de mer de Saint-Leu.',
    commune: 'Saint-Leu',
  },
  {
    n: 12,
    name: 'Météo Le Port — front de mer',
    slug: 'meteo-le-port-front-de-mer',
    category: 'weather',
    description: 'Vent et état du ciel sur la zone portuaire.',
    commune: 'Le Port',
    // Caméra désactivée le temps d'une maintenance (cas d'écran à gérer).
    status: 'inactive',
  },
];

/** Les 12 caméras de démonstration (10 actives, 1 inactive, 1 en erreur) —
 * reconstruites À CHAQUE appel : dates relatives (daysAgo) recalculées,
 * objets neufs (aucun partage entre deux instanciations du seed). */
export function buildSeedCameras(): Camera[] {
  return CAMERA_SPECS.map((spec) => {
    const createdAt = daysAgo(200 - spec.n * 3);
    return {
      id: seedUuid('camera', spec.n),
      // Numérotation 1..12 dans l'ordre de déclaration — la séquence du mock
      // se cale ensuite automatiquement après le plus grand numéro seedé.
      cameraNumber: spec.n,
      name: spec.name,
      streamType: 'image' as const,
      url: `https://cams.endirek.invalid/${spec.slug}.jpg`,
      category: spec.category,
      description: spec.description,
      // Point plausible à ~800 m du centre de la commune (déterministe).
      location: pointNear(communeByName(spec.commune), 800, 200 + spec.n),
      cityName: spec.commune,
      districtName: spec.districtName ?? null,
      status: spec.status ?? 'active',
      createdAt,
      updatedAt: createdAt,
    };
  });
}

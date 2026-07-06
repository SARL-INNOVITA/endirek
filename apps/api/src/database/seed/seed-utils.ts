/**
 * Utilitaires PURS du seed de démonstration.
 *
 * Objectifs :
 * - des identifiants DÉTERMINISTES (mêmes UUID à chaque démarrage → liens
 *   stables entre entités seed, debug reproductible) ;
 * - des dates RELATIVES au chargement (les données de démo restent toujours
 *   « fraîches » : un post seedé « il y a 30 min » l'est à chaque boot, et
 *   les posts carte ne sont jamais tous expirés) ;
 * - des positions réalistes autour des centres de communes (jitter contrôlé
 *   et déterministe).
 */

import { GeoPoint } from '../domain/entities';
import { offsetPoint } from '../mock/geo';

/**
 * UUID déterministe « v4-like » pour le seed.
 *
 * Format : `00000000-0000-4000-a000-PPPPPPPPNNNN` où :
 * - `4` (version) et `a` (variante) rendent la chaîne conforme au format UUID v4 ;
 * - `PPPPPPPP` = hachage FNV-1a 32 bits du préfixe, en hexadécimal (8 chars) —
 *   deux préfixes différents donnent des plages disjointes en pratique ;
 * - `NNNN` = n en hexadécimal (4 chars) — n doit être compris entre 0 et 65535.
 *
 * Exemple : seedUuid('user', 1) → '00000000-0000-4000-a000-60785ef20001'.
 * Ces ids se repèrent immédiatement dans les logs (préfixe zéro).
 */
export function seedUuid(prefix: string, n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) {
    throw new RangeError(
      `seedUuid : n doit être un entier entre 0 et 65535 (reçu : ${n}).`,
    );
  }

  // Hachage FNV-1a 32 bits du préfixe (stable, sans dépendance).
  let hash = 0x811c9dc5;
  for (let i = 0; i < prefix.length; i++) {
    hash ^= prefix.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  const prefixHex = (hash >>> 0).toString(16).padStart(8, '0');
  const nHex = n.toString(16).padStart(4, '0');

  return `00000000-0000-4000-a000-${prefixHex}${nHex}`;
}

/** Date « il y a n minutes », relative au moment de l'appel (chargement du
 * seed au boot) — les données de démo sont donc toujours fraîches. */
export function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60_000);
}

/** Date « il y a n heures » — sucre au-dessus de minutesAgo. */
export function hoursAgo(n: number): Date {
  return minutesAgo(n * 60);
}

/** Date « il y a n jours » — sucre au-dessus de minutesAgo. */
export function daysAgo(n: number): Date {
  return minutesAgo(n * 24 * 60);
}

/**
 * Générateur pseudo-aléatoire déterministe (mulberry32) : même graine →
 * même séquence, pour un seed reproductible d'un boot à l'autre.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Point réaliste près d'un centre de commune : décalage aléatoire mais
 * DÉTERMINISTE (piloté par `seed`) d'au plus `jitterMeters` mètres.
 * Distribution uniforme sur le disque (racine carrée du rayon).
 */
export function pointNear(
  center: { lat: number; lng: number },
  jitterMeters: number,
  seed = 0,
): GeoPoint {
  const rand = mulberry32(seed);
  const bearing = rand() * 2 * Math.PI;
  const distance = Math.sqrt(rand()) * jitterMeters;
  return offsetPoint({ lat: center.lat, lng: center.lng }, distance, bearing);
}

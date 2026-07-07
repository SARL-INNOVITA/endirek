/**
 * Adapter de géocodage inversé — interface stable + token d'injection.
 *
 * Même pattern que la couche persistance (src/database) et le stockage des
 * médias (src/adapters/media-storage) : le code métier n'injecte que le token
 * GEOCODING_ADAPTER et ne connaît que cette interface. Le driver actif est
 * choisi par GEOCODING_PROVIDER (map.geocodingProvider) :
 * - 'mock' : commune la plus proche du référentiel des 12 communes de La
 *   Réunion (MockGeocoding) — développement ;
 * - autre  : NON implémenté au Lot 1, le démarrage échoue avec une erreur
 *   explicite.
 *
 * Sert à déduire `cityName` d'une caméra créée sans ville renseignée (le
 * champ reste toujours ajustable manuellement côté backoffice).
 */

import { GeoPoint } from '../../database/domain/entities';

/** Résultat d'un géocodage inversé : commune + quartier (null au Lot 1). */
export interface ReverseGeocodeResult {
  cityName: string;
  districtName: string | null;
}

export interface GeocodingAdapter {
  /** Retrouve la commune (et, à terme, le quartier) d'un point WGS84. */
  reverseGeocode(point: GeoPoint): Promise<ReverseGeocodeResult>;
}

/** Token d'injection de l'adapter de géocodage inversé. */
export const GEOCODING_ADAPTER = Symbol('GEOCODING_ADAPTER');

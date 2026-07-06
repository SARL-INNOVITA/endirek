/**
 * Helpers géographiques PURS du driver mock — équivalents en mémoire des
 * requêtes PostGIS (ST_DWithin, ST_MakeEnvelope && location, etc.).
 *
 * Aucune dépendance : fonctions pures, testables isolément. La précision
 * (sphère de rayon moyen) est largement suffisante à l'échelle de La Réunion
 * (~70 km) pour des données de démonstration.
 */

import { BoundingBox, GeoPoint } from '../domain/entities';

/** Rayon moyen de la Terre en mètres (sphère WGS84 simplifiée). */
const EARTH_RADIUS_METERS = 6_371_000;

/** Degrés → radians. */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Distance en mètres entre deux points (formule de haversine).
 * Équivalent mock de `ST_Distance(a::geography, b::geography)`.
 */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Le point est-il dans la boîte englobante (bornes incluses) ?
 * Équivalent mock de `location && ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326)`.
 * NB : pas de gestion de l'antiméridien — inutile pour La Réunion.
 */
export function isInBbox(point: GeoPoint, bbox: BoundingBox): boolean {
  return (
    point.lat >= bbox.minLat &&
    point.lat <= bbox.maxLat &&
    point.lng >= bbox.minLng &&
    point.lng <= bbox.maxLng
  );
}

/**
 * Décale un point d'une distance (mètres) selon un cap (radians, 0 = nord).
 * Approximation locale plane, valable pour de petits décalages (< quelques km) :
 * sert au jitter des positions de seed autour des centres de communes.
 */
export function offsetPoint(
  origin: GeoPoint,
  distanceMeters: number,
  bearingRadians: number,
): GeoPoint {
  /** Mètres par degré de latitude (quasi constant). */
  const METERS_PER_DEGREE_LAT = 111_320;
  const dLat = (distanceMeters * Math.cos(bearingRadians)) / METERS_PER_DEGREE_LAT;
  const dLng =
    (distanceMeters * Math.sin(bearingRadians)) /
    (METERS_PER_DEGREE_LAT * Math.cos(toRadians(origin.lat)));

  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

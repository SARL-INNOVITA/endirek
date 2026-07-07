import { GeoPoint } from '../../database/domain/entities';

/**
 * Emprise géographique GÉNÉREUSE de La Réunion (WGS84) — garde mono-île du
 * Lot 1. Le produit ne couvre qu'une île : une position hors de cette boîte
 * est nécessairement une erreur client (GPS d'un voyageur, coordonnées
 * forgées) et fausserait la déduction de commune (« Le Port » attribué à un
 * point à 9 000 km) tout en polluant la carte (posts et caméras).
 *
 * Source UNIQUE de la garde géographique : le module posts (création de
 * publications) et le module cameras (création/mise à jour de caméras)
 * importent tous les deux d'ici — aucune constante dupliquée.
 *
 * TODO (exportabilité) : quand le produit couvrira d'autres territoires,
 * cette constante sera remplacée par une table de territoires (emprise par
 * territoire, pilotable backoffice) — voir la feuille de route Lot 2+.
 */
export const REUNION_BBOX = {
  latMin: -21.6,
  latMax: -20.7,
  lngMin: 55.0,
  lngMax: 56.0,
} as const;

/**
 * Le point est-il dans l'emprise de La Réunion (bornes incluses) ?
 * Utilisé comme garde avant toute déduction de commune ou tout affichage
 * carte : un point hors emprise est refusé (400) par les services appelants.
 */
export function isWithinReunion(point: GeoPoint): boolean {
  return (
    point.lat >= REUNION_BBOX.latMin &&
    point.lat <= REUNION_BBOX.latMax &&
    point.lng >= REUNION_BBOX.lngMin &&
    point.lng <= REUNION_BBOX.lngMax
  );
}

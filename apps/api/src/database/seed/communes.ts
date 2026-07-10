/**
 * Les 12 communes de La Réunion utilisées par le seed de démonstration
 * (coordonnées WGS84 des centres-villes, précision suffisante pour la démo).
 *
 * Ce référentiel servira AUSSI au mock de géocodage inversé de l'étape 5
 * (retrouver la commune la plus proche d'un point) — ne pas dupliquer.
 */

export interface Commune {
  name: string;
  lat: number;
  lng: number;
}

export const COMMUNES: Commune[] = [
  { name: 'Saint-Denis', lat: -20.8789, lng: 55.4481 },
  { name: 'Saint-Paul', lat: -21.0096, lng: 55.2707 },
  { name: 'Saint-Pierre', lat: -21.3393, lng: 55.4781 },
  { name: 'Le Tampon', lat: -21.2767, lng: 55.5152 },
  { name: 'Saint-André', lat: -20.9633, lng: 55.6493 },
  { name: 'Saint-Benoît', lat: -21.0339, lng: 55.7128 },
  { name: 'Saint-Leu', lat: -21.1706, lng: 55.2882 },
  { name: 'Saint-Louis', lat: -21.2861, lng: 55.411 },
  { name: 'La Possession', lat: -20.9276, lng: 55.3352 },
  { name: 'Le Port', lat: -20.9373, lng: 55.2919 },
  { name: 'Cilaos', lat: -21.1367, lng: 55.4719 },
  { name: 'Salazie', lat: -21.0269, lng: 55.5392 },
];

/**
 * Retourne une commune par son nom exact — lève une erreur claire si absente
 * (évite les fautes de frappe silencieuses dans le seed).
 */
export function communeByName(name: string): Commune {
  const commune = COMMUNES.find((c) => c.name === name);
  if (!commune) {
    throw new Error(
      `Commune inconnue dans le référentiel seed : « ${name} ». ` +
        `Communes disponibles : ${COMMUNES.map((c) => c.name).join(', ')}.`,
    );
  }
  return commune;
}

/**
 * Résout une commune par son nom, insensible à la casse et aux espaces de
 * bord — retourne `null` si le nom ne fait pas partie du référentiel. Utilisé
 * par les services métier (ex. Dealplace) pour VALIDER qu'une commune fournie
 * appartient bien au référentiel et récupérer son centre WGS84 (l'adresse
 * exacte n'est jamais stockée). Ne lève pas d'erreur : l'appelant décide du
 * message et du code HTTP (400 métier plutôt qu'un throw brut).
 */
export function findCommuneByName(name: string): Commune | null {
  const needle = name.trim().toLowerCase();
  return COMMUNES.find((c) => c.name.toLowerCase() === needle) ?? null;
}

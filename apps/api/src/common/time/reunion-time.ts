/**
 * Heure locale de La Réunion — SOURCE UNIQUE partagée (Lot 3 — D70/D73).
 *
 * La Réunion est à UTC+4 FIXE (fuseau Indian/Reunion, sans heure d'été) :
 * l'arithmétique de décalage est donc exacte et déterministe, sans
 * dépendance à une base de fuseaux. Utilisée par :
 * - le statut d'ouverture dérivé des pages (jour de semaine + minutes
 *   locales — D70) ;
 * - l'expiration carte des posts « Menu du jour » / « Offre du jour »
 *   (23 h 00 locales le jour même — D73) ;
 * - les dates calendaires des menus programmés ('YYYY-MM-DD' locaux — D71).
 *
 * Convention weekday : 0 = lundi ... 6 = dimanche (miroir de page_hours).
 */

/** Décalage fixe de La Réunion par rapport à UTC, en minutes. */
export const REUNION_UTC_OFFSET_MINUTES = 4 * 60;

/** Décomposition d'un instant en heure locale Réunion. */
export interface ReunionParts {
  year: number;
  /** Mois 1-12. */
  month: number;
  /** Jour du mois 1-31. */
  day: number;
  /** Jour de semaine : 0 = lundi ... 6 = dimanche. */
  weekday: number;
  /** Minutes écoulées depuis minuit local (0-1439). */
  minutesOfDay: number;
}

/** Décompose un instant UTC en composantes locales Réunion. */
export function toReunionParts(instant: Date): ReunionParts {
  const shifted = new Date(
    instant.getTime() + REUNION_UTC_OFFSET_MINUTES * 60_000,
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    // getUTCDay : 0 = dimanche — converti vers 0 = lundi (convention D70).
    weekday: (shifted.getUTCDay() + 6) % 7,
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** Date calendaire locale Réunion d'un instant, au format 'YYYY-MM-DD'. */
export function reunionDateString(instant: Date): string {
  const parts = toReunionParts(instant);
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

/** Décale une date calendaire 'YYYY-MM-DD' d'un nombre de jours (± entiers).
 * Arithmétique en UTC pur : aucune ambiguïté de fuseau. */
export function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${m}-${d}`;
}

/** Instant UTC correspondant à HH:MM locales Réunion d'une date calendaire
 * 'YYYY-MM-DD' (ex. l'expiration carte « jusqu'à 23 h » — D73). */
export function reunionInstantAt(
  dateString: string,
  hour: number,
  minute = 0,
): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) -
      REUNION_UTC_OFFSET_MINUTES * 60_000,
  );
}

/** 23 h 00 locales Réunion du JOUR LOCAL de l'instant donné — expiration
 * carte des posts « Menu du jour » / « Offre du jour » (D73). */
export function reunionEndOfDayAt23(instant: Date): Date {
  return reunionInstantAt(reunionDateString(instant), 23, 0);
}

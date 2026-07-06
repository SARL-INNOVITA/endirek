/**
 * Erreurs TYPÉES de la couche repository, indépendantes du driver.
 *
 * Le driver mock les lève directement ; le futur driver postgres TRADUIRA
 * les erreurs natives (ex. code SQLSTATE 23505 unique_violation) vers ces
 * types, afin que la couche service reconnaisse les violations de
 * contraintes sans jamais dépendre du driver (pas de parsing de message,
 * pas de code d'erreur SQL dans le code métier).
 */

/** Violation d'une contrainte UNIQUE (doublon) — typiquement traduite en
 * 409 Conflict par le service quand le doublon est un cas métier attendu
 * (ex. double signalement sous concurrence). */
export class UniqueViolationError extends Error {
  constructor(
    /** Nom de la contrainte violée (ex. reports_reporter_target_unique). */
    readonly constraint: string,
    message: string,
  ) {
    super(message);
    this.name = 'UniqueViolationError';
  }
}

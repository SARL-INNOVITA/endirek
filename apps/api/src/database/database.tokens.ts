/**
 * Tokens d'injection NestJS de la couche persistance.
 *
 * Les modules métier injectent les repositories via ces tokens :
 *
 *   constructor(
 *     @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
 *   ) {}
 *
 * DatabaseModule lie chaque token à l'implémentation du driver actif
 * (mock aujourd'hui, postgres demain) : le code métier ne change jamais.
 */

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');
export const POST_TYPES_REPOSITORY = Symbol('POST_TYPES_REPOSITORY');
export const POSTS_REPOSITORY = Symbol('POSTS_REPOSITORY');
export const COMMENTS_REPOSITORY = Symbol('COMMENTS_REPOSITORY');
export const REACTIONS_REPOSITORY = Symbol('REACTIONS_REPOSITORY');
export const SAVED_REPOSITORY = Symbol('SAVED_REPOSITORY');
export const CAMERAS_REPOSITORY = Symbol('CAMERAS_REPOSITORY');
export const REPORTS_REPOSITORY = Symbol('REPORTS_REPOSITORY');
export const NOTIFICATIONS_REPOSITORY = Symbol('NOTIFICATIONS_REPOSITORY');

/** Liste complète des tokens de repositories — source unique de vérité,
 * réellement utilisée par DatabaseModule pour ses `exports` (tout nouveau
 * token ajouté ici est automatiquement exposé au code métier). */
export const ALL_REPOSITORY_TOKENS: symbol[] = [
  USERS_REPOSITORY,
  POST_TYPES_REPOSITORY,
  POSTS_REPOSITORY,
  COMMENTS_REPOSITORY,
  REACTIONS_REPOSITORY,
  SAVED_REPOSITORY,
  CAMERAS_REPOSITORY,
  REPORTS_REPOSITORY,
  NOTIFICATIONS_REPOSITORY,
];

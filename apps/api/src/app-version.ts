/**
 * Version de l'API Endirek — source de vérité unique côté runtime.
 *
 * Utilisée par le healthcheck (GET /health) et la documentation Swagger.
 * À maintenir alignée avec le champ "version" de apps/api/package.json
 * lors d'un bump de version.
 */
export const APP_VERSION = '0.1.0';

import { CustomDecorator, SetMetadata } from '@nestjs/common';

/**
 * Clé de métadonnée lue par JwtAuthGuard pour identifier les routes publiques.
 * Exportée pour que le guard et d'éventuels tests la référencent sans chaîne
 * magique dupliquée.
 */
export const IS_PUBLIC_KEY = 'endirek:isPublic';

/**
 * @Public() — marque une route (ou un contrôleur entier) comme PUBLIQUE :
 * le guard JWT global (JwtAuthGuard, enregistré via APP_GUARD) la laisse
 * passer sans exiger de jeton d'accès.
 *
 * Usage : healthcheck, register, login, refresh, placeholders OAuth.
 * Tout ce qui n'est pas décoré @Public() exige un Bearer token valide.
 */
export const Public = (): CustomDecorator<string> =>
  SetMetadata(IS_PUBLIC_KEY, true);

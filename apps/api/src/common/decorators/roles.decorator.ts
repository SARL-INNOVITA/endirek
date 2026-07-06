import { CustomDecorator, SetMetadata } from '@nestjs/common';
import { UserRole } from '../../database/domain/entities';

/** Clé de métadonnée lue par RolesGuard (liste des rôles autorisés). */
export const ROLES_KEY = 'endirek:roles';

/**
 * @Roles(...rôles) — restreint une route (ou un contrôleur) aux rôles listés.
 * S'utilise AVEC RolesGuard, en complément du guard JWT global qui a déjà
 * authentifié l'utilisateur et posé son rôle sur la requête.
 *
 *   @Roles('moderator', 'super_admin')
 *   @UseGuards(RolesGuard)
 *   @Controller('admin/users') ...
 *
 * Prévu pour le backoffice (module admin — phase suivante de l'étape 3).
 */
export const Roles = (...roles: UserRole[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);

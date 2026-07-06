import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '../../database/domain/entities';

/**
 * Identité attachée à la requête par JwtAuthGuard après vérification du jeton
 * ET rechargement de l'utilisateur en base (statut revérifié à chaque requête).
 *
 * Volontairement minimale ({ userId, role }) : les contrôleurs qui ont besoin
 * du profil complet le rechargent via leur service — pas d'entité User
 * « périmée » qui se promènerait dans la requête.
 */
export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

/**
 * @CurrentUser() — injecte l'identité { userId, role } posée par JwtAuthGuard.
 *
 *   @Get('me')
 *   me(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 * Lève une 401 si aucune identité n'est présente (route non couverte par le
 * guard — ne doit jamais arriver avec le guard global, filet de sécurité).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new UnauthorizedException('Authentification requise');
    }
    return request.user;
  },
);

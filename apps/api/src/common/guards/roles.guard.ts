import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../database/domain/entities';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard de rôles : compare le rôle posé sur la requête par JwtAuthGuard à la
 * liste exigée par @Roles(...). Sans métadonnée @Roles, la route passe (le
 * guard est neutre) — la protection par rôle est donc explicite, route par
 * route ou contrôleur par contrôleur.
 *
 * S'applique via @UseGuards(RolesGuard) APRÈS le guard JWT global (les guards
 * globaux s'exécutent toujours avant les guards de contrôleur).
 * Utilisé par le module admin (backoffice — phase suivante de l'étape 3).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // Pas de restriction de rôle sur cette route.
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    if (!user) {
      // Route @Public() + @Roles() : incohérence de câblage — on refuse.
      throw new UnauthorizedException('Authentification requise');
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        "Vous n'avez pas les droits nécessaires pour effectuer cette action",
      );
    }
    return true;
  }
}

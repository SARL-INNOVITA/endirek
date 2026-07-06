import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthConfig } from '../../config/configuration';
import { USERS_REPOSITORY } from '../../database/database.tokens';
import { UsersRepository } from '../../database/repositories/interfaces';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** Requête HTTP enrichie de l'identité posée par le guard. */
interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/** Payload attendu d'un access token ({ sub, role } — contrat étape 3). */
interface AccessTokenPayload {
  sub?: string;
  role?: string;
}

/**
 * Guard JWT GLOBAL (enregistré via APP_GUARD dans AuthModule) : toutes les
 * routes de l'API exigent un jeton d'accès, sauf celles décorées @Public().
 *
 * À chaque requête authentifiée, le guard :
 * 1. vérifie la signature et l'expiration du Bearer token (secret auth.jwtSecret) ;
 * 2. RECHARGE l'utilisateur via UsersRepository et revérifie son statut —
 *    c'est ce rechargement systématique qui invalide de fait les jetons
 *    encore valides après une suppression RGPD (compte 'deleted' → 401) ou
 *    une suspension par la modération ('suspended' → 403 « Compte suspendu »),
 *    sans liste de révocation côté serveur ;
 * 3. attache { userId, role } à la requête (lu par @CurrentUser() et RolesGuard).
 *
 * Messages d'erreur volontairement sobres : aucun détail technique exposé.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Routes @Public() (méthode OU contrôleur) : aucun jeton exigé.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentification requise');
    }

    // 1. Signature + expiration (les refresh tokens, signés avec un AUTRE
    //    secret, échouent ici : impossible de s'en servir comme access token).
    const { jwtSecret } = this.configService.getOrThrow<AuthConfig>('auth');
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
    if (!payload.sub) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    // 2. Rechargement de l'utilisateur : le statut est revérifié à CHAQUE
    //    requête (voir commentaire de classe — invalidation RGPD/suspension).
    const user = await this.usersRepository.findById(payload.sub);
    if (!user || user.status === 'deleted') {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
    if (user.status === 'suspended') {
      throw new ForbiddenException('Compte suspendu');
    }

    // 3. Identité minimale à disposition des contrôleurs et de RolesGuard.
    request.user = { userId: user.id, role: user.role };
    return true;
  }

  /** Extrait le jeton d'un header « Authorization: Bearer <token> ». */
  private extractBearerToken(request: RequestWithUser): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, token] = header.split(' ');
    if (!token || scheme.toLowerCase() !== 'bearer') {
      return null;
    }
    return token;
  }
}

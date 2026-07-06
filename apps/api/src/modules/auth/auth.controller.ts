import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { FullProfile } from '../../common/mappers/profile.mapper';
import { AuthService, AuthSession, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * Contrôleur d'authentification — contrat d'API étape 3.
 * Le guard JWT global protège tout par défaut : seules les routes @Public()
 * (register, login, refresh, OAuth placeholders) sont accessibles sans jeton.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary:
      'Créer un compte (email / mot de passe) et ouvrir la session',
  })
  @ApiResponse({ status: 201, description: 'Compte créé — profil complet + jetons' })
  @ApiResponse({ status: 409, description: 'Un compte existe déjà avec cet email' })
  register(@Body() dto: RegisterDto): Promise<AuthSession> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Se connecter (email / mot de passe)' })
  @ApiResponse({ status: 200, description: 'Connexion réussie — profil complet + jetons' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  @ApiResponse({ status: 403, description: 'Compte suspendu' })
  login(@Body() dto: LoginDto): Promise<AuthSession> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rafraîchir la paire de jetons à partir d'un refresh token",
  })
  @ApiResponse({ status: 200, description: 'Nouvelle paire de jetons' })
  @ApiResponse({ status: 401, description: 'Jeton invalide/expiré ou compte inactif' })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Se déconnecter (le client jette ses jetons)',
    description:
      'Authentification STATELESS — limite documentée : le serveur ne tient ' +
      'aucune liste de révocation, cette route ne révoque donc rien côté ' +
      "serveur ; le client supprime ses jetons. L'access token restant " +
      "expire vite (JWT_EXPIRES_IN) et tout jeton d'un compte supprimé ou " +
      'suspendu est rejeté par le guard, qui revérifie le statut à chaque requête.',
  })
  @ApiResponse({ status: 204, description: 'Déconnexion prise en compte' })
  logout(): void {
    // Rien à faire côté serveur (voir description) : 204 volontaire.
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil complet de l'utilisateur connecté" })
  @ApiResponse({ status: 200, description: 'Profil complet' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<FullProfile> {
    return this.authService.getMe(user.userId);
  }

  @Public()
  @Post('oauth/google')
  @ApiOperation({
    summary: 'Connexion Google — non disponible (placeholder propre)',
    description:
      'Prévu au contrat : les variables GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ' +
      "existent déjà dans la configuration ; l'implémentation arrivera quand " +
      'les clés seront fournies. En attendant : 501.',
  })
  @ApiResponse({ status: 501, description: 'Connexion Google non disponible pour le moment' })
  oauthGoogle(): never {
    throw new NotImplementedException(
      'Connexion Google non disponible pour le moment',
    );
  }

  @Public()
  @Post('oauth/apple')
  @ApiOperation({
    summary: 'Connexion Apple — non disponible (placeholder propre)',
    description:
      'Prévu au contrat : la variable APPLE_CLIENT_ID existe déjà dans la ' +
      "configuration ; l'implémentation arrivera quand les clés seront " +
      'fournies. En attendant : 501.',
  })
  @ApiResponse({ status: 501, description: 'Connexion Apple non disponible pour le moment' })
  oauthApple(): never {
    throw new NotImplementedException(
      'Connexion Apple non disponible pour le moment',
    );
  }
}

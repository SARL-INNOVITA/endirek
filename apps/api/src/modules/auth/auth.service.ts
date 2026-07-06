import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcryptjs from 'bcryptjs';
import { AuthConfig } from '../../config/configuration';
import {
  POSTS_REPOSITORY,
  SAVED_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import { User } from '../../database/domain/entities';
import {
  PostsRepository,
  SavedRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';
import {
  FullProfile,
  toFullProfile,
} from '../../common/mappers/profile.mapper';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/** Coût bcrypt des mots de passe (contrat étape 3 : 10). */
const BCRYPT_COST = 10;

/**
 * Hash bcrypt « leurre » calculé une seule fois au chargement du module.
 * Mitigation timing / énumération d'emails : quand aucun compte actif ne
 * correspond à l'email fourni, login() exécute quand même un bcrypt.compare
 * contre ce hash constant avant de lever le MÊME 401. Le temps de réponse
 * « email inconnu » devient ainsi comparable au temps « mot de passe faux »,
 * supprimant l'oracle temporel qui permettait de distinguer un email existant.
 * (Le hash porte sur une chaîne arbitraire ; aucun mot de passe réel ne peut
 * y correspondre puisqu'il n'est associé à aucun compte.)
 */
const DUMMY_PASSWORD_HASH = bcryptjs.hashSync(
  'endirek-dummy-timing-guard',
  BCRYPT_COST,
);

/**
 * Durée de vie JWT (ex. '15m', '30d'). Le typage strict de jsonwebtoken exige
 * le gabarit `ms.StringValue`, mais nos durées viennent de variables
 * d'environnement (chaînes libres) : cast contrôlé et documenté ici, une
 * durée invalide fait échouer la signature avec une erreur claire au runtime.
 */
function asJwtLifetime(value: string): JwtSignOptions['expiresIn'] {
  return value as JwtSignOptions['expiresIn'];
}

/** Paire de jetons émise à l'inscription, à la connexion et au refresh. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Réponse de register/login : profil complet + jetons. */
export interface AuthSession extends TokenPair {
  user: FullProfile;
}

/** Payload attendu d'un refresh token ({ sub, tokenType: 'refresh' }). */
interface RefreshTokenPayload {
  sub?: string;
  tokenType?: string;
}

/**
 * Service d'authentification — inscription, connexion, rafraîchissement des
 * jetons et profil courant.
 *
 * Règles du contrat étape 3 :
 * - email normalisé (trim + minuscules) avant toute recherche/création ;
 * - login : message 401 IDENTIQUE (« Identifiants invalides ») que l'email
 *   soit inconnu, le mot de passe faux ou le compte supprimé — aucune fuite
 *   d'existence de compte ; compte suspendu → 403 « Compte suspendu » (après
 *   vérification du mot de passe, pour ne rien révéler sans preuve d'identité) ;
 * - jetons STATELESS : le serveur ne stocke ni ne révoque rien (limite
 *   documentée sur /auth/logout) — l'invalidation effective passe par le
 *   guard global qui revérifie le statut du compte à chaque requête.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
    @Inject(SAVED_REPOSITORY)
    private readonly savedRepository: SavedRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Configuration auth typée (secrets et durées de vie des jetons). */
  private get authConfig(): AuthConfig {
    return this.configService.getOrThrow<AuthConfig>('auth');
  }

  /**
   * Inscription : crée le compte (mot de passe haché bcrypt, coût 10), la
   * collection d'enregistrements par défaut « Général », puis ouvre la session.
   */
  async register(dto: RegisterDto): Promise<AuthSession> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.usersRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await bcryptjs.hash(dto.password, BCRYPT_COST);
    const user = await this.usersRepository.create({
      email,
      passwordHash,
      displayName: dto.displayName.trim(),
    });

    // Collection d'enregistrements par défaut, créée dès l'inscription
    // (contrat : SavedRepository.getOrCreateDefaultCollection).
    await this.savedRepository.getOrCreateDefaultCollection(user.id);

    return this.openSession(user);
  }

  /** Connexion email / mot de passe. */
  async login(dto: LoginDto): Promise<AuthSession> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersRepository.findByEmail(email);

    // Message UNIQUE quelle que soit la cause (email inconnu, mot de passe
    // faux, compte supprimé) : aucune information exploitable n'est révélée.
    if (!user || user.status === 'deleted') {
      // Mitigation timing / énumération d'emails : on paie le MÊME coût bcrypt
      // qu'un login normal (comparaison leurre contre un hash constant) avant
      // de lever le 401 identique. Sans ce leurre, l'absence de bcrypt.compare
      // rendait la réponse « email inconnu » plus rapide → oracle d'existence.
      await bcryptjs.compare(dto.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Identifiants invalides');
    }
    const passwordMatches = await bcryptjs.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    // La suspension n'est révélée qu'à un utilisateur qui a prouvé son identité.
    if (user.status === 'suspended') {
      throw new ForbiddenException('Compte suspendu');
    }

    return this.openSession(user);
  }

  /**
   * Rafraîchissement : vérifie le refresh token (secret dédié, payload
   * { sub, tokenType: 'refresh' }) et revérifie que le compte est toujours
   * actif avant d'émettre une nouvelle paire de jetons.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        { secret: this.authConfig.refreshSecret },
      );
    } catch {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
    // Un access token (ou tout autre jeton) ne peut pas servir de refresh.
    if (payload.tokenType !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    const user = await this.usersRepository.findById(payload.sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    return this.issueTokens(user);
  }

  /** Profil complet de l'utilisateur courant (GET /auth/me). */
  async getMe(userId: string): Promise<FullProfile> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.status === 'deleted') {
      // Le guard global a déjà filtré ce cas — filet de sécurité.
      throw new UnauthorizedException('Session invalide ou expirée');
    }
    return this.buildFullProfile(user);
  }

  /** Projette un User vers le PROFIL COMPLET (postsCount recalculé). */
  private async buildFullProfile(user: User): Promise<FullProfile> {
    const postsCount = await this.postsRepository.countByAuthor(user.id);
    return toFullProfile(user, postsCount);
  }

  /** Session complète : profil + paire de jetons. */
  private async openSession(user: User): Promise<AuthSession> {
    const tokens = await this.issueTokens(user);
    return { user: await this.buildFullProfile(user), ...tokens };
  }

  /**
   * Émet la paire de jetons du contrat étape 3 :
   * - access  : { sub, role }, signé auth.jwtSecret, durée auth.jwtExpiresIn ;
   * - refresh : { sub, tokenType: 'refresh' }, signé auth.refreshSecret,
   *   durée auth.refreshExpiresIn.
   */
  private async issueTokens(user: User): Promise<TokenPair> {
    const auth = this.authConfig;
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user.id, role: user.role },
        {
          secret: auth.jwtSecret,
          expiresIn: asJwtLifetime(auth.jwtExpiresIn),
        },
      ),
      this.jwtService.signAsync(
        { sub: user.id, tokenType: 'refresh' },
        {
          secret: auth.refreshSecret,
          expiresIn: asJwtLifetime(auth.refreshExpiresIn),
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }
}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthConfig } from '../../config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Module d'authentification (Lot 1 étape 3).
 *
 * - JwtModule configuré via ConfigService (groupe `auth` de la configuration
 *   typée) : secret et durée par défaut = ceux de l'ACCESS token ; le service
 *   et le guard passent de toute façon secret/durée explicitement à chaque
 *   signature/vérification (access ≠ refresh).
 * - Enregistre JwtAuthGuard comme guard GLOBAL (APP_GUARD) : toutes les
 *   routes de l'API exigent un jeton, sauf celles décorées @Public().
 *   Le Reflector (lecture des métadonnées @Public/@Roles) est fourni par le
 *   cœur NestJS et injecté automatiquement dans les guards.
 * - Les repositories (USERS/POSTS/SAVED) viennent du DatabaseModule @Global.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const auth = configService.getOrThrow<AuthConfig>('auth');
        return {
          secret: auth.jwtSecret,
          // Durée issue de l'environnement (chaîne libre type '15m') : le
          // typage jsonwebtoken exige le gabarit ms.StringValue — cast contrôlé.
          signOptions: {
            expiresIn: auth.jwtExpiresIn as JwtSignOptions['expiresIn'],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Guard JWT global : appliqué à TOUTES les routes de l'application.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}

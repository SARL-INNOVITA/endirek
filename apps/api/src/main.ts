import { mkdirSync } from 'node:fs';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { resolveUploadDir } from './adapters/media-storage/upload-dir';
import { APP_VERSION } from './app-version';
import { AppModule } from './app.module';
import type { AppConfig, MediaConfig } from './config/configuration';

/**
 * Point d'entrée de l'API Endirek.
 *
 * Étape 1 (socle) : seuls la configuration et le healthcheck sont câblés.
 * Les modules métier (auth, posts, carte, etc.) seront branchés aux étapes suivantes.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configuration typée (source de vérité unique : src/config/configuration.ts).
  const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');

  // Validation globale : supprime silencieusement les champs inconnus des payloads
  // et les transforme en DTO typés. (Pour rejeter en 400 au lieu de supprimer,
  // ajouter forbidNonWhitelisted: true — à décider quand les DTO arriveront.)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // CORS : origines autorisées via CORS_ORIGINS (déjà découpées par la config).
  app.enableCors({ origin: appConfig.corsOrigins });

  // Préfixe global des routes métier : /api/v1 — le healthcheck reste exposé à la racine.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // Médias (étape 4, driver local) : fichiers uploadés servis STATIQUEMENT
  // sur /uploads/ — hors préfixe global ET hors guard JWT (les fichiers
  // statiques Express ne passent pas par les guards Nest : c'est voulu,
  // les URLs de médias sont publiques). Le dossier est créé au boot.
  const mediaConfig = app.get(ConfigService).getOrThrow<MediaConfig>('media');
  if (mediaConfig.driver === 'local') {
    const uploadDir = resolveUploadDir(mediaConfig.uploadDir);
    mkdirSync(uploadDir, { recursive: true });
    app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
  }

  // Documentation Swagger (OpenAPI) montée sur /docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Endirek API')
    .setDescription(
      'API du réseau social local temps réel de La Réunion — Lot 1',
    )
    .setVersion(APP_VERSION)
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = appConfig.port;
  await app.listen(port);

  // Journal de démarrage : URLs utiles pour le développement.
  // eslint-disable-next-line no-console
  console.log(
    [
      '',
      '  ENDIREK API démarrée ✔',
      `  • API         : http://localhost:${port}/api/v1`,
      `  • Healthcheck : http://localhost:${port}/health`,
      `  • Swagger     : http://localhost:${port}/docs`,
      '',
    ].join('\n'),
  );
}

void bootstrap();

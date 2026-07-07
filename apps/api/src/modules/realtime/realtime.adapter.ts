import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import type { AppConfig, CorsOrigin } from '../../config/configuration';

/**
 * Adapter socket.io de l'API — étend l'IoAdapter standard de NestJS pour
 * appliquer au serveur temps réel la MÊME politique CORS que l'API HTTP
 * (app.corsOrigins, issu de CORS_ORIGINS). Le décorateur @WebSocketGateway
 * est évalué au chargement de la classe : il ne peut PAS lire la config
 * injectée ; c'est donc ici, au boot (main.ts), qu'on branche les origines.
 *
 * Enregistré via app.useWebSocketAdapter(new RealtimeIoAdapter(app)) AVANT
 * app.listen — sans quoi socket.io retomberait sur ses réglages CORS par
 * défaut. N'affecte que le transport WebSocket : le préfixe api/v1, Swagger,
 * le guard HTTP et le service statique /uploads restent inchangés.
 */
export class RealtimeIoAdapter extends IoAdapter {
  private readonly corsOrigins: CorsOrigin[];

  constructor(app: INestApplicationContext) {
    super(app);
    this.corsOrigins = app
      .get(ConfigService)
      .getOrThrow<AppConfig>('app').corsOrigins;
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigins, credentials: true },
    });
  }
}

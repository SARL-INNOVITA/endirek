import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { APP_VERSION } from '../../app-version';
import { Public } from '../../common/decorators/public.decorator';

/** Réponse du healthcheck. */
export interface HealthResponse {
  status: 'ok';
  name: string;
  version: string;
  environment: string;
  /** Durée de fonctionnement du processus, en secondes arrondies. */
  uptime: number;
  /** Horodatage ISO 8601 de la réponse. */
  timestamp: string;
}

// @Public() : le healthcheck reste accessible sans jeton malgré le guard JWT
// global (APP_GUARD) — indispensable pour la supervision et les sondes.
@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary:
      "Vérifie que l'API Endirek est en vie (statut, version, environnement, uptime)",
  })
  check(): HealthResponse {
    return {
      status: 'ok',
      name: 'endirek-api',
      version: APP_VERSION,
      environment: process.env.NODE_ENV ?? 'development',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}

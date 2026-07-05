import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Module de healthcheck — seul module métier câblé à l'étape 1 (socle).
 * Expose GET /health (hors préfixe global api/v1) pour la supervision
 * et les sondes de disponibilité (Docker, Hetzner, monitoring).
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}

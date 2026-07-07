import { Module } from '@nestjs/common';
import { GeocodingModule } from '../../adapters/geocoding/geocoding.module';
import { CamerasController } from './cameras.controller';
import { CamerasService } from './cameras.service';

/**
 * Module caméras (Lot 1 étape 5) — caméras météo/trafic de la carte.
 *
 * Expose le détail public d'une caméra active (GET /cameras/:id) et surtout
 * CamerasService, EXPORTÉ pour être réutilisé par :
 * - le module map (liste publique des caméras actives : /map/cameras,
 *   /map/overview) ;
 * - le module admin (les 6 routes /admin/cameras du backoffice).
 *
 * Importe GeocodingModule (adapter GEOCODING_ADAPTER) pour déduire cityName à
 * la création. Les repositories viennent de DatabaseModule (@Global).
 */
@Module({
  imports: [GeocodingModule],
  controllers: [CamerasController],
  providers: [CamerasService],
  exports: [CamerasService],
})
export class CamerasModule {}

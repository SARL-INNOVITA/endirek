import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MapConfig } from '../../config/configuration';
import {
  GEOCODING_ADAPTER,
  GeocodingAdapter,
} from './geocoding.adapter';
import { MockGeocoding } from './mock-geocoding';

/**
 * GeocodingModule — sélectionne l'implémentation de l'adapter de géocodage
 * inversé selon la configuration `map.geocodingProvider` (GEOCODING_PROVIDER),
 * miroir du pattern de la couche persistance (DB_DRIVER) et du stockage des
 * médias (MEDIA_STORAGE_DRIVER) :
 *
 * - 'mock' (défaut) : MockGeocoding — commune la plus proche du référentiel
 *   des 12 communes de La Réunion. Aucune infrastructure requise.
 * - autre : PAS ENCORE IMPLÉMENTÉ au Lot 1 — le démarrage échoue volontairement
 *   avec une erreur explicite plutôt que de faire semblant de fonctionner.
 *
 * Le code métier n'injecte que le token GEOCODING_ADAPTER ; le module est
 * exporté pour que CamerasModule le consomme.
 */
const geocodingProvider: Provider = {
  provide: GEOCODING_ADAPTER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): GeocodingAdapter => {
    const map = configService.getOrThrow<MapConfig>('map');
    switch (map.geocodingProvider) {
      case 'mock':
        return new MockGeocoding();
      default:
        throw new Error(
          `Adapter géocodage « ${map.geocodingProvider} » non implémenté au ` +
            'Lot 1 — utilisez GEOCODING_PROVIDER=mock.',
        );
    }
  },
};

@Module({
  providers: [geocodingProvider],
  exports: [GEOCODING_ADAPTER],
})
export class GeocodingModule {}

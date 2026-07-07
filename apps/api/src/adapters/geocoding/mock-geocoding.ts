import { findNearestCommune } from '../../common/geo/nearest-commune';
import { GeoPoint } from '../../database/domain/entities';
import {
  GeocodingAdapter,
  ReverseGeocodeResult,
} from './geocoding.adapter';

/**
 * Implémentation « mock » du géocodage inversé (GEOCODING_PROVIDER=mock) :
 * la commune du référentiel la plus proche du point (distance haversine aux
 * centres-villes des 12 communes de La Réunion — findNearestCommune, source
 * unique du helper commune-la-plus-proche partagé avec la création de posts).
 *
 * `districtName` reste null au Lot 1 : le référentiel ne descend pas au
 * niveau du quartier. Le champ existe déjà côté entité et pourra être renseigné
 * manuellement au backoffice, ou par l'API réelle quand elle sera branchée.
 */
export class MockGeocoding implements GeocodingAdapter {
  reverseGeocode(point: GeoPoint): Promise<ReverseGeocodeResult> {
    return Promise.resolve({
      cityName: findNearestCommune(point).name,
      districtName: null,
    });
  }
}

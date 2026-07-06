import { GeoPoint } from '../../database/domain/entities';
import { haversineMeters } from '../../database/mock/geo';
import { Commune, COMMUNES } from '../../database/seed/communes';

/**
 * Géocodage inversé SIMPLIFIÉ du Lot 1 : la commune du référentiel la plus
 * proche d'un point (distance haversine aux centres-villes des 12 communes).
 *
 * Sert à déduire `city` quand un post est créé avec une location mais sans
 * ville. L'adapter de géocodage formel (GEOCODING_PROVIDER) arrive à
 * l'étape 5 — ce helper restera son implémentation « mock ».
 *
 * NB : haversineMeters et COMMUNES sont des éléments PURS (aucun accès aux
 * stores du driver mock) — leur import ici ne contourne pas le contrat
 * repository.
 */
export function findNearestCommune(point: GeoPoint): Commune {
  let nearest = COMMUNES[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const commune of COMMUNES) {
    const distance = haversineMeters(point, commune);
    if (distance < nearestDistance) {
      nearest = commune;
      nearestDistance = distance;
    }
  }
  return nearest;
}

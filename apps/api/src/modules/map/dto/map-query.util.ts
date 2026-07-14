import { TransformFnParams } from 'class-transformer';

/**
 * Découpe un paramètre de requête « liste » (weather,traffic,danger) en tableau
 * nettoyé. Accepte soit une chaîne CSV, soit un tableau (répétition du même
 * paramètre) — les deux formes usuelles d'un query param multi-valeurs. Les
 * segments vides sont écartés ; retourne undefined si rien d'exploitable (le
 * filtre est alors « absent »).
 */
export function toStringList({ value }: TransformFnParams): string[] | undefined {
  const raw: unknown = value;
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const parts = Array.isArray(raw)
    ? raw.flatMap((item) => String(item).split(','))
    : String(raw).split(',');
  const cleaned = parts.map((part) => part.trim()).filter((part) => part.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Slugs des types de post affichables sur la carte au Lot 1 (source de
 * vérité ANNEXE : la vraie source reste post_types.showsOnMap, mais ces trois
 * slugs cadrent le filtre `types` du contrat et les messages d'erreur).
 *
 * INVARIANT — MAP_POST_TYPES DOIT rester le miroir exact des slugs de
 * post_types dont showsOnMap = true. C'est une SECONDE source de vérité, en
 * dur, utilisée UNIQUEMENT pour la validation d'entrée du filtre `types`
 * (@IsIn au niveau des DTO carte → 400 avant le service). Le service, lui, ne
 * s'appuie JAMAIS sur cette liste pour décider ce qui s'affiche : il intersecte
 * toujours avec l'allowlist live post_types.showsOnMap (MapService.mapTypeSlugs).
 *
 * RISQUE DE DÉRIVE (Lot 2+) — si le backoffice rend un type carte-visible
 * (showsOnMap passé à true) SANS l'ajouter ici, /map/*?types=<ceSlug> le
 * rejettera en 400 alors que le type serait légitimement affichable. Inverse :
 * un slug retiré de showsOnMap mais laissé ici serait accepté au DTO puis
 * filtré à vide par le service (branche défensive de loadMapPosts). Dans les
 * deux cas : mettre à jour cette liste EN MÊME TEMPS que showsOnMap.
 *
 * Lot 3 : les trois types de posts de PAGE (menu/offer/event — D73,
 * showsOnMap=true dans la migration 0009) rejoignent la liste, en respect de
 * l'invariant ci-dessus.
 */
export const MAP_POST_TYPES = [
  'weather',
  'traffic',
  'danger',
  'menu',
  'offer',
  'event',
] as const;

/** Catégories de caméra de la carte (onglets météo / trafic). */
export const MAP_CAMERA_CATEGORIES = ['weather', 'traffic'] as const;

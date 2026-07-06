# Module `map` — Carte interactive

**Statut : endpoints PRÉPARATOIRES implémentés à l'étape 4 — le reste
(caméras, modes, clustering) arrive à l'étape 5 du Lot 1.**

Rôle : données de la page Carte centrée sur La Réunion.

## Implémenté (étape 4, préparatoire — pas d'UI carte)

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/v1/map/communes` | Les 12 communes du référentiel `[{ name, lat, lng }]` (composer, future carte) |
| GET | `/api/v1/map/posts` | Marqueurs : posts `active` + location non nulle + `mapExpiresAt > now`, `?minLat=&minLng=&maxLat=&maxLng=` (bbox optionnelle, les 4 bornes ensemble) |

La forme AUTEUR des marqueurs vient de `FeedPostAssembler.loadAuthors`
(module posts — source unique du contrat).

## Reste à faire (étape 5)

Périmètre Lot 1 — mode **Météo & trafic** réellement implémenté :
- caméras météo et trafic actives (voir module `cameras`) ;
- expiration carte **paramétrable par type** (déjà en place côté posts :
  `mapExpiresAt` piloté par `post_types.default_map_duration_minutes`) ;
- les modes « Offres & restos » et « Événements » restent des placeholders
  visuels côté mobile (TODO Lot 2+).

Règles techniques : tuiles OSM (`MAP_TILE_URL`), clustering ou optimisation
prévue si beaucoup de marqueurs ; l'adapter de géocodage formel
(`GEOCODING_PROVIDER`) remplacera le helper commune-la-plus-proche.

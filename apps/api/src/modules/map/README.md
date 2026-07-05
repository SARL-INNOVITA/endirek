# Module `map` — Carte interactive

**Statut : TODO — implémentation prévue à l'étape 5 du Lot 1.**

Rôle : données de la page Carte centrée sur La Réunion.

Périmètre Lot 1 — mode **Météo & trafic** réellement implémenté :
- caméras météo et trafic actives (voir module `cameras`) ;
- posts météo, trafic et accident/danger **géolocalisés** et non expirés
  (expiration carte **2 h par défaut, paramétrable** — le post reste au feed) ;
- les modes « Offres & restos » et « Événements » restent des placeholders
  visuels côté mobile (TODO Lot 2+).

Règles techniques : tuiles OSM (`MAP_TILE_URL`), clustering ou optimisation
prévue si beaucoup de marqueurs ; endpoint de requête par zone (bounding box).

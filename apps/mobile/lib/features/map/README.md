# feature: map — Carte « Météo & trafic » (Lot 1, checkpoint 5)

Carte live centrée La Réunion (référence mockup `02 Carte`). Onglet Carte du shell.

## Contenu

- `domain/map_constants.dart` : tuiles OSM (URL configurable, défaut
  `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, `userAgentPackageName = re.endirek`),
  centre (-21.115, 55.536), zoom initial 9.5, emprise île (miroir de `REUNION_BBOX`
  côté API) → contrainte de caméra flutter_map. Attribution OSM affichée (obligation OSM).
- `domain/map_marker.dart` : union `MapMarker` (post géolocalisé OU caméra active).
- `domain/marker_clusterer.dart` : **clusterer maison** (voir ci-dessous).
- `data/map_repository.dart` : `GET /map/overview` (UN SEUL appel → posts + caméras).
- `application/map_controller.dart` : état + filtres (Météo/Trafic/Danger/Caméras),
  qui pilotent à la fois l'appel API (`types=` posts, `categories=` caméras) et
  l'affichage. Rechargé sur changement de filtres et sur l'event realtime `map.updated`.
- `presentation/` : `map_screen.dart` (flutter_map, FABs, chips de mode, états),
  widgets `marqueur_carte.dart` (pins par type + bulle de cluster), `preview_marqueur.dart`
  (preview card flottante), `filtres_carte_sheet.dart` (bottom sheet de bascules).

## Clustering (algorithme)

Clusterer **à grille dépendante du zoom**, sans dépendance externe, testé
(`test/marker_clusterer_test.dart`) :

1. Le pas de grille en degrés suit l'échelle de la carte :
   `pas = celluleBase / 2^(zoom - zoomBase)`, borné entre un plancher et un plafond.
   Chaque niveau de zoom double/halve la résolution → moins de regroupement en zoom
   profond, davantage en dézoom.
2. Chaque marqueur tombe dans la cellule `(floor(lat/pas), floor(lng/pas))`. Une
   cellule = un cluster ; sa position d'affichage est le **barycentre** des points
   (pas le centre de cellule) → pas d'effet « pin qui saute ».
3. Un cluster d'un seul élément est rendu comme un marqueur normal ; un agrégat
   affiche son nombre. Tap sur un agrégat → zoom de deux crans pour l'écarter.
   **Cluster INDIVISIBLE** (marqueurs confondus qu'aucun zoom ne sépare — même
   cellule au pas du zoom max, cas nominal des publications d'une même PAGE au
   Lot 3 : menu/offre/événement portés par le point de la page) : le tap ouvre
   un **bottom sheet listant le contenu** (`contenu_cluster_sheet.dart`) et le
   choix sélectionne le marqueur comme un tap ordinaire (preview card). Détection
   par `MarkerClusterer.peutEclater`.

Propriétés : O(n), stable, robuste (jamais de coordonnée invalide). L'antiméridien
n'est pas géré (La Réunion en est très loin). **Évolution serveur** : l'API porte
déjà la bbox (`GET /map/overview`) ; ce clusterer client pourra être remplacé par un
clustering côté serveur sans toucher la présentation (qui ne consomme que des
`ClusterCarte`).

## Décisions

- **includeExpired** : ignoré/false au Lot 1 (documenté côté API) — la carte ne
  montre jamais un post expiré.
- **bbox** : la carte du Lot 1 charge l'île entière (volumes faibles) puis regroupe
  côté client ; l'architecture bbox reste prête pour un chargement par zone.
- **Recherche (FAB loupe)** : placeholder « Recherche bientôt disponible » au Lot 1.
  Le saut vers une commune via `/map/communes` est prévu pour un lot ultérieur.
- **Modes** « Offres & restos » / « Événements » : chips visibles → snackbar
  « Bientôt disponible ».
- **Caméras** : n'apparaissent que pour une catégorie dont le mode est actif (une
  caméra trafic n'apparaît pas en mode Météo seul). L'API ne renvoie que des caméras
  `active`.

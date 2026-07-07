import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

import 'map_marker.dart';

/// Résultat du regroupement : soit un marqueur SEUL, soit un AGRÉGAT de
/// plusieurs marqueurs proches. La carte dessine un pin pour un solitaire, une
/// bulle numérotée pour un cluster.
class ClusterCarte {
  const ClusterCarte({
    required this.position,
    required this.marqueurs,
  });

  /// Position d'affichage du cluster = barycentre (moyenne) des marqueurs qui
  /// le composent — plus fidèle que la position d'une cellule de grille.
  final LatLng position;

  /// Marqueurs regroupés (au moins un).
  final List<MapMarker> marqueurs;

  bool get estAgregat => marqueurs.length > 1;
  int get taille => marqueurs.length;

  /// L'unique marqueur d'un cluster solitaire (à n'appeler que si
  /// [estAgregat] est faux).
  MapMarker get unique => marqueurs.first;

  /// Clé de widget stable : l'id du marqueur pour un solitaire, sinon une clé
  /// dérivée de la cellule + du nombre d'éléments.
  String cle(int codeCellule) =>
      estAgregat ? 'cl:$codeCellule:${marqueurs.length}' : unique.cle;
}

/// Clusterer MAISON à grille dépendante du zoom.
///
/// ALGORITHME (simple, déterministe, sans dépendance) :
/// 1. Le pas de grille en degrés décroît avec le zoom : plus on zoome, plus la
///    grille est fine, donc moins on regroupe. Concrètement le pas est
///    `tailleCelluleDeg = celluleBase / 2^(zoom - zoomBase)` borné entre un
///    plancher et un plafond — une progression géométrique qui suit
///    l'échelle de la carte (chaque niveau de zoom double la résolution).
/// 2. Chaque marqueur tombe dans la cellule `(floor(lat/pas), floor(lng/pas))`.
///    Les marqueurs d'une même cellule forment un cluster ; sa position
///    d'affichage est le BARYCENTRE des points (et non le centre de cellule),
///    ce qui évite l'effet « pin qui saute » quand la composition change.
/// 3. Un cluster d'un seul élément est rendu comme un marqueur normal.
///
/// Propriétés : O(n) (une passe, table de hachage par cellule), stable (l'ordre
/// d'insertion est préservé dans chaque cellule), robuste (aucune coordonnée
/// invalide n'est produite ; l'antiméridien n'est pas géré car La Réunion est
/// loin de la ligne de changement de date — documenté).
///
/// ÉVOLUTION SERVEUR : l'API porte déjà la bbox (GET /map/overview) ; ce
/// clusterer client pourra être remplacé par un clustering côté serveur
/// (agrégats par tuile) sans changer la couche présentation — celle-ci ne
/// consomme que des [ClusterCarte].
class MarkerClusterer {
  const MarkerClusterer({
    this.zoomBase = 9.5,
    this.celluleBaseDeg = 0.12,
    this.celluleMinDeg = 0.0008,
    this.celluleMaxDeg = 0.5,
  });

  /// Zoom de référence auquel le pas de grille vaut [celluleBaseDeg].
  final double zoomBase;

  /// Pas de grille (degrés) au zoom de référence.
  final double celluleBaseDeg;

  /// Plancher du pas de grille (au-delà, on ne regroupe quasiment plus).
  final double celluleMinDeg;

  /// Plafond du pas de grille (en dézoom extrême, on regroupe largement).
  final double celluleMaxDeg;

  /// Taille de cellule (degrés) pour un zoom donné : progression géométrique
  /// bornée. `2^(zoomBase - zoom)` : quand `zoom > zoomBase` la cellule
  /// rétrécit, quand `zoom < zoomBase` elle grandit.
  double tailleCellulePourZoom(double zoom) {
    // Vraie puissance de 2 (monotone sur tout l'axe des exposants) : garantit
    // que la taille de cellule est strictement non-croissante quand le zoom
    // augmente — indispensable pour un clustering stable pendant un pinch-zoom
    // continu (pas de dents de scie aux demi-niveaux de zoom).
    final double facteur = math.pow(2, zoomBase - zoom).toDouble();
    final double taille = celluleBaseDeg * facteur;
    if (taille < celluleMinDeg) return celluleMinDeg;
    if (taille > celluleMaxDeg) return celluleMaxDeg;
    return taille;
  }

  /// Regroupe les marqueurs pour un niveau de zoom donné.
  List<ClusterCarte> regrouper(List<MapMarker> marqueurs, double zoom) {
    if (marqueurs.isEmpty) {
      return const [];
    }
    final double pas = tailleCellulePourZoom(zoom);

    // Regroupement par cellule (clé « colLat:colLng »). LinkedHashMap conserve
    // l'ordre d'apparition → rendu stable d'une frame à l'autre.
    final Map<String, List<MapMarker>> parCellule = {};
    for (final MapMarker m in marqueurs) {
      final int colLat = (m.point.latitude / pas).floor();
      final int colLng = (m.point.longitude / pas).floor();
      (parCellule['$colLat:$colLng'] ??= <MapMarker>[]).add(m);
    }

    final List<ClusterCarte> clusters = [];
    for (final List<MapMarker> groupe in parCellule.values) {
      clusters.add(
        ClusterCarte(position: _barycentre(groupe), marqueurs: groupe),
      );
    }
    return clusters;
  }

  /// Code entier stable d'une cellule (pour la clé de widget d'un cluster).
  static int codeCellule(LatLng position, double pas) {
    final int colLat = (position.latitude / pas).floor();
    final int colLng = (position.longitude / pas).floor();
    // Combinaison de Cantor-like, suffisante pour une clé locale.
    return colLat * 100003 + colLng;
  }

  /// Barycentre (moyenne arithmétique) d'un groupe de marqueurs.
  static LatLng _barycentre(List<MapMarker> groupe) {
    double sommeLat = 0;
    double sommeLng = 0;
    for (final MapMarker m in groupe) {
      sommeLat += m.point.latitude;
      sommeLng += m.point.longitude;
    }
    final int n = groupe.length;
    return LatLng(sommeLat / n, sommeLng / n);
  }
}

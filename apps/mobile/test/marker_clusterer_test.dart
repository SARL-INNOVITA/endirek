// Test du clusterer maison de la carte (features/map/domain) avec des points
// factices. Vérifie : le regroupement de points proches, la séparation quand
// on zoome, la préservation du nombre total d'éléments et le barycentre.

import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

import 'package:endirek_mobile/core/api/models/camera.dart';
import 'package:endirek_mobile/core/api/models/geo_point.dart';
import 'package:endirek_mobile/core/api/models/map_post_item.dart';
import 'package:endirek_mobile/core/api/models/post_author.dart';
import 'package:endirek_mobile/features/map/domain/map_marker.dart';
import 'package:endirek_mobile/features/map/domain/marker_clusterer.dart';

/// Auteur factice minimal.
const _auteur = PostAuthor(
  id: 'u1',
  displayName: 'Test',
  avatarUrl: null,
  city: 'Saint-Denis',
);

/// Marqueur de post factice à une position donnée.
MapMarker _post(String id, double lat, double lng) {
  final item = MapPostItem(
    id: id,
    typeSlug: 'traffic',
    title: 'P $id',
    location: GeoPoint(lat: lat, lng: lng),
    city: 'Saint-Denis',
    mapExpiresAt: null,
    createdAt: DateTime(2026, 1, 1),
    urlSlug: 'p-$id',
    author: _auteur,
  );
  return MapMarker.depuisPost(item, LatLng(lat, lng));
}

/// Marqueur de caméra factice à une position donnée.
MapMarker _camera(String id, double lat, double lng) {
  final camera = Camera(
    id: id,
    cameraNumber: 1,
    name: 'Cam $id',
    streamType: 'image',
    url: 'https://example.test/$id.jpg',
    category: 'traffic',
    description: '',
    location: GeoPoint(lat: lat, lng: lng),
    cityName: 'Saint-Denis',
    districtName: null,
    createdAt: DateTime(2026, 1, 1),
  );
  return MapMarker.depuisCamera(camera);
}

void main() {
  const clusterer = MarkerClusterer();

  test('liste vide → aucun cluster', () {
    expect(clusterer.regrouper(const [], 9.5), isEmpty);
  });

  test('deux points quasi confondus sont regroupés en un seul cluster', () {
    final marqueurs = [
      _post('a', -20.8823, 55.4504),
      _post('b', -20.8824, 55.4505),
    ];
    final clusters = clusterer.regrouper(marqueurs, 9.5);
    expect(clusters, hasLength(1));
    expect(clusters.first.estAgregat, isTrue);
    expect(clusters.first.taille, 2);
  });

  test('des points très éloignés restent séparés', () {
    final marqueurs = [
      _post('nord', -20.8823, 55.4504), // Saint-Denis
      _post('sud', -21.3393, 55.4781), // Saint-Pierre
      _camera('ouest', -21.0096, 55.2707), // Le Port
    ];
    final clusters = clusterer.regrouper(marqueurs, 11);
    // À ce zoom, trois communes distinctes → trois marqueurs solitaires.
    expect(clusters, hasLength(3));
    expect(clusters.every((c) => !c.estAgregat), isTrue);
  });

  test('zoomer sépare un groupe précédemment fusionné', () {
    // Deux points distants d'environ 0.05° : fusionnés en dézoom, séparés en
    // zoom profond.
    final marqueurs = [
      _post('a', -20.90, 55.45),
      _post('b', -20.95, 55.50),
    ];
    final dezoom = clusterer.regrouper(marqueurs, 8.5);
    final zoomProfond = clusterer.regrouper(marqueurs, 15);
    expect(dezoom, hasLength(1));
    expect(dezoom.first.taille, 2);
    expect(zoomProfond, hasLength(2));
  });

  test('le nombre total de marqueurs est conservé à travers les clusters', () {
    final marqueurs = [
      _post('a', -20.8823, 55.4504),
      _post('b', -20.8824, 55.4505),
      _post('c', -21.3393, 55.4781),
      _camera('d', -21.3394, 55.4782),
      _camera('e', -21.0096, 55.2707),
    ];
    for (final double zoom in [8.5, 9.5, 11.0, 14.0, 17.0]) {
      final clusters = clusterer.regrouper(marqueurs, zoom);
      final int total =
          clusters.fold(0, (somme, c) => somme + c.marqueurs.length);
      expect(total, marqueurs.length, reason: 'zoom=$zoom');
    }
  });

  test('la position d\'un cluster est le barycentre de ses marqueurs', () {
    final marqueurs = [
      _post('a', -20.90, 55.40),
      _post('b', -20.90, 55.42),
    ];
    final clusters = clusterer.regrouper(marqueurs, 9.5);
    expect(clusters, hasLength(1));
    final position = clusters.first.position;
    expect(position.latitude, closeTo(-20.90, 1e-9));
    expect(position.longitude, closeTo(55.41, 1e-9));
  });

  test('la taille de cellule décroît quand le zoom augmente', () {
    final grand = clusterer.tailleCellulePourZoom(8);
    final moyen = clusterer.tailleCellulePourZoom(11);
    final petit = clusterer.tailleCellulePourZoom(16);
    expect(grand, greaterThan(moyen));
    expect(moyen, greaterThan(petit));
  });

  test('la taille de cellule est non-croissante sur un balayage fin du zoom',
      () {
    // Balaie le zoom de 8.5 à 18 par pas de 0.1 et vérifie qu'à CHAQUE pas la
    // cellule ne grandit jamais quand on zoome davantage. Ce test attrape la
    // non-monotonicité (dents de scie) que les 3 points espacés du test
    // précédent masquaient totalement.
    double? precedente;
    for (int i = 0; i <= 95; i++) {
      final double zoom = 8.5 + i * 0.1;
      final double cellule = clusterer.tailleCellulePourZoom(zoom);
      if (precedente != null) {
        expect(
          cellule,
          lessThanOrEqualTo(precedente),
          reason: 'cellule doit être non-croissante au zoom=$zoom',
        );
      }
      precedente = cellule;
    }
  });
}

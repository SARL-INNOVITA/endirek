import 'package:latlong2/latlong.dart';

import '../../../core/api/models/camera.dart';
import '../../../core/api/models/map_post_item.dart';

/// Genre d'un marqueur carte — pilote l'icône, la couleur et l'écran de
/// destination au tap.
enum GenreMarqueur { post, camera }

/// Un marqueur unitaire de la carte : un post géolocalisé OU une caméra
/// active. Union close (l'un des deux champs est non nul selon [genre]).
///
/// Sert d'ENTRÉE au clusterer ([point] est la seule donnée dont il a besoin)
/// et de porteur des données affichées dans la preview card.
class MapMarker {
  const MapMarker._({
    required this.genre,
    required this.point,
    this.post,
    this.camera,
  });

  /// Construit un marqueur depuis un post carte (location supposée non nulle —
  /// filtrée en amont).
  factory MapMarker.depuisPost(MapPostItem post, LatLng point) {
    return MapMarker._(genre: GenreMarqueur.post, point: point, post: post);
  }

  /// Construit un marqueur depuis une caméra active.
  factory MapMarker.depuisCamera(Camera camera) {
    return MapMarker._(
      genre: GenreMarqueur.camera,
      point: LatLng(camera.location.lat, camera.location.lng),
      camera: camera,
    );
  }

  final GenreMarqueur genre;
  final LatLng point;
  final MapPostItem? post;
  final Camera? camera;

  /// Slug de type d'un marqueur de post ('weather'/'traffic'/'danger') — vide
  /// pour une caméra.
  String get typeSlug => post?.typeSlug ?? '';

  /// Identifiant stable pour la clé de widget (préfixé par le genre pour
  /// éviter toute collision entre un post et une caméra de même id).
  String get cle => genre == GenreMarqueur.camera
      ? 'cam:${camera!.id}'
      : 'post:${post!.id}';
}

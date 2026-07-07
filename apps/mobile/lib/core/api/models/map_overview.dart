import 'camera.dart';
import 'map_post_item.dart';

/// Vue d'ensemble de la carte (GET /map/overview) : `{ posts, cameras }`.
/// UN SEUL appel ramène tout ce qu'affiche la carte mobile.
class MapOverview {
  const MapOverview({required this.posts, required this.cameras});

  final List<MapPostItem> posts;
  final List<Camera> cameras;

  factory MapOverview.fromJson(Map<String, dynamic> json) {
    return MapOverview(
      posts: ((json['posts'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MapPostItem.fromJson)
          .toList(),
      cameras: ((json['cameras'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(Camera.fromJson)
          .toList(),
    );
  }

  bool get estVide => posts.isEmpty && cameras.isEmpty;
}

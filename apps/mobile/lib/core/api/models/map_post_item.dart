import 'geo_point.dart';
import 'post_author.dart';

/// Forme MAP_POST_ITEM du contrat d'API étape 5 — marqueur carte LÉGER d'une
/// publication (GET /map/overview et /map/posts) :
/// `{ id, typeSlug, title, location, city, mapExpiresAt, createdAt, urlSlug,
///    author:{id,displayName,avatarUrl,city} }`.
///
/// Volontairement plus mince qu'un FEED_POST (ni corps, ni compteurs, ni
/// médias) : la carte n'affiche qu'un marqueur et une preview courte, et
/// renvoie au détail /post/:id pour le contenu complet.
///
/// SÉCURITÉ : l'API ne renvoie ici que des posts « active », géolocalisés,
/// non expirés et de type carte (weather/traffic/danger) — jamais free/
/// question ni hidden/deleted. Le mobile n'a donc pas à re-filtrer.
class MapPostItem {
  const MapPostItem({
    required this.id,
    required this.typeSlug,
    required this.title,
    required this.location,
    required this.city,
    required this.mapExpiresAt,
    required this.createdAt,
    required this.urlSlug,
    required this.author,
  });

  final String id;
  final String typeSlug;
  final String? title;

  /// Toujours non nulle en pratique (garantie API), mais typée nullable pour
  /// coller au contrat et rester robuste face à une donnée mal formée : un
  /// marqueur sans position est ignoré à la construction de la carte.
  final GeoPoint? location;

  final String? city;
  final DateTime? mapExpiresAt;
  final DateTime createdAt;
  final String urlSlug;
  final PostAuthor author;

  factory MapPostItem.fromJson(Map<String, dynamic> json) {
    return MapPostItem(
      id: json['id'] as String,
      typeSlug: (json['typeSlug'] as String?) ?? '',
      title: json['title'] as String?,
      location: json['location'] == null
          ? null
          : GeoPoint.fromJson(json['location'] as Map<String, dynamic>),
      city: json['city'] as String?,
      mapExpiresAt: json['mapExpiresAt'] == null
          ? null
          : DateTime.parse(json['mapExpiresAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
      urlSlug: (json['urlSlug'] as String?) ?? '',
      author: PostAuthor.fromJson(json['author'] as Map<String, dynamic>),
    );
  }
}

import 'geo_point.dart';

/// Forme CAMERA_PUBLIC du contrat d'API étape 5 — projection d'une caméra
/// ACTIVE servie à la carte et au détail public :
/// `{ id, cameraNumber, name, streamType, url, category, description,
///    location:{lat,lng}, cityName, districtName, createdAt }`.
///
/// SANS `status` ni `updatedAt` (réservés à la vue admin). L'API ne renvoie
/// jamais une caméra non « active » sur cette forme — le mobile n'a donc pas
/// à filtrer sur un statut qu'il ne connaît pas.
class Camera {
  const Camera({
    required this.id,
    required this.cameraNumber,
    required this.name,
    required this.streamType,
    required this.url,
    required this.category,
    required this.description,
    required this.location,
    required this.cityName,
    required this.districtName,
    required this.createdAt,
  });

  final String id;
  final int cameraNumber;
  final String name;

  /// 'image' | 'video' | 'iframe' — au Lot 1, seul 'image' est affiché en flux
  /// direct ; 'video'/'iframe' retombent sur une vignette + l'URL du flux.
  final String streamType;

  final String url;

  /// 'weather' | 'traffic'.
  final String category;

  final String description;
  final GeoPoint location;
  final String cityName;
  final String? districtName;
  final DateTime createdAt;

  factory Camera.fromJson(Map<String, dynamic> json) {
    return Camera(
      id: json['id'] as String,
      cameraNumber: (json['cameraNumber'] as num?)?.toInt() ?? 0,
      name: (json['name'] as String?) ?? '',
      streamType: (json['streamType'] as String?) ?? 'image',
      url: (json['url'] as String?) ?? '',
      category: (json['category'] as String?) ?? 'traffic',
      description: (json['description'] as String?) ?? '',
      location: GeoPoint.fromJson(json['location'] as Map<String, dynamic>),
      cityName: (json['cityName'] as String?) ?? '',
      districtName: json['districtName'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  /// Libellé français de la catégorie (badge du détail et de la carte).
  String get libelleCategorie => switch (category) {
        'weather' => 'Caméra météo',
        'traffic' => 'Caméra trafic',
        _ => 'Caméra',
      };
}

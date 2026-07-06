/// Commune du référentiel seed (GET /map/communes) : `{ name, lat, lng }` —
/// centre-ville WGS84. Sert de sélecteur de position dans le composer
/// (la position GPS réelle arrive avec la carte, étapes 5/7).
class Commune {
  const Commune({required this.name, required this.lat, required this.lng});

  final String name;
  final double lat;
  final double lng;

  factory Commune.fromJson(Map<String, dynamic> json) {
    return Commune(
      name: json['name'] as String,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
    );
  }
}

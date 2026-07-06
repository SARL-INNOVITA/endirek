/// Type de publication — ligne de la table de référence `post_types`
/// (GET /posts/types, types actifs triés par position).
///
/// La table est PILOTABLE par le backoffice : le mobile construit sa bottom
/// sheet de composition avec cette liste, sans jamais supposer les 5 types.
class PostType {
  const PostType({
    required this.slug,
    required this.labelFr,
    required this.icon,
    required this.color,
    required this.requiresLocationForMap,
    required this.showsOnMap,
    required this.defaultMapDurationMinutes,
    required this.position,
  });

  final String slug;
  final String labelFr;

  /// Nom d'icône symbolique côté référentiel (« pencil », « cloud »...) —
  /// mappé vers une IconData Material avec repli (voir type_visuel.dart).
  final String icon;

  /// Couleur hexadécimale « #RRGGBB » du type.
  final String color;

  final bool requiresLocationForMap;
  final bool showsOnMap;

  /// Durée de visibilité carte en minutes (null pour les types hors carte).
  final int? defaultMapDurationMinutes;

  final int position;

  factory PostType.fromJson(Map<String, dynamic> json) {
    return PostType(
      slug: json['slug'] as String,
      labelFr: (json['labelFr'] as String?) ?? '',
      icon: (json['icon'] as String?) ?? '',
      color: (json['color'] as String?) ?? '',
      requiresLocationForMap: (json['requiresLocationForMap'] as bool?) ?? false,
      showsOnMap: (json['showsOnMap'] as bool?) ?? false,
      defaultMapDurationMinutes:
          (json['defaultMapDurationMinutes'] as num?)?.toInt(),
      position: (json['position'] as num?)?.toInt() ?? 0,
    );
  }
}

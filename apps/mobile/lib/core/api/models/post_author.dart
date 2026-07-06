/// Forme AUTEUR du contrat d'API étape 4 (feed, détail, commentaires) :
/// `{ id, displayName, avatarUrl, city }`.
///
/// Les comptes supprimés apparaissent déjà anonymisés côté API — aucun
/// traitement particulier n'est nécessaire côté mobile.
class PostAuthor {
  const PostAuthor({
    required this.id,
    required this.displayName,
    required this.avatarUrl,
    required this.city,
  });

  final String id;
  final String displayName;
  final String? avatarUrl;
  final String? city;

  factory PostAuthor.fromJson(Map<String, dynamic> json) {
    return PostAuthor(
      id: json['id'] as String,
      displayName: (json['displayName'] as String?) ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      city: json['city'] as String?,
    );
  }

  /// Initiales du nom affiché (repli visuel quand il n'y a pas d'avatar).
  String get initiales {
    final List<String> mots = displayName
        .trim()
        .split(RegExp(r'\s+'))
        .where((mot) => mot.isNotEmpty)
        .toList();
    if (mots.isEmpty) {
      return '?';
    }
    final String premiere = mots.first[0].toUpperCase();
    if (mots.length == 1) {
      return premiere;
    }
    return premiere + mots.last[0].toUpperCase();
  }
}

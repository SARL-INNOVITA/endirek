/// Référence LÉGÈRE de la PAGE auteure d'une publication (Lot 3) :
/// `{ id, name, avatarUrl, pageType, verified }`.
///
/// Portée par FEED_POST et MAP_POST_ITEM (`page` nullable — null = post
/// d'utilisateur). Quand elle est présente, l'UI affiche l'IDENTITÉ DE PAGE
/// (nom, avatar, badge vérifié) À LA PLACE de l'auteur humain, et le tap
/// navigue vers /pages/:id.
class PostPageRef {
  const PostPageRef({
    required this.id,
    required this.name,
    required this.avatarUrl,
    required this.pageType,
    required this.verified,
  });

  final String id;
  final String name;
  final String? avatarUrl;

  /// 'restaurant' | 'business'.
  final String pageType;

  final bool verified;

  factory PostPageRef.fromJson(Map<String, dynamic> json) {
    return PostPageRef(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      pageType: (json['pageType'] as String?) ?? 'business',
      verified: (json['verified'] as bool?) ?? false,
    );
  }

  /// Initiales du nom de la page (repli visuel sans avatar) — même règle
  /// que [PostAuthor.initiales].
  String get initiales {
    final List<String> mots = name
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

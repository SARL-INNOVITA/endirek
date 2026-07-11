/// PROFIL PUBLIC du contrat d'API (forme renvoyée par `GET /users/:id` pour
/// un TIERS — jamais d'email, de rôle, de statut ni de réglages).
///
/// Utilisé au CP2.2 comme EN-TÊTE de l'écran « Profil Dealplace » d'un autre
/// utilisateur : avatar, nom, commune, bio et « Ce que je recherche »
/// (`dealplaceSeeking`, donnée publique, null si non renseignée).
class ProfilPublic {
  const ProfilPublic({
    required this.id,
    required this.displayName,
    required this.avatarUrl,
    required this.coverUrl,
    required this.bio,
    required this.city,
    required this.dealplaceSeeking,
    required this.followersCount,
    required this.followingCount,
    required this.postsCount,
    required this.createdAt,
  });

  final String id;
  final String displayName;
  final String? avatarUrl;
  final String? coverUrl;
  final String bio;
  final String? city;

  /// « Ce que je recherche » (profil Dealplace — CP2.2), null si non rempli.
  final String? dealplaceSeeking;
  final int followersCount;
  final int followingCount;
  final int postsCount;
  final DateTime createdAt;

  factory ProfilPublic.fromJson(Map<String, dynamic> json) {
    return ProfilPublic(
      id: json['id'] as String,
      displayName: (json['displayName'] as String?) ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      coverUrl: json['coverUrl'] as String?,
      bio: (json['bio'] as String?) ?? '',
      city: json['city'] as String?,
      dealplaceSeeking: json['dealplaceSeeking'] as String?,
      followersCount: (json['followersCount'] as num?)?.toInt() ?? 0,
      followingCount: (json['followingCount'] as num?)?.toInt() ?? 0,
      postsCount: (json['postsCount'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  /// Initiales du nom affiché (repli visuel sans avatar) — même règle que
  /// PostAuthor/UserProfile : « Maya Hoarau » → « MH », « Kevin » → « K ».
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

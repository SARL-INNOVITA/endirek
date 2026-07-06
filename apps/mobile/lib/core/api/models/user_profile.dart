/// PROFIL COMPLET du contrat d'API étape 3 — forme renvoyée par
/// `POST /auth/register`, `POST /auth/login` (champ `user`), `GET /auth/me`,
/// `GET /users/me/profile` et `PATCH /users/me/profile`.
///
/// Ce modèle correspond à l'utilisateur COURANT (il contient email, rôle,
/// statut et réglages — des champs que l'API ne renvoie jamais pour autrui).
class UserProfile {
  const UserProfile({
    required this.id,
    required this.email,
    required this.displayName,
    required this.avatarUrl,
    required this.coverUrl,
    required this.bio,
    required this.city,
    required this.role,
    required this.status,
    required this.settings,
    required this.followersCount,
    required this.followingCount,
    required this.postsCount,
    required this.createdAt,
  });

  final String id;
  final String email;
  final String displayName;
  final String? avatarUrl;
  final String? coverUrl;
  final String bio;
  final String? city;
  final String role;
  final String status;
  final Map<String, dynamic> settings;
  final int followersCount;
  final int followingCount;
  final int postsCount;
  final DateTime createdAt;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      email: (json['email'] as String?) ?? '',
      displayName: (json['displayName'] as String?) ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      coverUrl: json['coverUrl'] as String?,
      bio: (json['bio'] as String?) ?? '',
      city: json['city'] as String?,
      role: (json['role'] as String?) ?? 'user',
      status: (json['status'] as String?) ?? 'active',
      settings: (json['settings'] as Map?)?.cast<String, dynamic>() ?? {},
      followersCount: (json['followersCount'] as num?)?.toInt() ?? 0,
      followingCount: (json['followingCount'] as num?)?.toInt() ?? 0,
      postsCount: (json['postsCount'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  /// Initiales du nom affiché (repli visuel quand il n'y a pas d'avatar) :
  /// « Maya Hoarau » → « MH », « Kevin » → « K ».
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

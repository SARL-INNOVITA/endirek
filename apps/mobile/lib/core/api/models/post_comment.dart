import 'post_author.dart';

/// Marqueur « champ absent » pour [PostComment.copyWith] (viewerReaction
/// nullable : distinguer « inchangé » de « remis à null »).
const Object _champAbsent = Object();

/// Commentaire du contrat d'API étape 4 (OPTION A stricte) :
/// - racine (depth 0) avec ses réponses actives imbriquées dans [replies] ;
/// - réponse (depth 1) : même forme, [replies] toujours vide.
///
/// Un commentaire racine supprimé qui conserve au moins une réponse active
/// est renvoyé avec `isDeleted: true` et `body: ''` (placeholder affiché
/// « Commentaire supprimé »).
class PostComment {
  const PostComment({
    required this.id,
    required this.body,
    required this.status,
    required this.createdAt,
    required this.author,
    required this.reactionCount,
    required this.viewerReaction,
    required this.isDeleted,
    required this.replies,
  });

  final String id;
  final String body;
  final String status;
  final DateTime createdAt;
  final PostAuthor author;
  final int reactionCount;
  final String? viewerReaction;
  final bool isDeleted;
  final List<PostComment> replies;

  factory PostComment.fromJson(Map<String, dynamic> json) {
    return PostComment(
      id: json['id'] as String,
      body: (json['body'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'active',
      createdAt: DateTime.parse(json['createdAt'] as String),
      author: PostAuthor.fromJson(json['author'] as Map<String, dynamic>),
      reactionCount: (json['reactionCount'] as num?)?.toInt() ?? 0,
      viewerReaction: json['viewerReaction'] as String?,
      isDeleted: (json['isDeleted'] as bool?) ?? false,
      replies: ((json['replies'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PostComment.fromJson)
          .toList(),
    );
  }

  PostComment copyWith({
    String? body,
    int? reactionCount,
    Object? viewerReaction = _champAbsent,
    bool? isDeleted,
    List<PostComment>? replies,
  }) {
    return PostComment(
      id: id,
      body: body ?? this.body,
      status: status,
      createdAt: createdAt,
      author: author,
      reactionCount: reactionCount ?? this.reactionCount,
      viewerReaction: identical(viewerReaction, _champAbsent)
          ? this.viewerReaction
          : viewerReaction as String?,
      isDeleted: isDeleted ?? this.isDeleted,
      replies: replies ?? this.replies,
    );
  }
}

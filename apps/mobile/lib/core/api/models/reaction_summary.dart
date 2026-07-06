import 'feed_post.dart';

/// Réponse des réactions sur un POST (POST/DELETE /posts/:id/reactions) :
/// `{ reactionCount, reactionsTop, viewerReaction }` — appliquée telle
/// quelle au FEED_POST concerné (source de vérité serveur).
class PostReactionsSummary {
  const PostReactionsSummary({
    required this.reactionCount,
    required this.reactionsTop,
    required this.viewerReaction,
  });

  final int reactionCount;
  final List<EmojiCount> reactionsTop;
  final String? viewerReaction;

  factory PostReactionsSummary.fromJson(Map<String, dynamic> json) {
    return PostReactionsSummary(
      reactionCount: (json['reactionCount'] as num?)?.toInt() ?? 0,
      reactionsTop: ((json['reactionsTop'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(EmojiCount.fromJson)
          .toList(),
      viewerReaction: json['viewerReaction'] as String?,
    );
  }
}

/// Réponse des réactions sur un COMMENTAIRE
/// (POST/DELETE /comments/:id/reactions) : `{ reactionCount, viewerReaction }`.
class CommentReactionsSummary {
  const CommentReactionsSummary({
    required this.reactionCount,
    required this.viewerReaction,
  });

  final int reactionCount;
  final String? viewerReaction;

  factory CommentReactionsSummary.fromJson(Map<String, dynamic> json) {
    return CommentReactionsSummary(
      reactionCount: (json['reactionCount'] as num?)?.toInt() ?? 0,
      viewerReaction: json['viewerReaction'] as String?,
    );
  }
}

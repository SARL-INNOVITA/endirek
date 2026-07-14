import 'geo_point.dart';
import 'post_author.dart';
import 'post_media.dart';
import 'post_page_ref.dart';

/// Marqueur « champ absent » pour les paramètres NULLABLES de
/// [FeedPost.copyWith] : il distingue « ne pas toucher » (absent) de
/// « mettre à null » (retrait de la réaction du viewer, par exemple).
const Object _champAbsent = Object();

/// Un emoji et son nombre de réactions (élément de `reactionsTop`).
class EmojiCount {
  const EmojiCount({required this.emoji, required this.count});

  final String emoji;
  final int count;

  factory EmojiCount.fromJson(Map<String, dynamic> json) {
    return EmojiCount(
      emoji: json['emoji'] as String,
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Forme FEED_POST du contrat d'API étape 4 — la projection UNIQUE d'une
/// publication (feed, détail, listes de profil).
class FeedPost {
  const FeedPost({
    required this.id,
    required this.typeSlug,
    required this.title,
    required this.body,
    required this.city,
    required this.location,
    required this.mapExpiresAt,
    required this.urlSlug,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    required this.reactionCount,
    required this.commentCount,
    required this.shareCount,
    required this.saveCount,
    required this.author,
    required this.page,
    required this.media,
    required this.viewerReaction,
    required this.viewerSaved,
    required this.reactionsTop,
  });

  final String id;
  final String typeSlug;
  final String? title;
  final String body;
  final String? city;
  final GeoPoint? location;
  final DateTime? mapExpiresAt;
  final String urlSlug;

  /// 'active' | 'hidden' | 'deleted' — 'hidden' n'apparaît que dans
  /// « Mes publications » (l'auteur voit ses posts masqués).
  final String status;

  final DateTime createdAt;
  final DateTime updatedAt;
  final int reactionCount;
  final int commentCount;
  final int shareCount;
  final int saveCount;
  final PostAuthor author;

  /// PAGE auteure de la publication (Lot 3) — null pour un post
  /// d'utilisateur. Quand elle est présente, l'UI affiche l'identité de la
  /// page à la place de l'auteur humain.
  final PostPageRef? page;

  final List<PostMedia> media;

  /// Emoji de la réaction du viewer sur ce post — null s'il n'a pas réagi.
  final String? viewerReaction;

  /// Le viewer a-t-il enregistré ce post dans une de ses collections ?
  final bool viewerSaved;

  /// Les 3 premiers emojis par nombre de réactions décroissant.
  final List<EmojiCount> reactionsTop;

  factory FeedPost.fromJson(Map<String, dynamic> json) {
    return FeedPost(
      id: json['id'] as String,
      typeSlug: json['typeSlug'] as String,
      title: json['title'] as String?,
      body: (json['body'] as String?) ?? '',
      city: json['city'] as String?,
      location: json['location'] == null
          ? null
          : GeoPoint.fromJson(json['location'] as Map<String, dynamic>),
      mapExpiresAt: json['mapExpiresAt'] == null
          ? null
          : DateTime.parse(json['mapExpiresAt'] as String),
      urlSlug: (json['urlSlug'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'active',
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      reactionCount: (json['reactionCount'] as num?)?.toInt() ?? 0,
      commentCount: (json['commentCount'] as num?)?.toInt() ?? 0,
      shareCount: (json['shareCount'] as num?)?.toInt() ?? 0,
      saveCount: (json['saveCount'] as num?)?.toInt() ?? 0,
      author: PostAuthor.fromJson(json['author'] as Map<String, dynamic>),
      page: json['page'] == null
          ? null
          : PostPageRef.fromJson(json['page'] as Map<String, dynamic>),
      media: ((json['media'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PostMedia.fromJson)
          .toList(),
      viewerReaction: json['viewerReaction'] as String?,
      viewerSaved: (json['viewerSaved'] as bool?) ?? false,
      reactionsTop: ((json['reactionsTop'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(EmojiCount.fromJson)
          .toList(),
    );
  }

  /// Copie modifiée — seuls les champs susceptibles de changer après une
  /// interaction ou une édition sont exposés. [viewerReaction] et [title]
  /// étant nullables, ils utilisent le sentinel « absent » pour distinguer
  /// « inchangé » de « remis à null ».
  FeedPost copyWith({
    Object? title = _champAbsent,
    String? body,
    String? status,
    DateTime? updatedAt,
    int? reactionCount,
    int? commentCount,
    int? shareCount,
    int? saveCount,
    Object? viewerReaction = _champAbsent,
    bool? viewerSaved,
    List<EmojiCount>? reactionsTop,
  }) {
    return FeedPost(
      id: id,
      typeSlug: typeSlug,
      title: identical(title, _champAbsent) ? this.title : title as String?,
      body: body ?? this.body,
      city: city,
      location: location,
      mapExpiresAt: mapExpiresAt,
      urlSlug: urlSlug,
      status: status ?? this.status,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      reactionCount: reactionCount ?? this.reactionCount,
      commentCount: commentCount ?? this.commentCount,
      shareCount: shareCount ?? this.shareCount,
      saveCount: saveCount ?? this.saveCount,
      author: author,
      page: page,
      media: media,
      viewerReaction: identical(viewerReaction, _champAbsent)
          ? this.viewerReaction
          : viewerReaction as String?,
      viewerSaved: viewerSaved ?? this.viewerSaved,
      reactionsTop: reactionsTop ?? this.reactionsTop,
    );
  }
}

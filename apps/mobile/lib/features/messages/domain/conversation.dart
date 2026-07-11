import '../../../core/api/models/post_author.dart';
import 'message_chat.dart';

/// Référence LÉGÈRE de l'annonce d'une conversation (forme du contrat CP2.3) :
/// de quoi afficher l'en-tête du fil et naviguer vers le détail. `status`
/// permet de griser une annonce masquée/supprimée (le fil reste consultable).
class ConversationListingRef {
  const ConversationListingRef({
    required this.id,
    required this.title,
    required this.urlSlug,
    required this.status,
    required this.coverThumbnailUrl,
  });

  final String id;
  final String title;
  final String urlSlug;
  final String status;
  final String? coverThumbnailUrl;

  bool get estActive => status == 'active';

  factory ConversationListingRef.fromJson(Map<String, dynamic> json) {
    return ConversationListingRef(
      id: json['id'] as String,
      title: (json['title'] as String?) ?? '',
      urlSlug: (json['urlSlug'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'active',
      coverThumbnailUrl: json['coverThumbnailUrl'] as String?,
    );
  }
}

/// Forme CONVERSATION du contrat CP2.3 — carte de la liste `/messages` ET
/// en-tête de l'écran de fil : annonce (référence légère), interlocuteur
/// (forme AUTEUR publique), dernier message, non-lus de CE fil.
class ConversationCard {
  const ConversationCard({
    required this.id,
    required this.listing,
    required this.otherParticipant,
    required this.lastMessage,
    required this.unreadCount,
    required this.lastMessageAt,
    required this.createdAt,
  });

  final String id;
  final ConversationListingRef listing;
  final PostAuthor otherParticipant;
  final MessageChat? lastMessage;
  final int unreadCount;
  final DateTime? lastMessageAt;
  final DateTime createdAt;

  factory ConversationCard.fromJson(Map<String, dynamic> json) {
    return ConversationCard(
      id: json['id'] as String,
      listing: ConversationListingRef.fromJson(
        json['listing'] as Map<String, dynamic>,
      ),
      otherParticipant: PostAuthor.fromJson(
        json['otherParticipant'] as Map<String, dynamic>,
      ),
      lastMessage: json['lastMessage'] == null
          ? null
          : MessageChat.fromJson(json['lastMessage'] as Map<String, dynamic>),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      lastMessageAt: json['lastMessageAt'] == null
          ? null
          : DateTime.parse(json['lastMessageAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

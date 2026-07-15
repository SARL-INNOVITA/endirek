import '../../../core/api/models/post_author.dart';
import '../../pages/domain/page_models.dart' show initialesDeNom;
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

/// Référence LÉGÈRE de la PAGE d'une conversation (Lot 3, D75) — miroir de
/// [ConversationListingRef] pour les fils ouverts depuis le bouton
/// « Message » d'une page restaurant/entreprise. `status` permet de griser
/// une page masquée/supprimée (le fil reste consultable).
class ConversationPageRef {
  const ConversationPageRef({
    required this.id,
    required this.name,
    required this.urlSlug,
    required this.pageType,
    required this.avatarUrl,
    required this.status,
  });

  final String id;
  final String name;
  final String urlSlug;

  /// 'restaurant' | 'business'.
  final String pageType;

  final String? avatarUrl;
  final String status;

  bool get estActive => status == 'active';

  /// Initiales du nom de la page (repli visuel sans avatar).
  String get initiales => initialesDeNom(name);

  factory ConversationPageRef.fromJson(Map<String, dynamic> json) {
    return ConversationPageRef(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      urlSlug: (json['urlSlug'] as String?) ?? '',
      pageType: (json['pageType'] as String?) ?? 'business',
      avatarUrl: json['avatarUrl'] as String?,
      status: (json['status'] as String?) ?? 'active',
    );
  }
}

/// Forme CONVERSATION du contrat (CP2.3 + pages Lot 3) — carte de la liste
/// `/messages` ET en-tête de l'écran de fil : cible du fil (annonce OU page,
/// exactement une des deux non nulle), interlocuteur (forme AUTEUR publique),
/// dernier message, non-lus de CE fil.
class ConversationCard {
  const ConversationCard({
    required this.id,
    required this.listing,
    required this.page,
    required this.otherParticipant,
    required this.lastMessage,
    required this.unreadCount,
    required this.lastMessageAt,
    required this.createdAt,
  });

  final String id;

  /// Annonce du fil (CP2.3) — null pour un fil de PAGE.
  final ConversationListingRef? listing;

  /// Page du fil (Lot 3, D75) — null pour un fil d'ANNONCE.
  final ConversationPageRef? page;

  final PostAuthor otherParticipant;
  final MessageChat? lastMessage;
  final int unreadCount;
  final DateTime? lastMessageAt;
  final DateTime createdAt;

  factory ConversationCard.fromJson(Map<String, dynamic> json) {
    return ConversationCard(
      id: json['id'] as String,
      listing: json['listing'] == null
          ? null
          : ConversationListingRef.fromJson(
              json['listing'] as Map<String, dynamic>,
            ),
      page: json['page'] == null
          ? null
          : ConversationPageRef.fromJson(
              json['page'] as Map<String, dynamic>,
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

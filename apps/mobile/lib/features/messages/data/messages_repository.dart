import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart' show apiClientProvider;
import '../domain/conversation.dart';
import '../domain/message_chat.dart';

/// Page de conversations `{ items, total, unreadConversations }`.
typedef ConversationsPage = ({
  List<ConversationCard> items,
  int total,
  int unreadConversations,
});

/// Page de messages `{ items, total }` — du plus récent au plus ancien
/// (contrat serveur : le client inverse pour l'affichage chronologique).
typedef MessagesPage = ({List<MessageChat> items, int total});

/// Accès aux endpoints conversations du contrat CP2.3.
final messagesRepositoryProvider = Provider<MessagesRepository>((ref) {
  return MessagesRepository(ref.watch(apiClientProvider));
});

class MessagesRepository {
  const MessagesRepository(this._api);

  final ApiClient _api;

  /// Mes conversations, triées par activité (GET /conversations).
  Future<ConversationsPage> chargerConversations({
    int limit = 20,
    int offset = 0,
  }) async {
    final reponse = await _api.get('/conversations', queryParameters: {
      'limit': limit,
      'offset': offset,
    });
    final data = reponse.data as Map<String, dynamic>;
    return (
      items: ((data['items'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ConversationCard.fromJson)
          .toList(),
      total: (data['total'] as num?)?.toInt() ?? 0,
      unreadConversations:
          (data['unreadConversations'] as num?)?.toInt() ?? 0,
    );
  }

  /// Badge messagerie (GET /conversations/unread-count).
  Future<int> chargerNonLues() async {
    final reponse = await _api.get('/conversations/unread-count');
    final data = reponse.data as Map<String, dynamic>;
    return (data['unreadConversations'] as num?)?.toInt() ?? 0;
  }

  /// MA conversation existante sur une annonce, ou null si aucune (404).
  Future<ConversationCard?> chargerFilPourAnnonce(String listingId) async {
    try {
      final reponse = await _api.get('/conversations/listing/$listingId');
      return ConversationCard.fromJson(reponse.data as Map<String, dynamic>);
    } on ApiException catch (e) {
      if (e.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  /// MA conversation existante avec une PAGE (Lot 3, D75), ou null si
  /// aucune (404) — miroir de [chargerFilPourAnnonce].
  Future<ConversationCard?> chargerFilPourPage(String pageId) async {
    try {
      final reponse = await _api.get('/conversations/page/$pageId');
      return ConversationCard.fromJson(reponse.data as Map<String, dynamic>);
    } on ApiException catch (e) {
      if (e.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  /// Détail d'un fil (GET /conversations/:id).
  Future<ConversationCard> chargerConversation(String id) async {
    final reponse = await _api.get('/conversations/$id');
    return ConversationCard.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Démarre (ou reprend) le fil sur une annonce OU une page + PREMIER
  /// message (POST /conversations — get-or-create). Exactement UNE des deux
  /// cibles [listingId]/[pageId] doit être fournie (contrat D75).
  Future<({ConversationCard conversation, MessageChat message})>
      demarrerConversation({
    String? listingId,
    String? pageId,
    required String body,
  }) async {
    final reponse = await _api.post('/conversations', data: {
      'listingId': ?listingId,
      'pageId': ?pageId,
      'body': body,
    });
    final data = reponse.data as Map<String, dynamic>;
    return (
      conversation: ConversationCard.fromJson(
        data['conversation'] as Map<String, dynamic>,
      ),
      message: MessageChat.fromJson(data['message'] as Map<String, dynamic>),
    );
  }

  /// Messages d'un fil, du plus récent au plus ancien
  /// (GET /conversations/:id/messages).
  Future<MessagesPage> chargerMessages(
    String conversationId, {
    int limit = 50,
    int offset = 0,
  }) async {
    final reponse = await _api
        .get('/conversations/$conversationId/messages', queryParameters: {
      'limit': limit,
      'offset': offset,
    });
    final data = reponse.data as Map<String, dynamic>;
    return (
      items: ((data['items'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MessageChat.fromJson)
          .toList(),
      total: (data['total'] as num?)?.toInt() ?? 0,
    );
  }

  /// Envoie un message dans un fil existant
  /// (POST /conversations/:id/messages).
  Future<MessageChat> envoyerMessage(
    String conversationId,
    String body,
  ) async {
    final reponse = await _api.post(
      '/conversations/$conversationId/messages',
      data: {'body': body},
    );
    return MessageChat.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Marque le fil comme lu (PATCH /conversations/:id/read) — retourne le
  /// badge global à jour.
  Future<int> marquerLu(String conversationId) async {
    final reponse = await _api.patch('/conversations/$conversationId/read');
    final data = reponse.data as Map<String, dynamic>;
    return (data['unreadConversations'] as num?)?.toInt() ?? 0;
  }
}

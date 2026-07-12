import 'package:endirek_mobile/features/messages/domain/conversation.dart';
import 'package:endirek_mobile/features/messages/domain/message_chat.dart';
import 'package:flutter_test/flutter_test.dart';

/// Modèles de la messagerie (CP2.3) : parsing des formes CONVERSATION et
/// MESSAGE du contrat, y compris les cas limites (dernier message absent,
/// annonce indisponible).
void main() {
  group('MessageChat', () {
    test('parse la forme MESSAGE', () {
      final message = MessageChat.fromJson({
        'id': 'm1',
        'conversationId': 'c1',
        'senderId': 'u4',
        'body': 'Bonjour ! Votre panier péi est-il toujours disponible ?',
        'createdAt': '2026-07-11T10:00:00.000Z',
      });
      expect(message.conversationId, 'c1');
      expect(message.senderId, 'u4');
      expect(message.body, contains('panier péi'));
    });

    test('message masqué par la modération → estMasque (CP2.5)', () {
      final message = MessageChat.fromJson({
        'id': 'm2',
        'conversationId': 'c1',
        'senderId': 'u11',
        'body': 'Message masqué par la modération.',
        'status': 'hidden',
        'createdAt': '2026-07-11T10:05:00.000Z',
      });
      expect(message.status, 'hidden');
      expect(message.estMasque, isTrue);
    });

    test('champ status absent → repli active, non masqué', () {
      final message = MessageChat.fromJson({
        'id': 'm3',
        'conversationId': 'c1',
        'senderId': 'u4',
        'body': 'Le panier est toujours disponible ?',
        'createdAt': '2026-07-11T10:06:00.000Z',
      });
      expect(message.status, 'active');
      expect(message.estMasque, isFalse);
    });
  });

  group('ConversationCard', () {
    Map<String, dynamic> json({Object? lastMessage, String status = 'active'}) {
      return {
        'id': 'c1',
        'listing': {
          'id': 'l4',
          'title': 'Miel de Cilaos et lentilles — panier péi',
          'urlSlug': 'miel-cilaos',
          'status': status,
          'coverThumbnailUrl': null,
        },
        'otherParticipant': {
          'id': 'u11',
          'displayName': 'Kévin Dijoux',
          'avatarUrl': null,
          'city': 'Cilaos',
        },
        'lastMessage': lastMessage,
        'unreadCount': 1,
        'lastMessageAt': '2026-07-11T10:00:00.000Z',
        'createdAt': '2026-07-11T08:00:00.000Z',
      };
    }

    test('parse une carte complète (dernier message + non-lus)', () {
      final carte = ConversationCard.fromJson(json(lastMessage: {
        'id': 'm4',
        'conversationId': 'c1',
        'senderId': 'u11',
        'body': 'Ça marche pour samedi !',
        'createdAt': '2026-07-11T10:00:00.000Z',
      }));
      expect(carte.otherParticipant.displayName, 'Kévin Dijoux');
      expect(carte.listing.estActive, isTrue);
      expect(carte.lastMessage!.body, 'Ça marche pour samedi !');
      expect(carte.unreadCount, 1);
    });

    test('dernier message absent → null ; annonce supprimée → estActive false',
        () {
      final carte =
          ConversationCard.fromJson(json(lastMessage: null, status: 'deleted'));
      expect(carte.lastMessage, isNull);
      expect(carte.listing.estActive, isFalse);
    });
  });
}

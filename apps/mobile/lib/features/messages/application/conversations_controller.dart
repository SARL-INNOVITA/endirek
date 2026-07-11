import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../data/messages_repository.dart';
import '../domain/conversation.dart';
import 'messages_unread_controller.dart';

/// État de la liste des conversations (/messages).
class ConversationsEtat {
  const ConversationsEtat({
    this.conversations = const [],
    this.total = 0,
    this.chargement = false,
    this.initialise = false,
    this.erreur,
  });

  final List<ConversationCard> conversations;
  final int total;
  final bool chargement;
  final bool initialise;
  final String? erreur;

  ConversationsEtat copierAvec({
    List<ConversationCard>? conversations,
    int? total,
    bool? chargement,
    bool? initialise,
    String? erreur,
    bool effacerErreur = false,
  }) {
    return ConversationsEtat(
      conversations: conversations ?? this.conversations,
      total: total ?? this.total,
      chargement: chargement ?? this.chargement,
      initialise: initialise ?? this.initialise,
      erreur: effacerErreur ? null : (erreur ?? this.erreur),
    );
  }
}

/// Liste de MES conversations, triée par activité côté serveur. Rechargée à
/// chaque ouverture de l'écran (+ pull-to-refresh) et invalidée par le pont
/// temps réel à l'arrivée d'un message (si l'écran est monté, il se met à
/// jour tout seul).
final conversationsControllerProvider =
    NotifierProvider<ConversationsController, ConversationsEtat>(
  ConversationsController.new,
);

class ConversationsController extends Notifier<ConversationsEtat> {
  @override
  ConversationsEtat build() => const ConversationsEtat();

  MessagesRepository get _repo => ref.read(messagesRepositoryProvider);

  /// (Re)charge la première page — met aussi le badge global à jour (le
  /// serveur renvoie `unreadConversations` avec la liste).
  Future<void> rafraichir() async {
    state = state.copierAvec(chargement: true, effacerErreur: true);
    try {
      // Une page large suffit au MVP (peu de fils par utilisateur) — la
      // pagination viendra avec l'usage réel.
      final page = await _repo.chargerConversations(limit: 50);
      state = state.copierAvec(
        conversations: page.items,
        total: page.total,
        chargement: false,
        initialise: true,
      );
      ref
          .read(messagerieNonLuesProvider.notifier)
          .definir(page.unreadConversations);
    } on ApiException catch (e) {
      state = state.copierAvec(
        chargement: false,
        initialise: true,
        erreur: e.message,
      );
    }
  }

  /// Remise à zéro (déconnexion).
  void reinitialiser() => state = const ConversationsEtat();
}

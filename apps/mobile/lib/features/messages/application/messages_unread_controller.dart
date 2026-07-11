import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../data/messages_repository.dart';

/// Badge GLOBAL de la messagerie : nombre de conversations avec au moins un
/// message non lu (icône du header — CP2.3). Alimenté par trois voies
/// convergentes, miroir exact du badge de la cloche :
/// - les écrans messagerie (après chargement / marquage lu — le serveur
///   renvoie le compteur absolu) ;
/// - le socket temps réel ('message.created' porte `unreadConversations`) ;
/// - le POLLING de repli (GET /conversations/unread-count ~45 s quand le
///   socket est indisponible).
final messagerieNonLuesProvider =
    NotifierProvider<MessagerieNonLuesController, int>(
  MessagerieNonLuesController.new,
);

class MessagerieNonLuesController extends Notifier<int> {
  @override
  int build() => 0;

  MessagesRepository get _repo => ref.read(messagesRepositoryProvider);

  /// Fixe la valeur exacte (compteur absolu du serveur). Bornée à ≥ 0.
  void definir(int valeur) {
    state = valeur < 0 ? 0 : valeur;
  }

  /// Rafraîchit depuis l'API (polling de repli, démarrage de session).
  /// Silencieux en cas d'erreur réseau : le badge n'est jamais bloquant.
  Future<void> rafraichir() async {
    try {
      definir(await _repo.chargerNonLues());
    } on ApiException {
      // On conserve la dernière valeur connue.
    }
  }

  /// Remet à zéro (déconnexion).
  void reinitialiser() => state = 0;
}

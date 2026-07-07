import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../data/notifications_repository.dart';

/// Compteur GLOBAL de notifications non lues — source du badge de la cloche
/// (header). Alimenté par trois voies convergentes :
/// - l'écran Notifications (après un chargement / une action) ;
/// - le socket temps réel ('notification.created' porte le compteur absolu
///   `unreadCount` du serveur → definir()) ;
/// - le POLLING de repli (GET /notifications/unread-count toutes les ~45 s en
///   avant-plan, quand le socket est indisponible).
///
/// L'état est un simple entier ≥ 0 (jamais négatif après décrément).
final unreadCountProvider =
    NotifierProvider<UnreadCountController, int>(UnreadCountController.new);

class UnreadCountController extends Notifier<int> {
  @override
  int build() => 0;

  NotificationsRepository get _repo =>
      ref.read(notificationsRepositoryProvider);

  /// Fixe la valeur exacte (après un GET). Bornée à ≥ 0.
  void definir(int valeur) {
    state = valeur < 0 ? 0 : valeur;
  }

  /// Décrémente d'une unité sans passer sous zéro (marquage lu optimiste).
  void decrementer() => state = state > 0 ? state - 1 : 0;

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

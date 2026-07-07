import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/map/application/map_controller.dart';
import '../../features/notifications/application/notifications_controller.dart';
import '../../features/notifications/application/unread_count_controller.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_state.dart';
import 'realtime_service.dart';

/// Intervalle du POLLING de repli (avant-plan) quand le socket n'est pas
/// connecté : le badge de non-lues est rafraîchi périodiquement pour ne pas
/// dépendre du seul temps réel. ~45 s = compromis fraîcheur / charge.
const Duration _intervallePolling = Duration(seconds: 45);

/// Pont temps réel de l'application — orchestre le cycle de vie du socket et le
/// fallback polling en fonction de l'état d'authentification.
///
/// Responsabilités :
/// - à la CONNEXION de l'utilisateur : ouvre le socket, charge le compteur de
///   non-lues, démarre le timer de polling de repli ;
/// - à la DÉCONNEXION : ferme le socket, arrête le polling, remet le badge à 0 ;
/// - route les événements socket vers les contrôleurs (badge, écran notifs,
///   carte) ;
/// - FALLBACK : quand le socket n'est pas connecté au réveil du timer, il
///   rafraîchit le compteur via REST (GET /notifications/unread-count).
///
/// Gardé en vie par l'app root (un `ref.watch(realtimeBridgeProvider)` dans le
/// widget racine) pour qu'il fonctionne quel que soit l'écran affiché.
final realtimeBridgeProvider =
    NotifierProvider<RealtimeBridge, void>(RealtimeBridge.new);

class RealtimeBridge extends Notifier<void> {
  StreamSubscription<RealtimeEvent>? _abonnement;
  Timer? _pollingTimer;
  bool _actif = false;

  @override
  void build() {
    // Réagit à chaque changement d'état d'auth (connexion / déconnexion).
    ref.listen<AuthState>(authControllerProvider, (precedent, courant) {
      _surChangementAuth(courant);
    });
    // État initial (au cas où l'utilisateur est déjà connecté à la création).
    _surChangementAuth(ref.read(authControllerProvider));

    ref.onDispose(_arreter);
  }

  RealtimeService get _service => ref.read(realtimeServiceProvider);

  void _surChangementAuth(AuthState auth) {
    if (auth is AuthSignedIn) {
      _demarrer();
    } else {
      _arreter();
    }
  }

  /// Démarre le temps réel + le polling de repli (idempotent).
  void _demarrer() {
    if (_actif) {
      return;
    }
    _actif = true;

    _abonnement = _service.evenements.listen(_surEvenement);
    // Connexion socket + première synchro du badge.
    unawaited(_service.connecter());
    unawaited(ref.read(unreadCountProvider.notifier).rafraichir());

    // Polling de repli : ne fait un GET que si le socket N'EST PAS connecté.
    _pollingTimer = Timer.periodic(_intervallePolling, (_) {
      if (!_service.connecte) {
        unawaited(ref.read(unreadCountProvider.notifier).rafraichir());
      }
    });
  }

  /// Arrête le temps réel + le polling et réinitialise le badge (déconnexion).
  void _arreter() {
    if (!_actif) {
      return;
    }
    _actif = false;

    _pollingTimer?.cancel();
    _pollingTimer = null;
    unawaited(_abonnement?.cancel());
    _abonnement = null;
    unawaited(_service.deconnecter());
    ref.read(unreadCountProvider.notifier).reinitialiser();
  }

  /// Route un événement temps réel vers les contrôleurs concernés.
  void _surEvenement(RealtimeEvent evenement) {
    switch (evenement) {
      case NotificationRecue(:final notification, :final unreadCount):
        // Le serveur envoie le compteur à jour : on l'applique tel quel.
        ref.read(unreadCountProvider.notifier).definir(unreadCount);
        // Si l'écran notifs est monté/chargé, insère en tête.
        ref
            .read(notificationsControllerProvider.notifier)
            .insererEnTete(notification);
      case CarteAMettreAJour():
        // Rafraîchit la carte SEULEMENT si elle a déjà été chargée (l'onglet a
        // été visité) — inutile de charger une carte jamais ouverte.
        final mapEtat = ref.read(mapControllerProvider);
        if (mapEtat.initialise) {
          unawaited(ref.read(mapControllerProvider.notifier).rafraichir());
        }
    }
  }
}

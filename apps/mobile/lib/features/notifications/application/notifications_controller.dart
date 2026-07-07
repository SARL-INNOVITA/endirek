import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/notification.dart';
import '../data/notifications_repository.dart';
import 'unread_count_controller.dart';

/// État de l'écran Notifications : liste + total + drapeaux d'UI.
class NotificationsState {
  const NotificationsState({
    this.items = const [],
    this.total = 0,
    this.chargement = false,
    this.initialise = false,
    this.erreur,
  });

  final List<AppNotification> items;
  final int total;
  final bool chargement;
  final bool initialise;
  final String? erreur;

  NotificationsState copyWith({
    List<AppNotification>? items,
    int? total,
    bool? chargement,
    bool? initialise,
    Object? erreur = _absent,
  }) {
    return NotificationsState(
      items: items ?? this.items,
      total: total ?? this.total,
      chargement: chargement ?? this.chargement,
      initialise: initialise ?? this.initialise,
      erreur: identical(erreur, _absent) ? this.erreur : erreur as String?,
    );
  }

  static const Object _absent = Object();
}

/// Contrôleur de l'écran Notifications. Charge GET /notifications, gère le
/// « marquer lu » (optimiste) et « tout marquer lu », et reçoit les nouvelles
/// notifications temps réel (insertion en tête).
///
/// Le compteur de non-lues global est porté par [unreadCountProvider] (badge
/// de la cloche) : ce contrôleur le tient à jour à chaque action locale pour
/// éviter tout aller-retour réseau.
final notificationsControllerProvider =
    NotifierProvider<NotificationsController, NotificationsState>(
  NotificationsController.new,
);

class NotificationsController extends Notifier<NotificationsState> {
  @override
  NotificationsState build() => const NotificationsState();

  NotificationsRepository get _repo =>
      ref.read(notificationsRepositoryProvider);

  UnreadCountController get _badge =>
      ref.read(unreadCountProvider.notifier);

  /// Premier chargement (idempotent tant qu'aucune erreur n'est survenue).
  Future<void> chargerSiBesoin() async {
    if (state.initialise && state.erreur == null) {
      return;
    }
    await charger();
  }

  /// (Re)charge la liste depuis l'API et synchronise le badge non-lues.
  Future<void> charger() async {
    state = state.copyWith(chargement: true, erreur: null);
    try {
      final NotificationsPage page = await _repo.charger();
      state = state.copyWith(
        items: page.items,
        total: page.total,
        chargement: false,
        initialise: true,
        erreur: null,
      );
      _badge.definir(page.unreadCount);
    } on ApiException catch (e) {
      state = state.copyWith(chargement: false, erreur: e.message);
    }
  }

  /// Tirer-pour-rafraîchir.
  Future<void> rafraichir() => charger();

  /// Marque une notification comme lue (optimiste : l'UI et le badge sont mis à
  /// jour immédiatement, l'appel réseau suit). Idempotent : ne fait rien si
  /// elle est déjà lue.
  Future<void> marquerLue(String id) async {
    final int index = state.items.indexWhere((n) => n.id == id);
    if (index < 0 || state.items[index].lue) {
      return;
    }
    final List<AppNotification> copie = [...state.items];
    copie[index] = copie[index].marquerLue(DateTime.now());
    state = state.copyWith(items: copie);
    _badge.decrementer();
    try {
      await _repo.marquerLue(id);
    } on ApiException {
      // Échec réseau : on recharge pour resynchroniser l'état réel.
      await charger();
    }
  }

  /// Marque toutes les notifications comme lues (optimiste).
  Future<void> toutMarquerLu() async {
    if (state.items.every((n) => n.lue)) {
      return;
    }
    final DateTime maintenant = DateTime.now();
    state = state.copyWith(
      items: state.items.map((n) => n.marquerLue(maintenant)).toList(),
    );
    _badge.definir(0);
    try {
      await _repo.toutMarquerLu();
    } on ApiException {
      await charger();
    }
  }

  /// Insère une notification reçue en temps réel en tête de liste (si l'écran
  /// a déjà été chargé). Évite les doublons si l'id est déjà présent.
  void insererEnTete(AppNotification notif) {
    if (!state.initialise) {
      return;
    }
    if (state.items.any((n) => n.id == notif.id)) {
      return;
    }
    state = state.copyWith(
      items: [notif, ...state.items],
      total: state.total + 1,
    );
  }
}

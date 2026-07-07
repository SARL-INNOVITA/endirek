import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/models/notification.dart';
import '../../../core/auth/auth_controller.dart' show apiClientProvider;

/// Page de notifications `{ items, total, unreadCount }` (GET /notifications).
typedef NotificationsPage = ({
  List<AppNotification> items,
  int total,
  int unreadCount,
});

/// Accès aux endpoints notifications du contrat étape 5. Toutes les routes ne
/// servent QUE les notifications de l'utilisateur courant (contrôle
/// d'ownership côté API).
final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  return NotificationsRepository(ref.watch(apiClientProvider));
});

class NotificationsRepository {
  const NotificationsRepository(this._api);

  final ApiClient _api;

  /// Mes notifications, antéchronologiques, paginées (GET /notifications).
  Future<NotificationsPage> charger({int limit = 30, int offset = 0}) async {
    final reponse = await _api.get('/notifications', queryParameters: {
      'limit': limit,
      'offset': offset,
    });
    final data = reponse.data as Map<String, dynamic>;
    return (
      items: ((data['items'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AppNotification.fromJson)
          .toList(),
      total: (data['total'] as num?)?.toInt() ?? 0,
      unreadCount: (data['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }

  /// Compteur de non-lues (GET /notifications/unread-count) — badge de la
  /// cloche + polling de repli.
  Future<int> chargerNonLues() async {
    final reponse = await _api.get('/notifications/unread-count');
    final data = reponse.data as Map<String, dynamic>;
    return (data['unreadCount'] as num?)?.toInt() ?? 0;
  }

  /// Marque une notification comme lue (PATCH /notifications/:id/read → 204,
  /// idempotent). 404 si elle n'appartient pas au user courant (remonte en
  /// ApiException).
  Future<void> marquerLue(String id) async {
    await _api.patch('/notifications/$id/read');
  }

  /// Marque toutes MES notifications comme lues (PATCH /notifications/read-all
  /// → 204).
  Future<void> toutMarquerLu() async {
    await _api.patch('/notifications/read-all');
  }
}

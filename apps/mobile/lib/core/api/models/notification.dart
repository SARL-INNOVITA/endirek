/// Forme NOTIFICATION du contrat d'API étape 5 (GET /notifications et event
/// temps réel 'notification.created') : `{ id, type, payload, readAt,
/// createdAt }`.
///
/// `type` est une chaîne libre côté client (le référentiel est piloté par le
/// backend) — les libellés français et les icônes sont construits par repli
/// sûr, jamais bloquant sur un type inconnu (voir [libelle]).
///
/// `payload` est un objet JSON opaque dont les clés dépendent du type
/// (`postId`, `fromDisplayName`, `emoji`, `status`, `targetType`…). On lit
/// ses champs de façon défensive.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.payload,
    required this.readAt,
    required this.createdAt,
  });

  final String id;
  final String type;
  final Map<String, dynamic> payload;

  /// Date de lecture — null tant que la notification n'a pas été lue.
  final DateTime? readAt;

  final DateTime createdAt;

  bool get lue => readAt != null;

  /// Identifiant du post concerné, s'il figure dans le payload (comment,
  /// reply, reaction) — cible de navigation au tap. Les libellés et l'auteur
  /// de l'action sont construits par notification_presentation.dart.
  String? get postId {
    final dynamic valeur = payload['postId'];
    return valeur is String && valeur.isNotEmpty ? valeur : null;
  }

  /// Identifiant du deal concerné (type 'deal' — CP2.4) : cible de
  /// navigation au tap vers /deals/:id.
  String? get dealId {
    final dynamic valeur = payload['dealId'];
    return valeur is String && valeur.isNotEmpty ? valeur : null;
  }

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      type: (json['type'] as String?) ?? 'system',
      payload: (json['payload'] as Map?)?.cast<String, dynamic>() ?? const {},
      readAt: json['readAt'] == null
          ? null
          : DateTime.parse(json['readAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  /// Copie marquée comme lue (mise à jour optimiste après PATCH .../read).
  AppNotification marquerLue(DateTime date) {
    return AppNotification(
      id: id,
      type: type,
      payload: payload,
      readAt: readAt ?? date,
      createdAt: createdAt,
    );
  }
}

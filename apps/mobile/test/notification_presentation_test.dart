// Test de construction des libellés français de notification depuis
// type + payload (features/notifications/domain). Fonctions pures, aucun
// contexte ni réseau.

import 'package:flutter_test/flutter_test.dart';

import 'package:endirek_mobile/core/api/models/notification.dart';
import 'package:endirek_mobile/features/notifications/domain/notification_presentation.dart';

AppNotification _notif(
  String type, {
  Map<String, dynamic> payload = const {},
  DateTime? readAt,
}) {
  return AppNotification(
    id: 'n1',
    type: type,
    payload: payload,
    readAt: readAt,
    createdAt: DateTime(2026, 1, 1),
  );
}

void main() {
  test('comment → « X a commenté votre publication »', () {
    final n = _notif('comment', payload: {'fromDisplayName': 'Marie'});
    expect(libelleNotification(n), 'Marie a commenté votre publication');
  });

  test('reply → « X a répondu à votre commentaire »', () {
    final n = _notif('reply', payload: {'fromDisplayName': 'Kevin'});
    expect(libelleNotification(n), 'Kevin a répondu à votre commentaire');
  });

  test('reaction → « X a réagi à votre publication » + emoji', () {
    final n = _notif(
      'reaction',
      payload: {'fromDisplayName': 'Léa', 'emoji': '👍'},
    );
    expect(libelleNotification(n), 'Léa a réagi à votre publication 👍');
  });

  test('reaction sans emoji → libellé sans suffixe', () {
    final n = _notif('reaction', payload: {'fromDisplayName': 'Léa'});
    expect(libelleNotification(n), 'Léa a réagi à votre publication');
  });

  test('report_handled → libellé fixe (indépendant du payload)', () {
    final n = _notif(
      'report_handled',
      payload: {'reportId': 'r1', 'status': 'resolved', 'targetType': 'post'},
    );
    expect(libelleNotification(n), 'Votre signalement a été traité');
  });

  test('system → « Notification système »', () {
    expect(libelleNotification(_notif('system')), 'Notification système');
  });

  test('system affiche le titre puis le message du payload', () {
    expect(
      libelleNotification(
        _notif(
          'system',
          payload: {'title': 'Info Endirek', 'message': 'Message de secours'},
        ),
      ),
      'Info Endirek',
    );
    expect(
      libelleNotification(
        _notif('system', payload: {'message': 'Maintenance ce soir'}),
      ),
      'Maintenance ce soir',
    );
  });

  test('type inconnu retombe sur le libellé système (jamais d\'erreur)', () {
    expect(
      libelleNotification(_notif('type_futur_inconnu')),
      'Notification système',
    );
  });

  test('auteur manquant → repli « Quelqu\'un »', () {
    expect(
      libelleNotification(_notif('comment')),
      'Quelqu\'un a commenté votre publication',
    );
    // Un fromDisplayName vide/blanc est aussi remplacé par le repli.
    expect(
      libelleNotification(
        _notif('comment', payload: {'fromDisplayName': '  '}),
      ),
      'Quelqu\'un a commenté votre publication',
    );
  });

  test('presentationNotification fournit libellé + icône + couleur', () {
    final p = presentationNotification(
      _notif('reaction', payload: {'fromDisplayName': 'Léa', 'emoji': '❤️'}),
    );
    expect(p.libelle, 'Léa a réagi à votre publication ❤️');
    // Icône et couleur non nulles (valeurs exactes non figées ici).
    expect(p.icone, isNotNull);
    expect(p.couleur, isNotNull);
  });

  test('AppNotification.postId lit le payload et le marque lu', () {
    final n = _notif('comment', payload: {'postId': 'p42'});
    expect(n.postId, 'p42');
    expect(n.lue, isFalse);
    final lu = n.marquerLue(DateTime(2026, 2, 1));
    expect(lu.lue, isTrue);
    // postId sans valeur → null.
    expect(_notif('system').postId, isNull);
  });
}

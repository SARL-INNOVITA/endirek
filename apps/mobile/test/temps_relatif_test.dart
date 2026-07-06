// Tests du helper « temps relatif » français du fil (référence figée).

import 'package:flutter_test/flutter_test.dart';

import 'package:endirek_mobile/core/utils/temps_relatif.dart';

void main() {
  final DateTime reference = DateTime(2026, 7, 6, 12, 0);

  String depuis(Duration ecart) =>
      tempsRelatif(reference.subtract(ecart), reference: reference);

  test('moins d\'une minute → « à l\'instant »', () {
    expect(depuis(const Duration(seconds: 20)), "à l'instant");
    // Horloges désynchronisées (date dans le futur) : pas de valeur négative.
    expect(
      tempsRelatif(
        reference.add(const Duration(minutes: 3)),
        reference: reference,
      ),
      "à l'instant",
    );
  });

  test('minutes puis heures puis jours', () {
    expect(depuis(const Duration(minutes: 37)), 'il y a 37 min');
    expect(depuis(const Duration(hours: 2, minutes: 10)), 'il y a 2 h');
    expect(depuis(const Duration(days: 3)), 'il y a 3 j');
  });

  test('au-delà d\'une semaine → date courte', () {
    expect(depuis(const Duration(days: 30)), 'le 6 juin');
    expect(
      tempsRelatif(DateTime(2025, 5, 12), reference: reference),
      'le 12 mai 2025',
    );
  });
}

// Tests du formatage de la VALEUR d'une annonce Dealplace (fixe / fourchette).
//
// La typographie française utilise des espaces INSÉCABLES : on référence les
// constantes du module (plutôt que des espaces littérales) pour des
// assertions exactes et lisibles.

import 'package:flutter_test/flutter_test.dart';

import 'package:endirek_mobile/features/dealplace/domain/dealplace_value.dart';

void main() {
  // Abréviations locales des séparateurs insécables du module.
  const String fine = espaceFineInsecable; // milliers (U+202F)
  const String nbsp = espaceInsecable; // avant symbole (U+00A0)
  const String tiret = separateurFourchette; // fourchette (« – »)

  group('formaterValeurAnnonce', () {
    test('valeur fixe → « montant € »', () {
      expect(
        formaterValeurAnnonce(valueKind: 'fixed', valueMin: 500),
        '500$nbsp€',
      );
    });

    test('valeur fixe : le séparateur de milliers est une espace insécable', () {
      expect(
        formaterValeurAnnonce(valueKind: 'fixed', valueMin: 1500),
        '1${fine}500$nbsp€',
      );
      expect(
        formaterValeurAnnonce(valueKind: 'fixed', valueMin: 1234567),
        '1${fine}234${fine}567$nbsp€',
      );
    });

    test('fourchette → « min € – max € »', () {
      expect(
        formaterValeurAnnonce(
          valueKind: 'range',
          valueMin: 500,
          valueMax: 1000,
        ),
        '500$nbsp€${tiret}1${fine}000$nbsp€',
      );
    });

    test('fourchette sans borne haute → repli sur la valeur fixe', () {
      expect(
        formaterValeurAnnonce(valueKind: 'range', valueMin: 500),
        '500$nbsp€',
      );
    });

    test('valeur nulle reste affichable', () {
      expect(
        formaterValeurAnnonce(valueKind: 'fixed', valueMin: 0),
        '0$nbsp€',
      );
    });

    test('devise non EUR : le code sert de symbole', () {
      expect(
        formaterValeurAnnonce(
          valueKind: 'fixed',
          valueMin: 100,
          currency: 'CHF',
        ),
        '100${nbsp}CHF',
      );
    });

    test('devise USD → symbole \$', () {
      expect(
        formaterValeurAnnonce(
          valueKind: 'fixed',
          valueMin: 100,
          currency: 'USD',
        ),
        '100$nbsp\$',
      );
    });
  });
}

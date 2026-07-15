import 'package:endirek_mobile/features/dealplace/domain/dealplace_value.dart'
    show espaceFineInsecable, espaceInsecable;
import 'package:endirek_mobile/features/pages/domain/formatage_pages.dart';
import 'package:endirek_mobile/features/pages/domain/page_models.dart';
import 'package:flutter_test/flutter_test.dart';

/// Formatage français des PAGES (Lot 3) : prix en centimes, ligne de prix
/// d'un plat, saisies en euros, tailles de fichier, plages horaires, dates
/// courtes/d'événement, période d'offre et initiales de nom de page.
void main() {
  // Alias courts des espaces typographiques (mêmes constantes que
  // dealplace_value_test.dart).
  const String fine = espaceFineInsecable;
  const String nbsp = espaceInsecable;

  group('formaterPrixCentimes', () {
    test('prix simples : 1250 → « 12,50 € », 700 → « 7,00 € »', () {
      expect(formaterPrixCentimes(1250), '12,50$nbsp€');
      expect(formaterPrixCentimes(700), '7,00$nbsp€');
    });

    test('milliers séparés par une espace fine insécable', () {
      expect(formaterPrixCentimes(123456), '1${fine}234,56$nbsp€');
    });

    test('zéro et négatif', () {
      expect(formaterPrixCentimes(0), '0,00$nbsp€');
      expect(formaterPrixCentimes(-950), '-9,50$nbsp€');
    });
  });

  group('formaterLignePrixPlat', () {
    test('deux prix → « À emporter … | Sur place … »', () {
      expect(
        formaterLignePrixPlat(aEmporterCents: 700, surPlaceCents: 1200),
        'À emporter 7,00$nbsp€ | Sur place 12,00$nbsp€',
      );
    });

    test('un seul prix → un seul segment', () {
      expect(
        formaterLignePrixPlat(aEmporterCents: 750, surPlaceCents: null),
        'À emporter 7,50$nbsp€',
      );
      expect(
        formaterLignePrixPlat(aEmporterCents: null, surPlaceCents: 1150),
        'Sur place 11,50$nbsp€',
      );
    });

    test('aucun prix → null', () {
      expect(
        formaterLignePrixPlat(aEmporterCents: null, surPlaceCents: null),
        isNull,
      );
    });
  });

  group('centimesDepuisSaisie', () {
    test('virgule, point et entier acceptés', () {
      expect(centimesDepuisSaisie('12,50'), 1250);
      expect(centimesDepuisSaisie('12.50'), 1250);
      expect(centimesDepuisSaisie('12'), 1200);
      expect(centimesDepuisSaisie('7,5'), 750);
    });

    test('saisies invalides → null', () {
      expect(centimesDepuisSaisie(''), isNull);
      expect(centimesDepuisSaisie('abc'), isNull);
      expect(centimesDepuisSaisie('12,505'), isNull);
      expect(centimesDepuisSaisie('-3'), isNull);
    });
  });

  group('saisieDepuisCentimes', () {
    test('pré-remplissage des champs d\'édition', () {
      expect(saisieDepuisCentimes(1250), '12,50');
      expect(saisieDepuisCentimes(700), '7,00');
      expect(saisieDepuisCentimes(5), '0,05');
    });
  });

  group('formaterTailleFichier', () {
    test('Ko et Mo à la française', () {
      expect(formaterTailleFichier(870400), '850${nbsp}Ko');
      expect(formaterTailleFichier(1258291), '1,2${nbsp}Mo');
      expect(formaterTailleFichier(500), '1${nbsp}Ko');
    });
  });

  group('formaterPlageHoraire', () {
    test('tiret demi-cadratin entre les bornes', () {
      expect(formaterPlageHoraire('11:30', '14:30'), '11:30 – 14:30');
    });
  });

  group('formaterDateCourte', () {
    final DateTime reference = DateTime(2026, 7, 15);

    test('année courante omise, autre année affichée', () {
      expect(
        formaterDateCourte(DateTime(2026, 7, 4), reference: reference),
        '04/07',
      );
      expect(
        formaterDateCourte(DateTime(2025, 12, 31), reference: reference),
        '31/12/2025',
      );
    });
  });

  group('formaterDateEvenement', () {
    final DateTime reference = DateTime(2026, 7, 15);

    test('« ven. 17 juil. à 19:00 » (année courante omise)', () {
      expect(
        formaterDateEvenement(
          DateTime(2026, 7, 17, 19, 0),
          reference: reference,
        ),
        'ven. 17 juil. à 19:00',
      );
    });

    test('année ajoutée quand différente', () {
      expect(
        formaterDateEvenement(
          DateTime(2027, 5, 17, 9, 5),
          reference: reference,
        ),
        'lun. 17 mai 2027 à 09:05',
      );
    });
  });

  group('libellePeriodeOffre', () {
    // Référence FIGÉE : les tests ne dépendent pas de l'horloge murale
    // (l'année courante conditionne l'affichage de l'année des dates).
    final DateTime reference = DateTime(2026, 7, 15);

    PageOffer offre({DateTime? debut, DateTime? fin}) {
      return PageOffer(
        id: 'o1',
        title: 'Offre du midi',
        description: '',
        imageUrl: null,
        startsAt: debut,
        endsAt: fin,
        isCurrent: true,
        createdAt: DateTime(2026, 7, 1),
      );
    }

    test('les quatre formes de période', () {
      expect(
        libellePeriodeOffre(
          offre(debut: DateTime(2026, 5, 12), fin: DateTime(2026, 6, 30)),
          reference: reference,
        ),
        'Du 12/05 au 30/06',
      );
      expect(
        libellePeriodeOffre(
          offre(fin: DateTime(2026, 6, 30)),
          reference: reference,
        ),
        'Jusqu\'au 30/06',
      );
      expect(
        libellePeriodeOffre(
          offre(debut: DateTime(2026, 5, 12)),
          reference: reference,
        ),
        'Depuis le 12/05',
      );
      expect(
        libellePeriodeOffre(offre(), reference: reference),
        'Offre permanente',
      );
    });

    test('année affichée quand elle diffère de la référence', () {
      expect(
        libellePeriodeOffre(
          offre(debut: DateTime(2026, 5, 12)),
          reference: DateTime(2027, 1, 10),
        ),
        'Depuis le 12/05/2026',
      );
    });
  });

  group('initialesDeNom', () {
    test('mêmes règles que les initiales d\'auteur', () {
      expect(initialesDeNom('Bon Goût'), 'BG');
      expect(initialesDeNom('Ti Kaz Services'), 'TS');
      expect(initialesDeNom('Momon'), 'M');
      expect(initialesDeNom('   '), '?');
    });
  });
}

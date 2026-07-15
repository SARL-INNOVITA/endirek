import 'package:endirek_mobile/core/api/models/post_page_ref.dart';
import 'package:endirek_mobile/features/pages/domain/page_models.dart';
import 'package:flutter_test/flutter_test.dart';

/// Modèles des PAGES (Lot 3) : parsing des formes du contrat (PAGE,
/// PAGE_CARD, OwnerPageCard, DISH, MENU_DAY, OFFER, EVENT, statut
/// d'ouverture dérivé) et de la référence PostPageRef portée par les posts.
void main() {
  group('PageOpenStatus', () {
    test('parse un état congés complet', () {
      final statut = PageOpenStatus.fromJson({
        'state': 'vacation',
        'vacationUntil': '2026-08-15T00:00:00.000Z',
        'vacationMessage': 'Retour le 15 août !',
      });
      expect(statut.enConges, isTrue);
      expect(statut.estOuverte, isFalse);
      expect(statut.vacationUntil, isNotNull);
      expect(statut.vacationMessage, 'Retour le 15 août !');
    });

    test('objet vide → repli fermé', () {
      final statut = PageOpenStatus.fromJson(const {});
      expect(statut.state, 'closed');
      expect(statut.vacationUntil, isNull);
    });
  });

  group('PageCard / OwnerPageCard', () {
    final Map<String, dynamic> json = {
      'id': 'p1',
      'pageType': 'restaurant',
      'name': 'Bon Goût',
      'urlSlug': 'bon-gout',
      'avatarUrl': null,
      'city': 'Saint-Denis',
      'verified': true,
      'followersCount': 3,
      'openStatus': {'state': 'open'},
      'createdAt': '2026-07-01T08:00:00.000Z',
      'status': 'hidden',
    };

    test('parse la forme PAGE_CARD (getters dérivés compris)', () {
      final carte = PageCard.fromJson(json);
      expect(carte.estRestaurant, isTrue);
      expect(carte.libelleType, 'Restaurant');
      expect(carte.verified, isTrue);
      expect(carte.followersCount, 3);
      expect(carte.openStatus.estOuverte, isTrue);
      expect(carte.initiales, 'BG');
    });

    test('OwnerPageCard : même json + statut du propriétaire', () {
      final page = OwnerPageCard.fromJson(json);
      expect(page.carte.name, 'Bon Goût');
      expect(page.status, 'hidden');
      expect(page.estMasquee, isTrue);
    });
  });

  group('PageDetail', () {
    test('parse la forme PAGE complète', () {
      final page = PageDetail.fromJson({
        'id': 'p1',
        'pageType': 'restaurant',
        'name': 'Bon Goût',
        'urlSlug': 'bon-gout',
        'avatarUrl': null,
        'coverUrl': null,
        'city': 'Saint-Denis',
        'bio': 'Cuisine créole maison.',
        'phone': '0262 12 34 56',
        'attributes': ['Créole', 'Sur place'],
        'location': {'lat': -20.88, 'lng': 55.45},
        'verified': true,
        'followersCount': 3,
        'openStatus': {'state': 'open'},
        'hours': [
          {'weekday': 0, 'opensAt': '11:30', 'closesAt': '14:30'},
        ],
        'documents': [
          {
            'id': 'd1',
            'label': 'Carte principale',
            'url': '/uploads/carte.pdf',
            'fileSizeBytes': 1258291,
            'position': 0,
            'createdAt': '2026-07-01T08:00:00.000Z',
          },
        ],
        'owner': {
          'id': 'u13',
          'displayName': 'David Payet',
          'avatarUrl': null,
          'city': 'Saint-Denis',
        },
        'postsCount': 3,
        'status': 'active',
        'isOwner': true,
        'myFollow': false,
        'createdAt': '2026-07-01T08:00:00.000Z',
        'updatedAt': '2026-07-10T08:00:00.000Z',
      });
      expect(page.estRestaurant, isTrue);
      expect(page.attributes, ['Créole', 'Sur place']);
      expect(page.location!.lat, closeTo(-20.88, 1e-9));
      expect(page.hours.single.opensAt, '11:30');
      expect(page.documents.single.label, 'Carte principale');
      expect(page.owner.displayName, 'David Payet');
      expect(page.isOwner, isTrue);
      expect(page.myFollow, isFalse);
    });
  });

  group('Dish / MenuDay', () {
    test('parse un plat (prix en centimes, chacun nullable)', () {
      final plat = Dish.fromJson({
        'id': 'd1',
        'name': 'Rougail saucisses',
        'description': 'Riz, grains, sauce piment maison',
        'imageUrl': null,
        'priceTakeawayCents': 700,
        'priceDineInCents': null,
        'position': 0,
      });
      expect(plat.name, 'Rougail saucisses');
      expect(plat.priceTakeawayCents, 700);
      expect(plat.priceDineInCents, isNull);
    });

    test('parse un jour de menu — items vides = pas de menu', () {
      final jour = MenuDay.fromJson({
        'date': '2026-07-15',
        'items': [],
      });
      expect(jour.estVide, isTrue);
      expect(jour.dateLocale.day, 15);
      // weekday 2026-07-15 = mercredi (DateTime.weekday 3).
      expect(jour.dateLocale.weekday, DateTime.wednesday);
    });
  });

  group('PageOffer / PageEvent', () {
    test('offre sans période → permanente, isCurrent serveur', () {
      final offre = PageOffer.fromJson({
        'id': 'o1',
        'title': 'Offre du midi -10 %',
        'description': '',
        'imageUrl': null,
        'startsAt': null,
        'endsAt': null,
        'isCurrent': true,
        'createdAt': '2026-07-01T08:00:00.000Z',
      });
      expect(offre.startsAt, isNull);
      expect(offre.endsAt, isNull);
      expect(offre.isCurrent, isTrue);
    });

    test('événement : startsAt requis, timing dérivé serveur', () {
      final evenement = PageEvent.fromJson({
        'id': 'e1',
        'title': 'Soirée musique live',
        'description': 'Avec TeNöe & Friends',
        'imageUrl': null,
        'startsAt': '2026-07-17T15:00:00.000Z',
        'endsAt': null,
        'timing': 'upcoming',
        'createdAt': '2026-07-01T08:00:00.000Z',
      });
      expect(evenement.startsAt.toUtc().hour, 15);
      expect(evenement.enCours, isFalse);
      expect(evenement.estPasse, isFalse);
    });
  });

  group('PostPageRef (identité de page des posts)', () {
    test('parse la référence portée par FEED_POST et MapPostItem', () {
      final ref = PostPageRef.fromJson({
        'id': 'p1',
        'name': 'Bon Goût',
        'avatarUrl': null,
        'pageType': 'restaurant',
        'verified': true,
      });
      expect(ref.name, 'Bon Goût');
      expect(ref.pageType, 'restaurant');
      expect(ref.verified, isTrue);
      expect(ref.initiales, 'BG');
    });

    test('replis : pageType business, verified false', () {
      final ref = PostPageRef.fromJson({
        'id': 'p9',
        'name': 'Page supprimée',
      });
      expect(ref.pageType, 'business');
      expect(ref.verified, isFalse);
      expect(ref.avatarUrl, isNull);
    });
  });
}

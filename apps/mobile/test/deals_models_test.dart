import 'package:endirek_mobile/features/deals/domain/deal_models.dart';
import 'package:flutter_test/flutter_test.dart';

/// Modèles des deals (CP2.4) : parsing de la page de deal (items/steps,
/// badges serveur), de la carte et du profil Dealplace.
void main() {
  Map<String, dynamic> auteur(String nom) => {
        'id': 'u1',
        'displayName': nom,
        'avatarUrl': null,
        'city': 'Cilaos',
      };

  test('Deal.fromJson : page complète (items, steps, avis)', () {
    final deal = Deal.fromJson({
      'id': 'd1',
      'dealNumber': 345,
      'status': 'active',
      'stage': 'validations',
      'listing': {
        'id': 'l1',
        'title': 'Panier péi',
        'urlSlug': 'panier',
        'status': 'active',
      },
      'conversationId': 'c1',
      'proposerId': 'u4',
      'recipientId': 'u11',
      'otherParticipant': auteur('Kévin Dijoux'),
      'dueDate': null,
      'cancellationRequestedBy': null,
      'disputedBy': null,
      'disputeReason': null,
      'items': [
        {
          'id': 'i1',
          'providerId': 'u11',
          'kind': 'good',
          'title': 'Panier péi',
          'description': '',
          'value': 25,
          'badge': 'awaiting_validation',
          'steps': [
            {
              'id': 's1',
              'label': 'Panier remis',
              'position': 0,
              'honoredAt': '2026-07-11T10:00:00.000Z',
              'validatedAt': null,
            },
          ],
        },
      ],
      'adjustments': const [],
      'notes': const [],
      'reviews': [
        {
          'id': 'r1',
          'reviewer': auteur('Sully Boyer'),
          'revieweeId': 'u11',
          'ratingHonesty': 5,
          'ratingConformity': 4,
          'ratingKindness': 5,
          'overall': 4.67,
          'comment': 'Top !',
          'createdAt': '2026-07-11T12:00:00.000Z',
        },
      ],
      'myReviewSubmitted': false,
      'createdAt': '2026-07-10T08:00:00.000Z',
    });
    expect(deal.dealNumber, 345);
    expect(deal.stage, 'validations');
    expect(deal.items.single.badge, 'awaiting_validation');
    expect(deal.items.single.steps.single.honore, isTrue);
    expect(deal.items.single.steps.single.valide, isFalse);
    expect(deal.reviews.single.overall, 4.67);
    expect(deal.myReviewSubmitted, isFalse);
  });

  test('DealProfile.fromJson : stats + deals conclus (mockup 05)', () {
    final profil = DealProfile.fromJson({
      'dealsCompleted': 6,
      'reviews': {
        'count': 6,
        'avgHonesty': 5.0,
        'avgConformity': 4.0,
        'avgKindness': 5.0,
        'overall': 4.67,
        'latest': const [],
      },
      'concludedDeals': [
        {
          'dealNumber': 2,
          'offeredByUser': 'Canapé d’angle convertible',
          'receivedByUser': 'Cours de soutien (+1)',
          'completedAt': '2026-07-08T10:00:00.000Z',
        },
      ],
    });
    expect(profil.dealsCompleted, 6);
    expect(profil.overall, 4.67);
    expect(profil.concludedDeals.single.receivedByUser, contains('+1'));
  });
}

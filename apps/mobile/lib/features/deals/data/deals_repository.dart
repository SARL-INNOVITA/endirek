import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart' show apiClientProvider;
import '../domain/deal_models.dart';

/// Élément saisi dans le formulaire de proposition / d'ajustement.
typedef DealItemInput = ({
  String? providerId,
  String kind,
  String title,
  String description,
  int value,
  List<String> steps,
});

/// Accès aux endpoints deals du contrat CP2.4 (toutes les transitions
/// renvoient la page de deal À JOUR — le mobile remplace son état).
final dealsRepositoryProvider = Provider<DealsRepository>((ref) {
  return DealsRepository(ref.watch(apiClientProvider));
});

class DealsRepository {
  const DealsRepository(this._api);

  final ApiClient _api;

  Map<String, dynamic> _itemJson(DealItemInput item) => {
        if (item.providerId != null) 'providerId': item.providerId,
        'kind': item.kind,
        'title': item.title,
        if (item.description.isNotEmpty) 'description': item.description,
        'value': item.value,
        if (item.steps.isNotEmpty) 'steps': item.steps,
      };

  /// Mes deals (GET /deals) — cartes triées par activité.
  Future<({List<DealCard> items, int total})> chargerMesDeals({
    int limit = 50,
    int offset = 0,
  }) async {
    final reponse = await _api.get('/deals', queryParameters: {
      'limit': limit,
      'offset': offset,
    });
    final data = reponse.data as Map<String, dynamic>;
    return (
      items: ((data['items'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DealCard.fromJson)
          .toList(),
      total: (data['total'] as num?)?.toInt() ?? 0,
    );
  }

  /// Page de deal (GET /deals/:id).
  Future<Deal> chargerDeal(String id) async {
    final reponse = await _api.get('/deals/$id');
    return Deal.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Deal OUVERT lié à une conversation, ou null (404).
  Future<DealCard?> chargerDealDeConversation(String conversationId) async {
    try {
      final reponse = await _api.get('/deals/conversation/$conversationId');
      return DealCard.fromJson(reponse.data as Map<String, dynamic>);
    } on ApiException catch (e) {
      if (e.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  /// Propose un deal (POST /deals).
  Future<Deal> proposerDeal({
    required String listingId,
    String? recipientId,
    required List<DealItemInput> items,
  }) async {
    final reponse = await _api.post('/deals', data: {
      'listingId': listingId,
      'recipientId': ?recipientId,
      'items': items.map(_itemJson).toList(),
    });
    return Deal.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Transitions simples — le serveur renvoie le DEAL à jour.
  Future<Deal> _transition(String id, String action) async {
    final reponse = await _api.post('/deals/$id/$action');
    return Deal.fromJson(reponse.data as Map<String, dynamic>);
  }

  Future<Deal> accepter(String id) => _transition(id, 'accept');
  Future<Deal> refuser(String id) => _transition(id, 'decline');
  Future<Deal> retirer(String id) => _transition(id, 'withdraw');
  Future<Deal> demanderAnnulation(String id) => _transition(id, 'cancellation');
  Future<Deal> retirerAnnulation(String id) =>
      _transition(id, 'cancellation/withdraw');

  Future<Deal> honorerStep(String id, String stepId) =>
      _transition(id, 'steps/$stepId/honor');
  Future<Deal> validerStep(String id, String stepId) =>
      _transition(id, 'steps/$stepId/validate');

  Future<Deal> deciderAjustement(
    String id,
    String adjustmentId,
    bool accepter,
  ) =>
      _transition(
        id,
        'adjustments/$adjustmentId/${accepter ? 'accept' : 'reject'}',
      );

  /// Propose un ajustement (add/modify/remove).
  Future<Deal> proposerAjustement(
    String id, {
    required String kind,
    String? itemId,
    DealItemInput? item,
    required String description,
  }) async {
    final reponse = await _api.post('/deals/$id/adjustments', data: {
      'kind': kind,
      'itemId': ?itemId,
      if (item != null) 'item': _itemJson(item),
      'description': description,
    });
    return Deal.fromJson(reponse.data as Map<String, dynamic>);
  }

  Future<Deal> ajouterNote(String id, String body) async {
    final reponse = await _api.post('/deals/$id/notes', data: {'body': body});
    return Deal.fromJson(reponse.data as Map<String, dynamic>);
  }

  Future<Deal> declarerLitige(String id, String reason) async {
    final reponse =
        await _api.post('/deals/$id/dispute', data: {'reason': reason});
    return Deal.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Dépose MON avis (deal conclu, une seule fois).
  Future<Deal> deposerAvis(
    String id, {
    required int honesty,
    required int conformity,
    required int kindness,
    String? comment,
  }) async {
    final reponse = await _api.post('/deals/$id/review', data: {
      'ratingHonesty': honesty,
      'ratingConformity': conformity,
      'ratingKindness': kindness,
      if (comment != null && comment.trim().isNotEmpty) 'comment': comment,
    });
    return Deal.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Stats Dealplace d'un profil (GET /users/:id/deal-profile | me).
  Future<DealProfile> chargerProfilDeals(String? userId) async {
    final chemin = userId == null
        ? '/users/me/deal-profile'
        : '/users/$userId/deal-profile';
    final reponse = await _api.get(chemin);
    return DealProfile.fromJson(reponse.data as Map<String, dynamic>);
  }
}

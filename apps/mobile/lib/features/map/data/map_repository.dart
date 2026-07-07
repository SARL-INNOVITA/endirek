import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/models/map_overview.dart';
import '../../../core/auth/auth_controller.dart' show apiClientProvider;

/// Accès aux endpoints carte du contrat étape 5 (GET /map/overview).
final mapRepositoryProvider = Provider<MapRepository>((ref) {
  return MapRepository(ref.watch(apiClientProvider));
});

class MapRepository {
  const MapRepository(this._api);

  final ApiClient _api;

  /// Vue d'ensemble de la carte (GET /map/overview) — UN SEUL appel ramène
  /// posts + caméras.
  ///
  /// [types] filtre les posts (weather/traffic/danger) ; [categories] filtre
  /// les caméras (weather/traffic). Sans bbox, l'API renvoie toute l'île — la
  /// carte du Lot 1 charge l'île entière puis regroupe/filtre côté client
  /// (volumes faibles ; l'architecture bbox reste prête pour un chargement par
  /// zone au Lot suivant).
  Future<MapOverview> chargerOverview({
    List<String>? types,
    List<String>? categories,
  }) async {
    final reponse = await _api.get('/map/overview', queryParameters: {
      if (types != null && types.isNotEmpty) 'types': types.join(','),
      if (categories != null && categories.isNotEmpty)
        'categories': categories.join(','),
    });
    return MapOverview.fromJson(reponse.data as Map<String, dynamic>);
  }
}

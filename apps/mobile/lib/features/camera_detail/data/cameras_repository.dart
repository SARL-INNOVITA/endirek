import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/models/camera.dart';
import '../../../core/auth/auth_controller.dart' show apiClientProvider;

/// Accès au détail public d'une caméra (GET /cameras/:id).
final camerasRepositoryProvider = Provider<CamerasRepository>((ref) {
  return CamerasRepository(ref.watch(apiClientProvider));
});

class CamerasRepository {
  const CamerasRepository(this._api);

  final ApiClient _api;

  /// Détail public d'une caméra ACTIVE (GET /cameras/:id → CAMERA_PUBLIC).
  /// L'API renvoie 404 « Caméra introuvable » si la caméra n'existe pas OU
  /// n'est pas « active » (une caméra masquée ne se distingue pas d'une
  /// inexistante) — l'[ApiException] remonte alors telle quelle.
  Future<Camera> chargerCamera(String id) async {
    final reponse = await _api.get('/cameras/$id');
    return Camera.fromJson(reponse.data as Map<String, dynamic>);
  }
}

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/camera.dart';
import '../data/cameras_repository.dart';

/// Détail d'une caméra (GET /cameras/:id) — chargé par id via un
/// FutureProvider familial. L'erreur 404 « Caméra introuvable » remonte en
/// [ApiException] et est traitée par l'écran.
final cameraDetailProvider =
    FutureProvider.family<Camera, String>((ref, id) {
  return ref.watch(camerasRepositoryProvider).chargerCamera(id);
});

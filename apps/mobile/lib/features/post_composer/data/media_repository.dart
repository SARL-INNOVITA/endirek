import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/models/post_media.dart';
import '../../../core/auth/auth_controller.dart' show apiClientProvider;

/// Accès à POST /media/upload (multipart, champ 'file') — Lot 1 : IMAGES
/// UNIQUEMENT (JPEG, PNG, WebP, 8 Mo max, validées par décodage réel côté
/// API). TODO(lot ultérieur) : upload de vidéos.
final mediaRepositoryProvider = Provider<MediaRepository>((ref) {
  return MediaRepository(ref.watch(apiClientProvider));
});

class MediaRepository {
  const MediaRepository(this._api);

  final ApiClient _api;

  /// Téléverse une image choisie dans la galerie et renvoie la forme MEDIA
  /// prête pour le tableau `media` de POST /posts (la position définitive
  /// est posée par le composer au moment de publier).
  ///
  /// Les erreurs API (format refusé, fichier trop lourd 413…) remontent en
  /// ApiException avec leur message français, affiché tel quel.
  Future<PostMedia> uploaderImage(XFile fichier) async {
    final FormData corps = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        fichier.path,
        filename: fichier.name,
      ),
    });
    final reponse = await _api.post('/media/upload', data: corps);
    final data = reponse.data as Map<String, dynamic>;
    return PostMedia(
      url: data['url'] as String,
      thumbnailUrl: data['thumbnailUrl'] as String?,
      width: (data['width'] as num?)?.toInt(),
      height: (data['height'] as num?)?.toInt(),
      mediaType: (data['mediaType'] as String?) ?? 'image',
      position: 0,
    );
  }

  /// Téléverse un DOCUMENT PDF (POST /media/upload-document — Lot 3,
  /// section « Nos cartes » des pages) et renvoie `{ url, fileSizeBytes }`,
  /// prêts pour POST /pages/:id/documents.
  Future<({String url, int fileSizeBytes})> uploaderDocument(
    String chemin, {
    required String nomFichier,
  }) async {
    final FormData corps = FormData.fromMap({
      'file': await MultipartFile.fromFile(chemin, filename: nomFichier),
    });
    final reponse = await _api.post('/media/upload-document', data: corps);
    final data = reponse.data as Map<String, dynamic>;
    return (
      url: data['url'] as String,
      fileSizeBytes: (data['fileSizeBytes'] as num?)?.toInt() ?? 0,
    );
  }
}

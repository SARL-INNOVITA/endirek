import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/camera.dart';
import '../../../core/config/api_config.dart';
import '../../../core/theme/endirek_theme.dart';
import '../application/camera_detail_controller.dart';

/// Écran de détail d'une caméra (/camera/:id, GET /cameras/:id).
///
/// - streamType 'image' : affiche le flux via Image.network avec badge LIVE ;
/// - streamType 'video'/'iframe' : vignette + « Flux non affichable dans
///   l'app au Lot 1 » + rappel de l'URL du flux (pas d'ouverture navigateur —
///   aucune dépendance supplémentaire autorisée) ;
/// - métadonnées : nom, catégorie (badge), ville + quartier, description,
///   numéro #N, coordonnées ;
/// - 404 « Caméra introuvable » géré proprement.
class CameraDetailScreen extends ConsumerWidget {
  const CameraDetailScreen({super.key, required this.cameraId});

  final String cameraId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<Camera> etat = ref.watch(cameraDetailProvider(cameraId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Caméra'),
        leading: const BackButton(),
      ),
      body: etat.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (erreur, _) => _Erreur(
          erreur: erreur,
          onReessayer: () => ref.invalidate(cameraDetailProvider(cameraId)),
        ),
        data: (camera) => _Detail(camera: camera),
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.camera});

  final Camera camera;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        _Flux(camera: camera),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Badge catégorie + numéro.
              Row(
                children: [
                  _BadgeCategorie(camera: camera),
                  const Spacer(),
                  Text(
                    '#${camera.cameraNumber}',
                    style: const TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                camera.name,
                style: const TextStyle(
                  color: EndirekColors.encre,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 6),
              _LigneMeta(
                icone: Icons.place_outlined,
                texte: _localisation(camera),
              ),
              if (camera.description.trim().isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  camera.description,
                  style: const TextStyle(
                    color: EndirekColors.encre,
                    fontSize: 14.5,
                    height: 1.45,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              _LigneMeta(
                icone: Icons.my_location_outlined,
                texte:
                    '${camera.location.lat.toStringAsFixed(5)}, '
                    '${camera.location.lng.toStringAsFixed(5)}',
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// « Ville · Quartier » (quartier omis s'il est absent).
  String _localisation(Camera camera) {
    final String? quartier = camera.districtName;
    if (quartier != null && quartier.trim().isNotEmpty) {
      return '${camera.cityName} · $quartier';
    }
    return camera.cityName;
  }
}

/// Zone du flux : image live pour 'image', repli explicite pour 'video'/'iframe'.
class _Flux extends StatelessWidget {
  const _Flux({required this.camera});

  final Camera camera;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 16 / 10,
      child: ColoredBox(
        color: const Color(0xFF111820),
        child: camera.streamType == 'image'
            ? _Image(camera: camera)
            : _NonAffichable(camera: camera),
      ),
    );
  }
}

/// Flux image direct + badge LIVE en surimpression.
class _Image extends StatelessWidget {
  const _Image({required this.camera});

  final Camera camera;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.network(
          ApiConfig.resolveMediaUrl(camera.url),
          fit: BoxFit.cover,
          loadingBuilder: (context, child, progres) {
            if (progres == null) {
              return child;
            }
            return const Center(
              child: CircularProgressIndicator(color: Colors.white),
            );
          },
          errorBuilder: (context, error, stack) => const _FluxIndisponible(),
        ),
        const Positioned(top: 12, left: 12, child: _BadgeLive()),
      ],
    );
  }
}

/// Repli pour les flux vidéo/iframe non affichables au Lot 1.
class _NonAffichable extends StatelessWidget {
  const _NonAffichable({required this.camera});

  final Camera camera;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.videocam_off_outlined, color: Colors.white70, size: 40),
          const SizedBox(height: 12),
          const Text(
            'Flux non affichable dans l\'app au Lot 1',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white, fontSize: 14),
          ),
          const SizedBox(height: 12),
          // « Ouvrir le flux » : au Lot 1, on montre simplement l'URL (pas
          // d'ouverture navigateur — aucune dépendance externe autorisée).
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              camera.url,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

/// Image du flux indisponible (URL cassée).
class _FluxIndisponible extends StatelessWidget {
  const _FluxIndisponible();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.image_not_supported_outlined, color: Colors.white54, size: 36),
          SizedBox(height: 8),
          Text(
            'Image indisponible',
            style: TextStyle(color: Colors.white70, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

/// Badge « LIVE » orange.
class _BadgeLive extends StatelessWidget {
  const _BadgeLive();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF97316),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: const [
          Icon(Icons.circle, color: Colors.white, size: 8),
          SizedBox(width: 5),
          Text(
            'LIVE',
            style: TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

/// Badge de catégorie (météo/trafic) coloré.
class _BadgeCategorie extends StatelessWidget {
  const _BadgeCategorie({required this.camera});

  final Camera camera;

  @override
  Widget build(BuildContext context) {
    final (Color couleur, IconData icone) = switch (camera.category) {
      'weather' => (const Color(0xFF1173D4), Icons.cloud_outlined),
      'traffic' => (const Color(0xFFF97316), Icons.directions_car_outlined),
      _ => (EndirekColors.encreSecondaire, Icons.videocam_outlined),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: couleur.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icone, size: 15, color: couleur),
          const SizedBox(width: 5),
          Text(
            camera.libelleCategorie,
            style: TextStyle(
              color: couleur,
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// Ligne « icône + texte » des métadonnées.
class _LigneMeta extends StatelessWidget {
  const _LigneMeta({required this.icone, required this.texte});

  final IconData icone;
  final String texte;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icone, size: 17, color: EndirekColors.encreSecondaire),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            texte,
            style: const TextStyle(
              color: EndirekColors.encreSecondaire,
              fontSize: 13.5,
              height: 1.35,
            ),
          ),
        ),
      ],
    );
  }
}

/// Vue d'erreur : message dédié pour un 404 (caméra introuvable), générique
/// sinon, avec bouton réessayer.
class _Erreur extends StatelessWidget {
  const _Erreur({required this.erreur, required this.onReessayer});

  final Object erreur;
  final VoidCallback onReessayer;

  @override
  Widget build(BuildContext context) {
    final bool introuvable =
        erreur is ApiException && (erreur as ApiException).statusCode == 404;
    final String message = introuvable
        ? 'Caméra introuvable'
        : (erreur is ApiException
            ? (erreur as ApiException).message
            : 'Une erreur est survenue.');
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              introuvable
                  ? Icons.videocam_off_outlined
                  : Icons.wifi_off_outlined,
              size: 44,
              color: EndirekColors.encreSecondaire,
            ),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 15,
                height: 1.4,
              ),
            ),
            // Un 404 est définitif : inutile de proposer de réessayer.
            if (!introuvable) ...[
              const SizedBox(height: 16),
              TextButton.icon(
                onPressed: onReessayer,
                icon: const Icon(Icons.refresh),
                label: const Text('Réessayer'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

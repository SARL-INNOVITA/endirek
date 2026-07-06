import 'package:flutter/material.dart';

import '../../../../core/api/models/post_media.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/theme/endirek_theme.dart';

/// Galerie d'images d'une publication (Lot 1 : images uniquement, 4 max) :
/// - 1 média  → image pleine largeur au ratio d'origine (plafonné) ;
/// - 2 à 4    → grille 2 colonnes de vignettes carrées.
class PostMediaGallery extends StatelessWidget {
  const PostMediaGallery({super.key, required this.media});

  final List<PostMedia> media;

  @override
  Widget build(BuildContext context) {
    if (media.isEmpty) {
      return const SizedBox.shrink();
    }
    final List<PostMedia> tries = [...media]
      ..sort((a, b) => a.position.compareTo(b.position));

    if (tries.length == 1) {
      final PostMedia seul = tries.first;
      // Ratio d'origine si connu, borné pour ne pas envahir le fil.
      final double ratio =
          (seul.width != null && seul.height != null && seul.height! > 0)
              ? (seul.width! / seul.height!).clamp(0.75, 2.0)
              : 16 / 9;
      return AspectRatio(
        aspectRatio: ratio,
        child: _ImageReseau(url: seul.url),
      );
    }

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 2,
      crossAxisSpacing: 2,
      children: [
        for (final PostMedia element in tries)
          _ImageReseau(url: element.thumbnailUrl ?? element.url),
      ],
    );
  }
}

/// Image réseau avec réécriture d'origine (localhost → adresse de l'API vue
/// par l'appareil), fond de chargement et repli en cas d'échec.
class _ImageReseau extends StatelessWidget {
  const _ImageReseau({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return Image.network(
      ApiConfig.resolveMediaUrl(url),
      fit: BoxFit.cover,
      loadingBuilder: (context, enfant, progression) {
        if (progression == null) {
          return enfant;
        }
        return const ColoredBox(
          color: EndirekColors.surface,
          child: Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        );
      },
      errorBuilder: (_, _, _) => const ColoredBox(
        color: EndirekColors.surface,
        child: Center(
          child: Icon(
            Icons.broken_image_outlined,
            color: EndirekColors.encreSecondaire,
          ),
        ),
      ),
    );
  }
}

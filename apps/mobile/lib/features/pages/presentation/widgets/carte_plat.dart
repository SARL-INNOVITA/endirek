import 'package:flutter/material.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../domain/formatage_pages.dart';
import '../../domain/page_models.dart';

/// Carte d'un PLAT du menu du jour (mockup 08) : image à gauche, nom,
/// description, ligne des prix « À emporter X,XX € | Sur place Y,YY € »
/// (un seul prix renseigné géré, montants en bleu).
class CartePlat extends StatelessWidget {
  const CartePlat({super.key, required this.plat});

  final Dish plat;

  @override
  Widget build(BuildContext context) {
    final String? lignePrix = formaterLignePrixPlat(
      aEmporterCents: plat.priceTakeawayCents,
      surPlaceCents: plat.priceDineInCents,
    );

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: EndirekColors.bordure),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _VignettePlat(imageUrl: plat.imageUrl),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plat.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: EndirekColors.encre,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (plat.description.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    plat.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 12.5,
                      height: 1.3,
                    ),
                  ),
                ],
                if (lignePrix != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    lignePrix,
                    style: const TextStyle(
                      color: EndirekColors.bleu,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Vignette carrée du plat (photo, sinon pictogramme restaurant).
class _VignettePlat extends StatelessWidget {
  const _VignettePlat({required this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    const double cote = 72;
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: SizedBox(
        width: cote,
        height: cote,
        child: (imageUrl != null && imageUrl!.isNotEmpty)
            ? Image.network(
                ApiConfig.resolveMediaUrl(imageUrl!),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const _PictoPlat(),
              )
            : const _PictoPlat(),
      ),
    );
  }
}

class _PictoPlat extends StatelessWidget {
  const _PictoPlat();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: EndirekColors.surface,
      child: Icon(
        Icons.restaurant_outlined,
        color: EndirekColors.encreSecondaire,
      ),
    );
  }
}

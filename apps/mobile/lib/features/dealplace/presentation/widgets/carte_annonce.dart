import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../domain/dealplace_value.dart';
import '../../domain/listing_card.dart';

/// Carte d'une annonce dans l'annuaire Dealplace (LISTING_CARD) : image de
/// couverture (ou repli coloré selon le type), badge bien/service, valeur
/// formatée « € », titre, fil « Catégorie > Sous-catégorie » et commune.
/// Un tap ouvre le détail (/dealplace/:id).
class CarteAnnonce extends StatelessWidget {
  const CarteAnnonce({super.key, required this.annonce});

  final ListingCard annonce;

  @override
  Widget build(BuildContext context) {
    final String valeur = formaterValeurAnnonce(
      valueKind: annonce.valueKind,
      valueMin: annonce.valueMin,
      valueMax: annonce.valueMax,
      currency: annonce.currency,
    );

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: EndirekColors.bordure),
      ),
      child: InkWell(
        onTap: () => context.push('/dealplace/${annonce.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 16 / 10,
              child: _Couverture(annonce: annonce),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    annonce.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    annonce.category.labelFr,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    valeur,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.bleu,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(
                        Icons.place_outlined,
                        size: 13,
                        color: EndirekColors.encreSecondaire,
                      ),
                      const SizedBox(width: 2),
                      Expanded(
                        child: Text(
                          annonce.city,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: EndirekColors.encreSecondaire,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Image de couverture 16:10 avec badge de type superposé ; repli coloré
/// (icône + type) quand l'annonce n'a pas de média.
class _Couverture extends StatelessWidget {
  const _Couverture({required this.annonce});

  final ListingCard annonce;

  @override
  Widget build(BuildContext context) {
    final coverMedia = annonce.coverMedia;
    final bool estBien = annonce.estBien;

    return Stack(
      fit: StackFit.expand,
      children: [
        if (coverMedia != null)
          Image.network(
            ApiConfig.resolveMediaUrl(
              coverMedia.thumbnailUrl ?? coverMedia.url,
            ),
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => _Repli(estBien: estBien),
          )
        else
          _Repli(estBien: estBien),
        Positioned(
          top: 6,
          left: 6,
          child: _EtiquetteType(estBien: estBien),
        ),
      ],
    );
  }
}

/// Repli visuel sans image : fond gris clair + icône du type.
class _Repli extends StatelessWidget {
  const _Repli({required this.estBien});

  final bool estBien;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: EndirekColors.surface,
      child: Center(
        child: Icon(
          estBien ? Icons.inventory_2_outlined : Icons.handshake_outlined,
          size: 34,
          color: EndirekColors.bordure,
        ),
      ),
    );
  }
}

/// Étiquette de type compacte, lisible sur photo (fond semi-opaque).
class _EtiquetteType extends StatelessWidget {
  const _EtiquetteType({required this.estBien});

  final bool estBien;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            estBien ? Icons.inventory_2_outlined : Icons.handshake_outlined,
            size: 12,
            color: Colors.white,
          ),
          const SizedBox(width: 4),
          Text(
            estBien ? 'Bien' : 'Service',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../domain/dealplace_value.dart';
import '../../domain/listing_card.dart';

/// Tuile COMPACTE d'une annonce dans les sections « Services » / « Biens »
/// du profil Dealplace (CP2.2, mockup 05) : vignette carrée, titre, valeur
/// formatée + commune, chevron. Tap → détail de l'annonce.
///
/// Sur MON profil, les annonces masquées par la modération portent un badge
/// « Masquée » (le statut n'est présent que sur `/users/me/listings`).
class TuileAnnonceProfil extends StatelessWidget {
  const TuileAnnonceProfil({super.key, required this.annonce});

  final ListingCard annonce;

  @override
  Widget build(BuildContext context) {
    final bool masquee = annonce.status == 'hidden';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push('/dealplace/${annonce.id}'),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              _Vignette(annonce: annonce),
              const SizedBox(width: 12),
              Expanded(
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
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${formaterValeurAnnonce(
                        valueKind: annonce.valueKind,
                        valueMin: annonce.valueMin,
                        valueMax: annonce.valueMax,
                        currency: annonce.currency,
                      )} · ${annonce.city}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 13,
                      ),
                    ),
                    if (masquee) ...[
                      const SizedBox(height: 6),
                      const _BadgeMasquee(),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 6),
              const Icon(
                Icons.chevron_right,
                color: EndirekColors.encreSecondaire,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Vignette carrée : première photo de l'annonce, sinon pictogramme de la
/// famille (services sans photo notamment).
class _Vignette extends StatelessWidget {
  const _Vignette({required this.annonce});

  final ListingCard annonce;

  @override
  Widget build(BuildContext context) {
    const double cote = 56;
    final String? url = annonce.coverMedia?.thumbnailUrl?.isNotEmpty == true
        ? annonce.coverMedia!.thumbnailUrl
        : annonce.coverMedia?.url;
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: SizedBox(
        width: cote,
        height: cote,
        child: (url != null && url.isNotEmpty)
            ? Image.network(
                ApiConfig.resolveMediaUrl(url),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _picto(),
              )
            : _picto(),
      ),
    );
  }

  Widget _picto() {
    return ColoredBox(
      color: EndirekColors.surface,
      child: Icon(
        annonce.estBien ? Icons.inventory_2_outlined : Icons.handyman_outlined,
        color: EndirekColors.encreSecondaire,
      ),
    );
  }
}

/// Badge discret « Masquée » (annonce masquée par la modération — visible
/// uniquement par son propriétaire).
class _BadgeMasquee extends StatelessWidget {
  const _BadgeMasquee();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFFDECEA),
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Text(
        'Masquée par la modération',
        style: TextStyle(
          color: Color(0xFFB3261E),
          fontSize: 11.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

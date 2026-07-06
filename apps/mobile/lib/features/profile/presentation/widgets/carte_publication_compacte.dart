import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/api/models/feed_post.dart';
import '../../../../core/api/models/post_type.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../../../core/utils/temps_relatif.dart';
import '../../../feed/application/referentiels_providers.dart';
import '../../../feed/presentation/widgets/type_visuel.dart';

/// Carte COMPACTE d'une publication pour la section « Mes publications »
/// du profil : pastille du type, titre (ou début du texte), temps relatif,
/// compteurs, badge « Masquée » pour les posts 'hidden' (visibles
/// uniquement par leur auteur). Tap → détail.
class CartePublicationCompacte extends ConsumerWidget {
  const CartePublicationCompacte({super.key, required this.post});

  final FeedPost post;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final PostType? type = ref.watch(typesParSlugProvider)[post.typeSlug];
    final String apercu = (post.title != null && post.title!.isNotEmpty)
        ? post.title!
        : post.body;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: EndirekColors.bordure),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/post/${post.id}'),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              PastilleType(
                nomIcone: type?.icon ?? '',
                couleurHex: type?.color ?? '',
                taille: 36,
                tooltip: type?.labelFr,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      apercu,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: EndirekColors.encre,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          tempsRelatif(post.createdAt),
                          style: const TextStyle(
                            color: EndirekColors.encreSecondaire,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(width: 10),
                        if (post.status == 'hidden') ...[
                          const _BadgeMasquee(),
                          const SizedBox(width: 10),
                        ],
                        const Spacer(),
                        _Compteur(
                          icone: Icons.thumb_up_off_alt,
                          valeur: post.reactionCount,
                        ),
                        const SizedBox(width: 10),
                        _Compteur(
                          icone: Icons.mode_comment_outlined,
                          valeur: post.commentCount,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
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

/// Badge des publications masquées par la modération (statut 'hidden' —
/// visible uniquement par l'auteur dans « Mes publications »).
class _BadgeMasquee extends StatelessWidget {
  const _BadgeMasquee();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFFDEBD2),
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Text(
        'Masquée',
        style: TextStyle(
          color: Color(0xFF9A5B13),
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _Compteur extends StatelessWidget {
  const _Compteur({required this.icone, required this.valeur});

  final IconData icone;
  final int valeur;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icone, size: 14, color: EndirekColors.encreSecondaire),
        const SizedBox(width: 3),
        Text(
          '$valeur',
          style: const TextStyle(
            color: EndirekColors.encreSecondaire,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

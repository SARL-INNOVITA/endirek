import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/endirek_theme.dart';
import '../../../feed/presentation/widgets/avatar_rond.dart';
import '../../domain/page_models.dart';
import 'badge_verifie.dart';
import 'chip_statut_ouverture.dart';

/// Tuile COMPACTE d'une de MES pages dans la section « Mes pages » du
/// profil (miroir de TuileAnnonceProfil) : avatar rond, nom (+ coche si
/// vérifiée), type + commune, statut d'ouverture, badge « Masquée » si la
/// page a été masquée par la modération. Tap → écran public de la page.
class TuilePageProfil extends StatelessWidget {
  const TuilePageProfil({super.key, required this.page});

  final OwnerPageCard page;

  @override
  Widget build(BuildContext context) {
    final PageCard carte = page.carte;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push('/pages/${carte.id}'),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              AvatarRond(
                initiales: carte.initiales,
                avatarUrl: carte.avatarUrl,
                rayon: 24,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            carte.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: EndirekColors.encre,
                              fontSize: 14.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (carte.verified) ...[
                          const SizedBox(width: 4),
                          const BadgeVerifie(taille: 15),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${carte.libelleType} · ${carte.city}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        ChipStatutOuverture(statut: carte.openStatus),
                        if (page.estMasquee) const _BadgeMasquee(),
                      ],
                    ),
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

/// Badge discret « Masquée » (page masquée par la modération — visible
/// uniquement par son propriétaire, miroir du pattern annonces).
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

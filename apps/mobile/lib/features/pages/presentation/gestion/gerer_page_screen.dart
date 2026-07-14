import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/endirek_theme.dart';
import '../../../feed/presentation/widgets/avatar_rond.dart';
import '../../application/pages_providers.dart';
import '../../domain/page_models.dart';
import '../widgets/chip_statut_ouverture.dart';

/// HUB de gestion d'une page (/pages/:id/gerer — propriétaire) : liste les
/// sections d'administration, chacune ouvrant son écran dédié :
/// Informations (édition + congés), Horaires, puis pour les restaurants
/// Plats / Menus de la semaine / Nos cartes, et enfin Offres et Événements.
class GererPageScreen extends ConsumerWidget {
  const GererPageScreen({super.key, required this.pageId});

  final String pageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<PageDetail> etat = ref.watch(pageDetailProvider(pageId));

    return Scaffold(
      appBar: AppBar(title: const Text('Gérer la page')),
      body: SafeArea(
        top: false,
        child: switch (etat) {
          AsyncData(:final value) => _contenu(context, value),
          AsyncError() => Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Impossible de charger la page.',
                    style: TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 14,
                    ),
                  ),
                  TextButton(
                    onPressed: () =>
                        ref.invalidate(pageDetailProvider(pageId)),
                    child: const Text('Réessayer'),
                  ),
                ],
              ),
            ),
          _ => const Center(child: CircularProgressIndicator()),
        },
      ),
    );
  }

  Widget _contenu(BuildContext context, PageDetail page) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        _EnTete(page: page),
        const SizedBox(height: 16),
        _TuileSection(
          icone: Icons.info_outline,
          titre: 'Informations',
          sousTitre: 'Nom, bio, commune, téléphone, attributs, photos, congés',
          surTap: () => context.push('/pages/${page.id}/gerer/infos'),
        ),
        _TuileSection(
          icone: Icons.schedule,
          titre: 'Horaires',
          sousTitre: 'Plages d\'ouverture par jour de la semaine',
          surTap: () => context.push('/pages/${page.id}/gerer/horaires'),
        ),
        if (page.estRestaurant) ...[
          _TuileSection(
            icone: Icons.restaurant_outlined,
            titre: 'Plats',
            sousTitre: 'Votre carte de plats : photos, descriptions, prix',
            surTap: () => context.push('/pages/${page.id}/gerer/plats'),
          ),
          _TuileSection(
            icone: Icons.calendar_month_outlined,
            titre: 'Menus de la semaine',
            sousTitre: 'Composez le menu du jour de chaque journée',
            surTap: () => context.push('/pages/${page.id}/gerer/menus'),
          ),
          _TuileSection(
            icone: Icons.picture_as_pdf_outlined,
            titre: 'Nos cartes',
            sousTitre: 'Cartes PDF téléchargeables (${page.documents.length}/5)',
            surTap: () => context.push('/pages/${page.id}/gerer/cartes'),
          ),
        ],
        _TuileSection(
          icone: Icons.local_offer_outlined,
          titre: 'Offres',
          sousTitre: 'Créez et gérez vos offres, avec période optionnelle',
          surTap: () => context.push('/pages/${page.id}/gerer/offres'),
        ),
        _TuileSection(
          icone: Icons.event_outlined,
          titre: 'Événements',
          sousTitre: 'Annoncez vos événements à venir',
          surTap: () => context.push('/pages/${page.id}/gerer/evenements'),
        ),
      ],
    );
  }
}

/// En-tête du hub : avatar, nom, type et statut d'ouverture courant.
class _EnTete extends StatelessWidget {
  const _EnTete({required this.page});

  final PageDetail page;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            AvatarRond(
              initiales: page.initiales,
              avatarUrl: page.avatarUrl,
              rayon: 26,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    page.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Page · ${page.libelleType}',
                    style: const TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 12.5,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            ChipStatutOuverture(statut: page.openStatus),
          ],
        ),
      ),
    );
  }
}

/// Tuile d'une section de gestion (icône ronde + titre + description).
class _TuileSection extends StatelessWidget {
  const _TuileSection({
    required this.icone,
    required this.titre,
    required this.sousTitre,
    required this.surTap,
  });

  final IconData icone;
  final String titre;
  final String sousTitre;
  final VoidCallback surTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: surTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: EndirekColors.bleu.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icone, size: 21, color: EndirekColors.bleu),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      titre,
                      style: const TextStyle(
                        color: EndirekColors.encre,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      sousTitre,
                      style: const TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 12.5,
                        height: 1.3,
                      ),
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

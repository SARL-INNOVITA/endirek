import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../deals/application/deal_providers.dart';
import '../../deals/domain/deal_models.dart';
import '../../deals/presentation/widgets/etoiles_avis.dart';
import '../../profile/data/profile_repository.dart';
import '../application/profil_dealplace_providers.dart';
import 'widgets/tuile_annonce_profil.dart';

/// Volet « Profil Dealplace » (CP2.2, mockup 05) — vue PARTAGÉE entre l'onglet
/// de MON profil ([userId] null) et l'écran public d'un tiers ([userId]
/// fourni, [seekingPublic] = son « Ce que je recherche »).
///
/// Sections, dans l'ordre du mockup :
/// 1. bloc DealPlace (deals réalisés + note globale + critères d'avis) —
///    PLACEHOLDER visible : les avis et les deals arrivent au CP2.4 (décision
///    D59), même approche que le bouton « Proposer un deal » du CP2.1 ;
/// 2. « Ce que je recherche » — texte public, ÉDITABLE sur mon profil
///    (bottom sheet → PATCH /users/me/profile) ;
/// 3. « Services (N) » puis « Biens (N) » — annonces du profil par famille
///    (les miennes incluent les masquées, badge « Masquée ») ;
/// 4. « Deals conclus » — PLACEHOLDER (CP2.4).
///
/// La vue N'EST PAS scrollable elle-même : elle s'insère dans le scroll du
/// parent (onglet du profil ou écran public).
class ProfilDealplaceView extends ConsumerWidget {
  const ProfilDealplaceView({
    super.key,
    this.userId,
    this.seekingPublic,
  });

  /// null = mon profil (annonces active+hidden, « Ce que je recherche »
  /// éditable) ; sinon profil public d'un tiers (annonces actives).
  final String? userId;

  /// « Ce que je recherche » d'un TIERS (fourni par l'écran public qui a déjà
  /// chargé le profil) — ignoré pour mon profil (lu depuis l'état d'auth).
  final String? seekingPublic;

  bool get _estMoi => userId == null;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _BlocStatsDeals(userId: userId, estMoi: _estMoi),
        const SizedBox(height: 16),
        _BlocCeQueJeRecherche(estMoi: _estMoi, seekingPublic: seekingPublic),
        const SizedBox(height: 24),
        _SectionAnnonces(
          titre: 'Services',
          family: 'service',
          userId: userId,
          messageVide: _estMoi
              ? 'Vous ne proposez aucun service pour le moment.'
              : 'Aucun service proposé pour le moment.',
        ),
        const SizedBox(height: 24),
        _SectionAnnonces(
          titre: 'Biens',
          family: 'good',
          userId: userId,
          messageVide: _estMoi
              ? 'Vous ne proposez aucun bien pour le moment.'
              : 'Aucun bien proposé pour le moment.',
        ),
        const SizedBox(height: 24),
        _BlocDealsConclus(userId: userId, estMoi: _estMoi),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Bloc DealPlace : deals réalisés + note globale + critères — RÉEL (CP2.4)
// ─────────────────────────────────────────────────────────────────────────────

/// Bloc « DealPlace » du mockup 05, ACTIVÉ au CP2.4 : « X deals réalisés »,
/// note globale, barres des 3 critères (moyennes des avis reçus), dernier
/// avis. Sur MON profil : bouton « Mes deals ».
class _BlocStatsDeals extends ConsumerWidget {
  const _BlocStatsDeals({required this.userId, required this.estMoi});

  final String? userId;
  final bool estMoi;

  static const List<(String, double? Function(DealProfile))> _criteres = [
    ('Honnêteté et fiabilité', _avgHonesty),
    ('Conformité à la description', _avgConformity),
    ('Amabilité et courtoisie', _avgKindness),
  ];

  static double? _avgHonesty(DealProfile p) => p.avgHonesty;
  static double? _avgConformity(DealProfile p) => p.avgConformity;
  static double? _avgKindness(DealProfile p) => p.avgKindness;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profil = ref.watch(dealProfilProvider(estMoi ? null : userId));
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.handshake_outlined,
                    color: EndirekColors.bleu, size: 22),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'DealPlace',
                    style: TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                if (profil.hasValue)
                  Text(
                    '${profil.value!.dealsCompleted} deal${profil.value!.dealsCompleted > 1 ? 's' : ''} réalisé${profil.value!.dealsCompleted > 1 ? 's' : ''}',
                    style: const TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                const SizedBox(width: 6),
                const _BoutonCommentCaMarche(),
              ],
            ),
            const SizedBox(height: 10),
            switch (profil) {
              AsyncData(:final value) => _stats(context, value),
              AsyncError() => const Text(
                  'Stats indisponibles pour le moment.',
                  style: TextStyle(
                    color: EndirekColors.encreSecondaire,
                    fontSize: 13,
                  ),
                ),
              _ => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.2),
                    ),
                  ),
                ),
            },
            if (estMoi) ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => context.push('/deals'),
                icon: const Icon(Icons.handshake_outlined, size: 18),
                label: const Text('Mes deals'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _stats(BuildContext context, DealProfile profil) {
    if (profil.reviewsCount == 0) {
      return const Text(
        'Pas encore d’avis — ils apparaîtront après les premiers deals '
        'conclus.',
        style: TextStyle(
          color: EndirekColors.encreSecondaire,
          fontSize: 13,
          height: 1.4,
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              'Note globale',
              style: TextStyle(
                color: EndirekColors.encre,
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 8),
            EtoilesLecture(note: profil.overall ?? 0),
            const SizedBox(width: 6),
            Text(
              'par ${profil.reviewsCount} utilisateur${profil.reviewsCount > 1 ? 's' : ''}',
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 12,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        for (final (libelle, valeur) in _criteres)
          Padding(
            padding: const EdgeInsets.only(bottom: 7),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    libelle,
                    style: const TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 13,
                    ),
                  ),
                ),
                SizedBox(
                  width: 90,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: (valeur(profil) ?? 0) / 5,
                      minHeight: 6,
                      backgroundColor: EndirekColors.bordure,
                      color: EndirekColors.bleu,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 44,
                  child: Text(
                    '${(valeur(profil) ?? 0).toStringAsFixed(1).replaceAll('.', ',')}/5',
                    textAlign: TextAlign.end,
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (profil.latestReviews.isNotEmpty) ...[
          const SizedBox(height: 4),
          _DernierAvis(avis: profil.latestReviews.first),
        ],
      ],
    );
  }
}

/// Carte du dernier avis reçu (mockup 05).
class _DernierAvis extends StatelessWidget {
  const _DernierAvis({required this.avis});

  final DealReview avis;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: EndirekColors.surface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  avis.reviewer.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: EndirekColors.encre,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              EtoilesLecture(note: avis.overall),
            ],
          ),
          if (avis.comment != null && avis.comment!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              avis.comment!,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: EndirekColors.encre,
                fontSize: 12.5,
                height: 1.35,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// « Comment ça marche ? » (mockup 05) : bottom sheet statique qui explique le
/// Dealplace en quelques points.
class _BoutonCommentCaMarche extends StatelessWidget {
  const _BoutonCommentCaMarche();

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Comment ça marche ?',
      visualDensity: VisualDensity.compact,
      onPressed: () => _ouvrir(context),
      icon: const Icon(
        Icons.help_outline,
        color: EndirekColors.encreSecondaire,
        size: 20,
      ),
    );
  }

  void _ouvrir(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) => const Padding(
        padding: EdgeInsets.fromLTRB(24, 0, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Comment ça marche ?',
              style: TextStyle(
                color: EndirekColors.encre,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            SizedBox(height: 12),
            _LigneAide(
              icone: Icons.storefront_outlined,
              texte:
                  'Le Dealplace rassemble les biens et services proposés par '
                  'les Réunionnais : chaque annonce porte une valeur estimée.',
            ),
            _LigneAide(
              icone: Icons.swap_horiz,
              texte:
                  'Échangez contre un bien, un service, de l’argent — ou '
                  'restez ouvert aux propositions.',
            ),
            _LigneAide(
              icone: Icons.handshake_outlined,
              texte:
                  'Au prochain lot : proposez un deal, validez ses étapes à '
                  'deux, puis évaluez l’échange (avis et fiabilité).',
            ),
            _LigneAide(
              icone: Icons.euro_outlined,
              texte:
                  'Le paiement éventuel se règle entre vous, hors de '
                  'l’application.',
            ),
          ],
        ),
      ),
    );
  }
}

class _LigneAide extends StatelessWidget {
  const _LigneAide({required this.icone, required this.texte});

  final IconData icone;
  final String texte;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icone, size: 20, color: EndirekColors.bleu),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              texte,
              style: const TextStyle(
                color: EndirekColors.encre,
                fontSize: 13.5,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. « Ce que je recherche » — public, éditable sur mon profil
// ─────────────────────────────────────────────────────────────────────────────

class _BlocCeQueJeRecherche extends ConsumerWidget {
  const _BlocCeQueJeRecherche({
    required this.estMoi,
    required this.seekingPublic,
  });

  final bool estMoi;
  final String? seekingPublic;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Mon profil : texte lu depuis l'état d'auth (rafraîchi après édition) ;
    // profil public : texte fourni par l'écran (déjà chargé avec l'en-tête).
    final String? texte;
    if (estMoi) {
      final AuthState auth = ref.watch(authControllerProvider);
      texte = auth is AuthSignedIn ? auth.profile.dealplaceSeeking : null;
    } else {
      texte = seekingPublic;
    }

    // Profil public sans texte : la section n'apparaît pas (rien à montrer).
    if (!estMoi && (texte == null || texte.isEmpty)) {
      return const SizedBox.shrink();
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Ce que je recherche',
                    style: TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                if (estMoi)
                  IconButton(
                    tooltip: 'Modifier',
                    visualDensity: VisualDensity.compact,
                    onPressed: () => _editer(context, ref, texte),
                    icon: const Icon(
                      Icons.edit_outlined,
                      size: 18,
                      color: EndirekColors.encreSecondaire,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              (texte == null || texte.isEmpty)
                  ? 'Dites aux autres membres ce que vous recherchez sur le '
                        'Dealplace (biens, services, échanges…).'
                  : texte,
              style: TextStyle(
                color: (texte == null || texte.isEmpty)
                    ? EndirekColors.encreSecondaire
                    : EndirekColors.encre,
                fontSize: 13.5,
                height: 1.45,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Bottom sheet d'édition : TextField 500 caractères, vider = effacer
  /// (le serveur convertit une chaîne vide en null).
  Future<void> _editer(
    BuildContext context,
    WidgetRef ref,
    String? actuel,
  ) async {
    final controleur = TextEditingController(text: actuel ?? '');
    final bool? enregistre = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (contexteSheet) => Padding(
        padding: EdgeInsets.fromLTRB(
          24,
          0,
          24,
          16 + MediaQuery.of(contexteSheet).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Ce que je recherche',
              style: TextStyle(
                color: EndirekColors.encre,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controleur,
              autofocus: true,
              maxLines: 5,
              maxLength: 500,
              decoration: const InputDecoration(
                hintText:
                    'Ex. : je recherche du matériel de rando et je propose '
                    'des cours de guitare en échange…',
              ),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: () => Navigator.of(contexteSheet).pop(true),
              child: const Text('Enregistrer'),
            ),
          ],
        ),
      ),
    );
    if (enregistre != true) {
      controleur.dispose();
      return;
    }
    final String saisie = controleur.text.trim();
    controleur.dispose();
    try {
      // Chaîne vide → null explicite (efface le texte côté serveur).
      await ref.read(profileRepositoryProvider).updateMyProfile(
            dealplaceSeeking: saisie.isEmpty ? null : saisie,
          );
      // Recharge le profil d'auth : la vue se reconstruit avec le texte à jour.
      await ref.read(authControllerProvider.notifier).refreshProfile();
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Impossible d’enregistrer. Réessayez.'),
          ),
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Sections Services / Biens
// ─────────────────────────────────────────────────────────────────────────────

class _SectionAnnonces extends ConsumerWidget {
  const _SectionAnnonces({
    required this.titre,
    required this.family,
    required this.userId,
    required this.messageVide,
  });

  final String titre;
  final String family;
  final String? userId;
  final String messageVide;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final args = (userId: userId, family: family);
    final annonces = ref.watch(sectionAnnoncesProvider(args));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          annonces.hasValue ? '$titre (${annonces.value!.total})' : titre,
          style: const TextStyle(
            color: EndirekColors.encre,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 12),
        switch (annonces) {
          AsyncData(:final value) when value.items.isEmpty => Text(
              messageVide,
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 13.5,
              ),
            ),
          AsyncData(:final value) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final annonce in value.items)
                  TuileAnnonceProfil(annonce: annonce),
              ],
            ),
          AsyncError() => Column(
              children: [
                const Text(
                  'Impossible de charger ces annonces.',
                  style: TextStyle(
                    color: EndirekColors.encreSecondaire,
                    fontSize: 13.5,
                  ),
                ),
                TextButton(
                  onPressed: () =>
                      ref.invalidate(sectionAnnoncesProvider(args)),
                  child: const Text('Réessayer'),
                ),
              ],
            ),
          _ => const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            ),
        },
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. « Deals conclus » — RÉEL (CP2.4, mockup 05)
// ─────────────────────────────────────────────────────────────────────────────

/// Historique des échanges conclus : « offert ⇄ en échange de » + date.
class _BlocDealsConclus extends ConsumerWidget {
  const _BlocDealsConclus({required this.userId, required this.estMoi});

  final String? userId;
  final bool estMoi;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profil = ref.watch(dealProfilProvider(estMoi ? null : userId));
    final conclus = profil.value?.concludedDeals ?? const [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          profil.hasValue ? 'Deals conclus (${conclus.length})' : 'Deals conclus',
          style: const TextStyle(
            color: EndirekColors.encre,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 12),
        if (profil.hasValue && conclus.isEmpty)
          Text(
            estMoi
                ? 'Aucun deal conclu pour le moment — proposez un deal depuis '
                    'une annonce !'
                : 'Aucun deal conclu pour le moment.',
            style: const TextStyle(
              color: EndirekColors.encreSecondaire,
              fontSize: 13.5,
            ),
          ),
        for (final deal in conclus)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          deal.offeredByUser,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.end,
                          style: const TextStyle(
                            color: EndirekColors.encre,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Icon(Icons.swap_horiz,
                            size: 18, color: EndirekColors.bleu),
                      ),
                      Expanded(
                        child: Text(
                          deal.receivedByUser,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: EndirekColors.encre,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (deal.completedAt != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Conclu le ${_date(deal.completedAt!)}',
                      style: const TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }

  static String _date(DateTime d) {
    final l = d.toLocal();
    String deux(int n) => n.toString().padLeft(2, '0');
    return '${deux(l.day)}/${deux(l.month)}/${l.year}';
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/endirek_theme.dart';
import '../../feed/presentation/widgets/avatar_rond.dart';
import '../application/profil_dealplace_providers.dart';
import '../domain/profil_public.dart';
import 'profil_dealplace_view.dart';

/// Écran PUBLIC « Profil Dealplace » d'un autre utilisateur
/// (/dealplace/profil/:userId — CP2.2, mockup 05), accessible depuis le bloc
/// vendeur du détail d'une annonce.
///
/// En-tête : avatar + nom + commune + bio (profil PUBLIC — jamais d'email),
/// puis le volet Dealplace partagé : placeholder avis/deals (D59 — CP2.4),
/// « Ce que je recherche », annonces actives par famille (Services / Biens).
/// 404 (compte absent/supprimé/suspendu) → état d'erreur sobre.
class DealplaceProfilScreen extends ConsumerWidget {
  const DealplaceProfilScreen({super.key, required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profil = ref.watch(profilPublicProvider(userId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          profil.hasValue ? profil.value!.displayName : 'Profil Dealplace',
        ),
      ),
      body: SafeArea(
        top: false,
        child: switch (profil) {
          AsyncData(:final value) => RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(profilPublicProvider(userId));
                ref.invalidate(
                  sectionAnnoncesProvider((userId: userId, family: 'service')),
                );
                ref.invalidate(
                  sectionAnnoncesProvider((userId: userId, family: 'good')),
                );
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _EnTetePublic(profil: value),
                    const SizedBox(height: 16),
                    ProfilDealplaceView(
                      userId: userId,
                      seekingPublic: value.dealplaceSeeking,
                    ),
                  ],
                ),
              ),
            ),
          AsyncError() => _Erreur(
              onRetry: () => ref.invalidate(profilPublicProvider(userId)),
            ),
          _ => const Center(child: CircularProgressIndicator()),
        },
      ),
    );
  }
}

/// En-tête public : avatar, nom, commune, bio (courte).
class _EnTetePublic extends StatelessWidget {
  const _EnTetePublic({required this.profil});

  final ProfilPublic profil;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AvatarRond(
              initiales: profil.initiales,
              avatarUrl: profil.avatarUrl,
              rayon: 32,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    profil.displayName,
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (profil.city != null && profil.city!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.place_outlined,
                          size: 15,
                          color: EndirekColors.encreSecondaire,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            '${profil.city}, La Réunion',
                            style: const TextStyle(
                              color: EndirekColors.encreSecondaire,
                              fontSize: 13.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (profil.bio.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      profil.bio,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: EndirekColors.encre,
                        fontSize: 13.5,
                        height: 1.4,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Erreur extends StatelessWidget {
  const _Erreur({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.person_off_outlined,
              size: 40,
              color: EndirekColors.encreSecondaire,
            ),
            const SizedBox(height: 12),
            const Text(
              'Profil introuvable ou indisponible.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 14,
              ),
            ),
            TextButton(onPressed: onRetry, child: const Text('Réessayer')),
          ],
        ),
      ),
    );
  }
}

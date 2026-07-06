import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/post_type.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../post_composer/presentation/type_bottom_sheet.dart';
import '../application/posts_liste_controller.dart';
import 'widgets/avatar_rond.dart';
import 'widgets/post_card.dart';

/// Onglet Accueil : composer compact en tête (avatar du user + champ
/// factice « Que se passe-t-il ? ») puis fil d'actualité scoré, en
/// infinite scroll (offset/limit) avec tirer-pour-rafraîchir.
class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen> {
  final ScrollController _defilement = ScrollController();

  @override
  void initState() {
    super.initState();
    _defilement.addListener(_surDefilement);
    // Premier chargement (no-op si le fil est déjà initialisé — l'onglet
    // reste monté dans l'IndexedStack du shell).
    Future.microtask(() => ref.read(feedProvider.notifier).charger());
  }

  @override
  void dispose() {
    _defilement.dispose();
    super.dispose();
  }

  /// Infinite scroll : demande la page suivante à l'approche du bas.
  void _surDefilement() {
    if (_defilement.position.pixels >=
        _defilement.position.maxScrollExtent - 400) {
      ref.read(feedProvider.notifier).chargerSuite();
    }
  }

  @override
  Widget build(BuildContext context) {
    final PostsListeState etat = ref.watch(feedProvider);

    return RefreshIndicator(
      onRefresh: () => ref.read(feedProvider.notifier).rafraichir(),
      child: ListView.builder(
        controller: _defilement,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 8, bottom: 24),
        // 1 en-tête (composer) + posts + 1 pied (chargement / états).
        itemCount: etat.posts.length + 2,
        itemBuilder: (context, index) {
          if (index == 0) {
            return const _ComposerCompact();
          }
          if (index <= etat.posts.length) {
            return PostCard(post: etat.posts[index - 1]);
          }
          return _PiedDeListe(etat: etat);
        },
      ),
    );
  }
}

/// Pied du fil : indicateur de page suivante, états initiaux (chargement,
/// erreur avec bouton réessayer, liste vide) et fin de liste.
class _PiedDeListe extends ConsumerWidget {
  const _PiedDeListe({required this.etat});

  final PostsListeState etat;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (etat.chargement || (!etat.initialise && etat.erreur == null)) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (etat.erreur != null && etat.posts.isEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(32, 40, 32, 16),
        child: Column(
          children: [
            const Icon(
              Icons.wifi_off_outlined,
              size: 40,
              color: EndirekColors.encreSecondaire,
            ),
            const SizedBox(height: 12),
            Text(
              etat.erreur!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 14,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: () => ref.read(feedProvider.notifier).rafraichir(),
              icon: const Icon(Icons.refresh),
              label: const Text('Réessayer'),
            ),
          ],
        ),
      );
    }
    if (etat.initialise && etat.posts.isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(32, 48, 32, 16),
        child: Column(
          children: [
            Icon(
              Icons.forum_outlined,
              size: 40,
              color: EndirekColors.encreSecondaire,
            ),
            SizedBox(height: 12),
            Text(
              'Aucune publication pour le moment.\nLancez la conversation !',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ],
        ),
      );
    }
    if (etat.chargementSuite) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 20),
        child: Center(
          child: SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          ),
        ),
      );
    }
    return const SizedBox(height: 8);
  }
}

/// Composer compact : avatar de l'utilisateur (tap → profil) + champ
/// factice qui ouvre le choix du type puis l'écran de création.
class _ComposerCompact extends ConsumerWidget {
  const _ComposerCompact();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState auth = ref.watch(authControllerProvider);
    final profil = auth is AuthSignedIn ? auth.profile : null;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: EndirekColors.bordure),
      ),
      child: Row(
        children: [
          // L'avatar mène au profil (l'écran profil n'est plus un onglet).
          InkWell(
            customBorder: const CircleBorder(),
            onTap: () => context.push('/profile'),
            child: AvatarRond(
              initiales: profil?.initiales ?? '?',
              avatarUrl: profil?.avatarUrl,
              rayon: 20,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(22),
              onTap: () => _ouvrirComposer(context),
              child: Container(
                height: 42,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                alignment: Alignment.centerLeft,
                decoration: BoxDecoration(
                  color: EndirekColors.surface,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: const Text(
                  'Que se passe-t-il ?',
                  style: TextStyle(
                    color: EndirekColors.encreSecondaire,
                    fontSize: 14.5,
                  ),
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Ajouter une photo',
            onPressed: () => _ouvrirComposer(context),
            icon: const Icon(
              Icons.photo_library_outlined,
              color: EndirekColors.bleu,
            ),
          ),
        ],
      ),
    );
  }

  /// Choix du type (bottom sheet pilotée par GET /posts/types) puis écran
  /// de création ; au retour d'une création réussie, confirme en snackbar
  /// (le fil a déjà été rafraîchi par l'écran de création).
  Future<void> _ouvrirComposer(BuildContext context) async {
    final PostType? type = await montrerChoixTypePost(context);
    if (type == null || !context.mounted) {
      return;
    }
    final bool? publie =
        await context.push<bool>('/compose?type=${type.slug}');
    if (publie == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Votre publication est en ligne')),
      );
    }
  }
}

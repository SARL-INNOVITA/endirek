import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/user_profile.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/config/api_config.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../feed/application/posts_liste_controller.dart';
import 'widgets/carte_publication_compacte.dart';

/// Écran du profil de l'utilisateur COURANT (étapes 3-4).
///
/// Couverture (si présente), avatar avec initiales en repli, nom, ville,
/// bio, stats abonnés/abonnements/publications, boutons « Modifier le
/// profil » et « Se déconnecter », puis la section « Mes publications »
/// (posts 'active' + 'hidden', cartes compactes → détail). Tirer vers le
/// bas pour tout rafraîchir. Accessible via l'avatar du composer du fil.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    // Recharge « Mes publications » à chaque ouverture du profil (une
    // publication a pu être créée/supprimée depuis la dernière visite).
    Future.microtask(
      () => ref.read(mesPublicationsProvider.notifier).rafraichir(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final AuthState etatAuth = ref.watch(authControllerProvider);

    // Pendant la restauration de session (ou juste après une déconnexion,
    // le temps que le routeur redirige), on affiche un simple indicateur.
    if (etatAuth is! AuthSignedIn) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    final UserProfile profil = etatAuth.profile;

    return Scaffold(
      appBar: AppBar(title: const Text('Mon profil')),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () => Future.wait([
            ref.read(authControllerProvider.notifier).refreshProfile(),
            ref.read(mesPublicationsProvider.notifier).rafraichir(),
          ]),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _EnTeteProfil(profil: profil),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 56, 24, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        profil.displayName,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: EndirekColors.encre,
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (profil.city != null && profil.city!.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.place_outlined,
                              size: 16,
                              color: EndirekColors.encreSecondaire,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              profil.city!,
                              style: const TextStyle(
                                color: EndirekColors.encreSecondaire,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (profil.bio.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          profil.bio,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: EndirekColors.encre,
                            fontSize: 15,
                            height: 1.4,
                          ),
                        ),
                      ],
                      const SizedBox(height: 24),
                      _RangeeStats(profil: profil),
                      const SizedBox(height: 24),
                      FilledButton.icon(
                        onPressed: () => context.go('/profile/edit'),
                        icon: const Icon(Icons.edit_outlined, size: 20),
                        label: const Text('Modifier le profil'),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: () => _confirmerDeconnexion(context, ref),
                        icon: const Icon(Icons.logout, size: 20),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFB3261E),
                          side: const BorderSide(color: Color(0xFFF3C7C3)),
                        ),
                        label: const Text('Se déconnecter'),
                      ),
                      const SizedBox(height: 32),
                      const Text(
                        'Mes publications',
                        style: TextStyle(
                          color: EndirekColors.encre,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const _SectionMesPublications(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmerDeconnexion(BuildContext context, WidgetRef ref) async {
    final bool? confirme = await showDialog<bool>(
      context: context,
      builder: (contexteDialogue) => AlertDialog(
        title: const Text('Se déconnecter ?'),
        content: const Text(
          'Vous devrez saisir à nouveau vos identifiants pour vous reconnecter.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contexteDialogue).pop(false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.of(contexteDialogue).pop(true),
            child: const Text('Se déconnecter'),
          ),
        ],
      ),
    );
    if (confirme == true) {
      // La redirection vers /login est gérée par le routeur.
      await ref.read(authControllerProvider.notifier).logout();
    }
  }
}

/// Couverture + avatar qui déborde sur le contenu.
class _EnTeteProfil extends StatelessWidget {
  const _EnTeteProfil({required this.profil});

  final UserProfile profil;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        SizedBox(
          height: 170,
          width: double.infinity,
          child: (profil.coverUrl != null && profil.coverUrl!.isNotEmpty)
              ? Image.network(
                  // Réécrit l'origine localhost éventuelle (émulateur
                  // Android → 10.0.2.2), comme partout ailleurs dans l'app.
                  ApiConfig.resolveMediaUrl(profil.coverUrl!),
                  fit: BoxFit.cover,
                  // Image indisponible : on retombe sur le dégradé bleu.
                  errorBuilder: (_, _, _) => const _CouvertureParDefaut(),
                )
              : const _CouvertureParDefaut(),
        ),
        Positioned(
          bottom: -44,
          child: _Avatar(profil: profil),
        ),
      ],
    );
  }
}

class _CouvertureParDefaut extends StatelessWidget {
  const _CouvertureParDefaut();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [EndirekColors.bleu, Color(0xFF63A9E8)],
        ),
      ),
    );
  }
}

/// Avatar rond : photo si disponible, sinon initiales sur fond bleu.
class _Avatar extends StatelessWidget {
  const _Avatar({required this.profil});

  final UserProfile profil;

  @override
  Widget build(BuildContext context) {
    final bool aUnePhoto =
        profil.avatarUrl != null && profil.avatarUrl!.isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: const BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
      ),
      child: CircleAvatar(
        radius: 44,
        backgroundColor: EndirekColors.bleu,
        foregroundImage: aUnePhoto
            // Réécriture localhost → adresse joignable (cf. resolveMediaUrl).
            ? NetworkImage(ApiConfig.resolveMediaUrl(profil.avatarUrl!))
            : null,
        // Si la photo ne charge pas, les initiales restent visibles dessous.
        onForegroundImageError: aUnePhoto ? (_, _) {} : null,
        child: Text(
          profil.initiales,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 28,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

/// Rangée abonnés / abonnements / publications, dans une carte arrondie.
class _RangeeStats extends StatelessWidget {
  const _RangeeStats({required this.profil});

  final UserProfile profil;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Row(
          children: [
            _Stat(valeur: profil.followersCount, libelle: 'Abonnés'),
            const _SeparateurVertical(),
            _Stat(valeur: profil.followingCount, libelle: 'Abonnements'),
            const _SeparateurVertical(),
            _Stat(valeur: profil.postsCount, libelle: 'Publications'),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.valeur, required this.libelle});

  final int valeur;
  final String libelle;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            '$valeur',
            style: const TextStyle(
              color: EndirekColors.encre,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            libelle,
            style: const TextStyle(
              color: EndirekColors.encreSecondaire,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _SeparateurVertical extends StatelessWidget {
  const _SeparateurVertical();

  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 36, color: EndirekColors.bordure);
  }
}

/// Section « Mes publications » : cartes compactes (tap → détail), bouton
/// « Voir plus » pour la pagination, états chargement/erreur/vide sobres.
class _SectionMesPublications extends ConsumerWidget {
  const _SectionMesPublications();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final PostsListeState etat = ref.watch(mesPublicationsProvider);

    if (etat.chargement && !etat.initialise) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (etat.erreur != null && etat.posts.isEmpty) {
      return Column(
        children: [
          Text(
            etat.erreur!,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: EndirekColors.encreSecondaire,
              fontSize: 13.5,
            ),
          ),
          TextButton(
            onPressed: () =>
                ref.read(mesPublicationsProvider.notifier).rafraichir(),
            child: const Text('Réessayer'),
          ),
        ],
      );
    }
    if (etat.initialise && etat.posts.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Text(
          'Vous n\'avez encore rien publié.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: EndirekColors.encreSecondaire,
            fontSize: 13.5,
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final post in etat.posts) CartePublicationCompacte(post: post),
        if (etat.chargementSuite)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
            ),
          )
        else if (etat.peutChargerSuite)
          TextButton(
            onPressed: () =>
                ref.read(mesPublicationsProvider.notifier).chargerSuite(),
            child: const Text('Voir plus'),
          ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/user_profile.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/config/api_config.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../dealplace/application/profil_dealplace_providers.dart';
import '../../dealplace/presentation/profil_dealplace_view.dart';
import '../../feed/application/posts_liste_controller.dart';
import '../../pages/application/pages_providers.dart';
import '../../pages/domain/page_models.dart';
import '../../pages/presentation/widgets/tuile_page_profil.dart';
import 'widgets/carte_publication_compacte.dart';

/// Écran du profil de l'utilisateur COURANT, en DEUX onglets (mockups 04/05) :
///
/// - « Mes infos » (étapes 3-4) : couverture, avatar, nom, ville, bio, stats
///   abonnés/abonnements/publications, boutons « Modifier le profil » et
///   « Se déconnecter », section « Mes publications » ;
/// - « Profil Dealplace » (CP2.2) : placeholder avis/deals (D59), « Ce que je
///   recherche » (éditable), mes annonces par famille (Services / Biens,
///   masquées incluses avec badge).
///
/// Tirer vers le bas rafraîchit l'onglet courant. Accessible via l'avatar du
/// composer du fil.
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

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Mon profil'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Mes infos'),
              Tab(text: 'Profil Dealplace'),
            ],
          ),
        ),
        body: SafeArea(
          top: false,
          child: TabBarView(
            children: [
              _OngletMesInfos(profil: profil),
              const _OngletProfilDealplace(),
            ],
          ),
        ),
      ),
    );
  }
}

/// Onglet « Mes infos » — contenu historique du profil (étapes 3-4).
class _OngletMesInfos extends ConsumerWidget {
  const _OngletMesInfos({required this.profil});

  final UserProfile profil;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RefreshIndicator(
      onRefresh: () {
        ref.invalidate(mesPagesProvider);
        return Future.wait([
          ref.read(authControllerProvider.notifier).refreshProfile(),
          ref.read(mesPublicationsProvider.notifier).rafraichir(),
        ]);
      },
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
                        'Mes pages',
                        style: TextStyle(
                          color: EndirekColors.encre,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const _SectionMesPages(),
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

/// Onglet « Profil Dealplace » (CP2.2) : la vue partagée du volet Dealplace,
/// en mode « moi » (annonces actives + masquées, « Ce que je recherche »
/// éditable). Tirer vers le bas recharge le profil et les deux sections.
class _OngletProfilDealplace extends ConsumerWidget {
  const _OngletProfilDealplace();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(
          sectionAnnoncesProvider((userId: null, family: 'service')),
        );
        ref.invalidate(
          sectionAnnoncesProvider((userId: null, family: 'good')),
        );
        await ref.read(authControllerProvider.notifier).refreshProfile();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        child: const ProfilDealplaceView(),
      ),
    );
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

/// Section « Mes pages » (Lot 3) : tuiles de mes pages restaurant/entreprise
/// (statut masqué inclus, tap → écran public) + bouton « Créer une page »,
/// états chargement/erreur/vide sobres.
class _SectionMesPages extends ConsumerWidget {
  const _SectionMesPages();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<OwnerPageCard>> etat = ref.watch(mesPagesProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        switch (etat) {
          AsyncData(:final value) when value.isEmpty => const Padding(
              padding: EdgeInsets.only(bottom: 4),
              child: Text(
                'Vous n\'avez pas encore de page. Créez la page de votre '
                'restaurant ou de votre entreprise !',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 13.5,
                  height: 1.4,
                ),
              ),
            ),
          AsyncData(:final value) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final OwnerPageCard page in value)
                  TuilePageProfil(page: page),
              ],
            ),
          AsyncError() => Column(
              children: [
                const Text(
                  'Impossible de charger vos pages.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: EndirekColors.encreSecondaire,
                    fontSize: 13.5,
                  ),
                ),
                TextButton(
                  onPressed: () => ref.invalidate(mesPagesProvider),
                  child: const Text('Réessayer'),
                ),
              ],
            ),
          _ => const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            ),
        },
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => context.push('/pages/create'),
          icon: const Icon(Icons.add_business_outlined, size: 18),
          label: const Text('Créer une page'),
        ),
      ],
    );
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

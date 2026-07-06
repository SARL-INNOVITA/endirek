import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show Icons;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/feed/presentation/feed_screen.dart';
import '../../features/post_composer/presentation/create_post_screen.dart';
import '../../features/post_detail/presentation/post_detail_screen.dart';
import '../../features/profile/presentation/edit_profile_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_state.dart';
import '../shell/app_shell.dart';
import '../shell/placeholder_screen.dart';

/// Routeur de l'application (étape 4 : shell 4 onglets + cœur social).
///
/// Navigation :
/// - /login, /register : hors shell (plein écran) ;
/// - shell à 4 onglets (StatefulShellRoute.indexedStack — chaque onglet
///   garde son état) : /home (fil RÉEL), /map, /news, /dealplace
///   (placeholders propres, Carte → étape 5, News/Dealplace → lots
///   suivants) ;
/// - /post/:id (détail), /compose (création) et /profile (+ /profile/edit) :
///   hors shell, poussés PLEIN ÉCRAN au-dessus des onglets — le profil est
///   accessible via l'avatar du composer du fil.
///
/// La redirection est pilotée par l'état d'authentification :
/// - état inconnu (restauration de session) → on reste en place, l'écran de
///   connexion affiche un indicateur de chargement ;
/// - déconnecté → tout mène à /login (sauf /register) ;
/// - connecté   → les écrans d'auth mènent à /home.
final routerProvider = Provider<GoRouter>((ref) {
  // Petit pont Riverpod → Listenable : chaque changement d'état d'auth
  // demande au routeur de réévaluer sa redirection.
  final ValueNotifier<int> rafraichissement = ValueNotifier<int>(0);
  ref.onDispose(rafraichissement.dispose);
  ref.listen<AuthState>(
    authControllerProvider,
    (_, _) => rafraichissement.value++,
  );

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: rafraichissement,
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      // Shell connecté : header Endirek + bottom nav 4 onglets.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (context, state) => const FeedScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/map',
                builder: (context, state) => const PlaceholderScreen(
                  icone: Icons.map_outlined,
                  titre: 'La carte arrive à l\'étape 5',
                  message:
                      'Publications géolocalisées, alertes météo et trafic '
                      'de toute l\'île, en temps réel.',
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/news',
                builder: (context, state) => const PlaceholderScreen(
                  icone: Icons.newspaper_outlined,
                  titre: 'News',
                  message: 'Bientôt disponible.',
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/dealplace',
                builder: (context, state) => const PlaceholderScreen(
                  icone: Icons.storefront_outlined,
                  titre: 'Dealplace',
                  message: 'Bientôt disponible.',
                ),
              ),
            ],
          ),
        ],
      ),
      // Écrans plein écran au-dessus du shell.
      GoRoute(
        path: '/post/:id',
        builder: (context, state) =>
            PostDetailScreen(postId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/compose',
        builder: (context, state) => CreatePostScreen(
          typeSlug: state.uri.queryParameters['type'] ?? '',
        ),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
        routes: [
          GoRoute(
            path: 'edit',
            builder: (context, state) => const EditProfileScreen(),
          ),
        ],
      ),
    ],
    redirect: (context, state) {
      final AuthState auth = ref.read(authControllerProvider);
      final String destination = state.matchedLocation;
      final bool versEcranAuth =
          destination == '/login' || destination == '/register';

      return switch (auth) {
        // Restauration en cours : pas de redirection, les écrans affichent
        // un indicateur de chargement le temps de trancher.
        AuthUnknown() => null,
        AuthSignedOut() => versEcranAuth ? null : '/login',
        AuthSignedIn() => versEcranAuth ? '/home' : null,
      };
    },
  );
});

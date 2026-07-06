import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/profile/presentation/edit_profile_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_state.dart';

/// Routeur de l'application (étape 3 : auth + profil uniquement).
///
/// La redirection est pilotée par l'état d'authentification :
/// - état inconnu (restauration de session) → on reste en place, l'écran de
///   connexion affiche un indicateur de chargement ;
/// - déconnecté → tout mène à /login (sauf /register) ;
/// - connecté   → les écrans d'auth mènent à /profile.
///
/// Le shell à 4 onglets (Accueil, Carte, News, Dealplace) arrive à l'étape 7.
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
        AuthSignedIn() => versEcranAuth ? '/profile' : null,
      };
    },
  );
});

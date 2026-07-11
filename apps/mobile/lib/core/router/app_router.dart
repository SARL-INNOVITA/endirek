import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show Icons;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/camera_detail/presentation/camera_detail_screen.dart';
import '../../features/dealplace/presentation/create_listing_screen.dart';
import '../../features/dealplace/presentation/dealplace_profil_screen.dart';
import '../../features/dealplace/presentation/dealplace_screen.dart';
import '../../features/dealplace/presentation/listing_detail_screen.dart';
import '../../features/deals/presentation/deal_screen.dart';
import '../../features/deals/presentation/deals_screen.dart';
import '../../features/deals/presentation/propose_deal_screen.dart';
import '../../features/feed/presentation/feed_screen.dart';
import '../../features/map/presentation/map_screen.dart';
import '../../features/messages/presentation/chat_screen.dart';
import '../../features/messages/presentation/conversations_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
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
///   garde son état) : /home (fil RÉEL) et /map (carte RÉELLE, mode « Météo &
///   trafic », étape 5) ; /news et /dealplace restent des placeholders propres
///   (lots suivants) ;
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
                builder: (context, state) => const MapScreen(),
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
                builder: (context, state) => const DealplaceScreen(),
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
        path: '/camera/:id',
        builder: (context, state) =>
            CameraDetailScreen(cameraId: state.pathParameters['id']!),
      ),
      // Dealplace (CP2.1/CP2.2) : création, profil public et détail d'annonce,
      // plein écran au-dessus du shell. Les routes statiques ('/dealplace/create',
      // '/dealplace/profil/...') AVANT '/dealplace/:id' pour ne pas être
      // capturées par le paramètre dynamique.
      GoRoute(
        path: '/dealplace/create',
        builder: (context, state) => const CreateListingScreen(),
      ),
      GoRoute(
        path: '/dealplace/profil/:userId',
        builder: (context, state) => DealplaceProfilScreen(
          userId: state.pathParameters['userId']!,
        ),
      ),
      // Contacter le vendeur (CP2.3) : fil lié à l'annonce (repris s'il
      // existe, créé au premier message sinon).
      GoRoute(
        path: '/dealplace/:id/contact',
        builder: (context, state) =>
            ChatScreen.pourAnnonce(listingId: state.pathParameters['id']!),
      ),
      // Proposer un deal (CP2.4) — ?recipient= quand le propriétaire propose
      // depuis une conversation.
      GoRoute(
        path: '/dealplace/:id/proposer',
        builder: (context, state) => ProposeDealScreen(
          listingId: state.pathParameters['id']!,
          recipientId: state.uri.queryParameters['recipient'],
        ),
      ),
      GoRoute(
        path: '/dealplace/:id',
        builder: (context, state) =>
            ListingDetailScreen(listingId: state.pathParameters['id']!),
      ),
      // Deals contractuels (CP2.4) : liste + page de deal, plein écran.
      GoRoute(
        path: '/deals',
        builder: (context, state) => const DealsScreen(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (context, state) =>
                DealScreen(dealId: state.pathParameters['id']!),
          ),
        ],
      ),
      // Messagerie (CP2.3) : liste des conversations + fil, plein écran.
      GoRoute(
        path: '/messages',
        builder: (context, state) => const ConversationsScreen(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (context, state) =>
                ChatScreen(conversationId: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsScreen(),
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

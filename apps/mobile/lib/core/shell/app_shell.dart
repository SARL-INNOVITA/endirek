import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/messages/application/messages_unread_controller.dart';
import '../../features/notifications/application/unread_count_controller.dart';
import '../theme/endirek_theme.dart';

/// Coquille de navigation de l'app connectée : header Endirek commun (logo
/// texte centré + messagerie ACTIVE (CP2.3) et cloche de notifications ACTIVE
/// à droite, chacune avec son badge) et bottom nav 4 onglets (Accueil, Carte,
/// News, Dealplace).
///
/// Portée par un StatefulShellRoute.indexedStack : chaque onglet conserve son
/// état (position de scroll du fil, carte chargée…) en changeant de branche.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'ENDIREK',
          style: TextStyle(
            color: EndirekColors.bleu,
            fontSize: 22,
            fontWeight: FontWeight.w800,
            letterSpacing: 2.5,
          ),
        ),
        centerTitle: true,
        actions: const [
          // Messagerie (CP2.3) : ACTIVE, badge = conversations avec non-lus.
          _IconeMessagerie(),
          // Notifications (étape 5) : ACTIVE, avec badge de non-lues.
          _ClocheNotifications(),
          SizedBox(width: 4),
        ],
      ),
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          // Re-taper l'onglet courant ramène en haut de sa pile.
          initialLocation: index == navigationShell.currentIndex,
        ),
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFE0EDFA),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: EndirekColors.bleu),
            label: 'Accueil',
          ),
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map, color: EndirekColors.bleu),
            label: 'Carte',
          ),
          NavigationDestination(
            icon: Icon(Icons.newspaper_outlined),
            selectedIcon: Icon(Icons.newspaper, color: EndirekColors.bleu),
            label: 'News',
          ),
          NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront, color: EndirekColors.bleu),
            label: 'Dealplace',
          ),
        ],
      ),
    );
  }
}

/// Cloche de notifications ACTIVE : ouvre /notifications au tap et affiche un
/// badge du nombre de non-lues (unreadCountProvider — alimenté par le socket
/// temps réel et le polling de repli).
class _ClocheNotifications extends ConsumerWidget {
  const _ClocheNotifications();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int nonLues = ref.watch(unreadCountProvider);
    return IconButton(
      tooltip: 'Notifications',
      onPressed: () => context.push('/notifications'),
      icon: Badge(
        isLabelVisible: nonLues > 0,
        label: Text(nonLues > 99 ? '99+' : '$nonLues'),
        backgroundColor: const Color(0xFFDC2626),
        child: const Icon(Icons.notifications_none),
      ),
    );
  }
}

/// Messagerie ACTIVE (CP2.3) : ouvre /messages au tap et affiche un badge du
/// nombre de conversations avec non-lus (messagerieNonLuesProvider — alimenté
/// par le socket temps réel et le polling de repli, comme la cloche).
class _IconeMessagerie extends ConsumerWidget {
  const _IconeMessagerie();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int nonLues = ref.watch(messagerieNonLuesProvider);
    return IconButton(
      tooltip: 'Messagerie',
      onPressed: () => context.push('/messages'),
      icon: Badge(
        isLabelVisible: nonLues > 0,
        label: Text(nonLues > 99 ? '99+' : '$nonLues'),
        backgroundColor: const Color(0xFFDC2626),
        child: const Icon(Icons.chat_bubble_outline),
      ),
    );
  }
}

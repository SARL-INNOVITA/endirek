import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/endirek_theme.dart';

/// Coquille de navigation de l'app connectée : header Endirek commun
/// (logo texte centré + icônes messagerie/notifications à droite, INACTIVES
/// au Lot 1) et bottom nav 4 onglets (Accueil, Carte, News, Dealplace).
///
/// Portée par un StatefulShellRoute.indexedStack : chaque onglet conserve
/// son état (position de scroll du fil incluse) en changeant de branche.
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
          // Messagerie (Lot 2) et notifications (étape 5) : icônes présentes
          // mais INACTIVES — le tooltip s'affiche à l'appui long.
          _ActionInactive(
            icone: Icons.chat_bubble_outline,
            tooltip: 'Messagerie — bientôt disponible',
          ),
          _ActionInactive(
            icone: Icons.notifications_none,
            tooltip: 'Notifications — bientôt disponibles',
          ),
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

/// Icône d'action du header volontairement INACTIVE (fonctionnalité d'un
/// lot ultérieur) : grisée, avec tooltip « bientôt » à l'appui long.
class _ActionInactive extends StatelessWidget {
  const _ActionInactive({required this.icone, required this.tooltip});

  final IconData icone;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      triggerMode: TooltipTriggerMode.tap,
      child: IconButton(
        // Inactif : le Tooltip parent capte le tap et affiche « bientôt ».
        onPressed: null,
        disabledColor: EndirekColors.encreSecondaire,
        icon: Icon(icone),
      ),
    );
  }
}

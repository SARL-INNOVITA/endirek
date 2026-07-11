import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/notification.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../../core/utils/temps_relatif.dart';
import '../application/notifications_controller.dart';
import '../domain/notification_presentation.dart';

/// Écran Notifications (/notifications) : liste antéchronologique des
/// notifications du user courant. Non lues surlignées ; tap → marque lu +
/// navigue vers /post/:postId si le payload en porte un ; « Tout marquer comme
/// lu » ; pull-to-refresh ; états chargement / vide / erreur.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(notificationsControllerProvider.notifier).chargerSiBesoin(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final NotificationsState etat = ref.watch(notificationsControllerProvider);
    final bool aDesNonLues = etat.items.any((n) => !n.lue);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        leading: const BackButton(),
        actions: [
          if (aDesNonLues)
            TextButton(
              onPressed: () => ref
                  .read(notificationsControllerProvider.notifier)
                  .toutMarquerLu(),
              child: const Text('Tout marquer comme lu'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(notificationsControllerProvider.notifier).rafraichir(),
        child: _corps(etat),
      ),
    );
  }

  Widget _corps(NotificationsState etat) {
    // Premier chargement.
    if (etat.chargement && !etat.initialise) {
      return const Center(child: CircularProgressIndicator());
    }
    // Erreur sans données.
    if (etat.erreur != null && etat.items.isEmpty) {
      return _EtatCentre(
        icone: Icons.wifi_off_outlined,
        message: etat.erreur!,
        action: TextButton.icon(
          onPressed: () =>
              ref.read(notificationsControllerProvider.notifier).rafraichir(),
          icon: const Icon(Icons.refresh),
          label: const Text('Réessayer'),
        ),
      );
    }
    // Vide.
    if (etat.initialise && etat.items.isEmpty) {
      return const _EtatCentre(
        icone: Icons.notifications_none,
        message: 'Aucune notification pour le moment.',
      );
    }
    // Liste.
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: etat.items.length,
      separatorBuilder: (_, _) =>
          const Divider(height: 1, indent: 68, endIndent: 12),
      itemBuilder: (context, index) => _TuileNotification(
        notif: etat.items[index],
        onTap: () => _ouvrir(etat.items[index]),
      ),
    );
  }

  /// Tap : marque lue puis navigue vers le post ou le deal du payload.
  Future<void> _ouvrir(AppNotification notif) async {
    await ref
        .read(notificationsControllerProvider.notifier)
        .marquerLue(notif.id);
    if (!mounted) {
      return;
    }
    final String? dealId = notif.dealId;
    if (dealId != null) {
      context.push('/deals/$dealId');
      return;
    }
    final String? postId = notif.postId;
    if (postId != null) {
      context.push('/post/$postId');
    }
  }
}

/// Une ligne de notification : icône de type, libellé français, temps relatif ;
/// fond teinté et pastille bleue tant qu'elle n'est pas lue.
class _TuileNotification extends StatelessWidget {
  const _TuileNotification({required this.notif, required this.onTap});

  final AppNotification notif;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final NotificationPresentation p = presentationNotification(notif);
    return Material(
      color: notif.lue ? Colors.white : const Color(0xFFEAF2FC),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: p.couleur.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(p.icone, color: p.couleur, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.libelle,
                      style: TextStyle(
                        color: EndirekColors.encre,
                        fontSize: 14.5,
                        height: 1.3,
                        fontWeight:
                            notif.lue ? FontWeight.w500 : FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      tempsRelatif(notif.createdAt),
                      style: const TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 12.5,
                      ),
                    ),
                  ],
                ),
              ),
              // Pastille de non-lu.
              if (!notif.lue)
                Container(
                  margin: const EdgeInsets.only(top: 4, left: 8),
                  width: 9,
                  height: 9,
                  decoration: const BoxDecoration(
                    color: EndirekColors.bleu,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// État centré (chargement vide, erreur, liste vide) — scrollable pour que le
/// pull-to-refresh fonctionne même sans contenu.
class _EtatCentre extends StatelessWidget {
  const _EtatCentre({
    required this.icone,
    required this.message,
    this.action,
  });

  final IconData icone;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, contraintes) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: contraintes.maxHeight),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 40),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icone, size: 44, color: EndirekColors.encreSecondaire),
                    const SizedBox(height: 14),
                    Text(
                      message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 14.5,
                        height: 1.4,
                      ),
                    ),
                    if (action != null) ...[
                      const SizedBox(height: 16),
                      action!,
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

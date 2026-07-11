import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/api_config.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../feed/presentation/widgets/avatar_rond.dart';
import '../application/conversations_controller.dart';
import '../domain/conversation.dart';

/// Écran MESSAGERIE (/messages — CP2.3) : mes conversations triées par
/// activité. Chaque carte : avatar de l'interlocuteur, son nom, le titre de
/// l'annonce, le dernier message et un badge de non-lus. Tap → fil.
class ConversationsScreen extends ConsumerStatefulWidget {
  const ConversationsScreen({super.key});

  @override
  ConsumerState<ConversationsScreen> createState() =>
      _ConversationsScreenState();
}

class _ConversationsScreenState extends ConsumerState<ConversationsScreen> {
  @override
  void initState() {
    super.initState();
    // Recharge à chaque ouverture (un fil a pu évoluer depuis).
    Future.microtask(
      () => ref.read(conversationsControllerProvider.notifier).rafraichir(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ConversationsEtat etat = ref.watch(conversationsControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Messagerie')),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () =>
              ref.read(conversationsControllerProvider.notifier).rafraichir(),
          child: _contenu(etat),
        ),
      ),
    );
  }

  Widget _contenu(ConversationsEtat etat) {
    if (etat.chargement && !etat.initialise) {
      return const Center(child: CircularProgressIndicator());
    }
    if (etat.erreur != null && etat.conversations.isEmpty) {
      return _MessageCentre(
        icone: Icons.wifi_off_outlined,
        texte: etat.erreur!,
        action: TextButton(
          onPressed: () =>
              ref.read(conversationsControllerProvider.notifier).rafraichir(),
          child: const Text('Réessayer'),
        ),
      );
    }
    if (etat.initialise && etat.conversations.isEmpty) {
      return const _MessageCentre(
        icone: Icons.chat_bubble_outline,
        texte:
            'Aucune conversation pour le moment.\nContactez un vendeur '
            'depuis une annonce du Dealplace pour démarrer un échange.',
      );
    }
    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      itemCount: etat.conversations.length,
      itemBuilder: (context, index) =>
          _CarteConversation(conversation: etat.conversations[index]),
    );
  }
}

/// Carte d'une conversation dans la liste.
class _CarteConversation extends ConsumerWidget {
  const _CarteConversation({required this.conversation});

  final ConversationCard conversation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bool nonLu = conversation.unreadCount > 0;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () async {
          await context.push('/messages/${conversation.id}');
          // Retour du fil : les non-lus ont probablement changé.
          if (context.mounted) {
            await ref
                .read(conversationsControllerProvider.notifier)
                .rafraichir();
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AvatarRond(
                initiales: conversation.otherParticipant.initiales,
                avatarUrl: conversation.otherParticipant.avatarUrl,
                rayon: 24,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            conversation.otherParticipant.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: EndirekColors.encre,
                              fontSize: 15,
                              fontWeight:
                                  nonLu ? FontWeight.w800 : FontWeight.w700,
                            ),
                          ),
                        ),
                        if (conversation.lastMessageAt != null)
                          Text(
                            _dateCourte(conversation.lastMessageAt!),
                            style: const TextStyle(
                              color: EndirekColors.encreSecondaire,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        _VignetteAnnonce(listing: conversation.listing),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            conversation.listing.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: EndirekColors.encreSecondaire,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (conversation.lastMessage != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              conversation.lastMessage!.body,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: nonLu
                                    ? EndirekColors.encre
                                    : EndirekColors.encreSecondaire,
                                fontSize: 13.5,
                                fontWeight: nonLu
                                    ? FontWeight.w600
                                    : FontWeight.w400,
                              ),
                            ),
                          ),
                          if (nonLu) ...[
                            const SizedBox(width: 8),
                            _BadgeNonLus(nombre: conversation.unreadCount),
                          ],
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// « 14:32 » aujourd'hui, sinon « 12/07 ».
  static String _dateCourte(DateTime date) {
    final DateTime local = date.toLocal();
    final DateTime maintenant = DateTime.now();
    String deux(int n) => n.toString().padLeft(2, '0');
    final bool aujourdHui = local.year == maintenant.year &&
        local.month == maintenant.month &&
        local.day == maintenant.day;
    return aujourdHui
        ? '${deux(local.hour)}:${deux(local.minute)}'
        : '${deux(local.day)}/${deux(local.month)}';
  }
}

/// Petite vignette de l'annonce du fil (ou pictogramme).
class _VignetteAnnonce extends StatelessWidget {
  const _VignetteAnnonce({required this.listing});

  final ConversationListingRef listing;

  @override
  Widget build(BuildContext context) {
    const double cote = 18;
    final String? url = listing.coverThumbnailUrl;
    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: SizedBox(
        width: cote,
        height: cote,
        child: (url != null && url.isNotEmpty)
            ? Image.network(
                ApiConfig.resolveMediaUrl(url),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const _PictoAnnonce(),
              )
            : const _PictoAnnonce(),
      ),
    );
  }
}

class _PictoAnnonce extends StatelessWidget {
  const _PictoAnnonce();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: EndirekColors.surface,
      child: Icon(
        Icons.storefront_outlined,
        size: 13,
        color: EndirekColors.encreSecondaire,
      ),
    );
  }
}

/// Pastille rouge de non-lus d'un fil.
class _BadgeNonLus extends StatelessWidget {
  const _BadgeNonLus({required this.nombre});

  final int nombre;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFDC2626),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        nombre > 99 ? '99+' : '$nombre',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// État centré (vide / erreur).
class _MessageCentre extends StatelessWidget {
  const _MessageCentre({required this.icone, required this.texte, this.action});

  final IconData icone;
  final String texte;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    // ListView pour rester compatible avec le RefreshIndicator parent.
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(32, 96, 32, 0),
          child: Column(
            children: [
              Icon(icone, size: 40, color: EndirekColors.encreSecondaire),
              const SizedBox(height: 12),
              Text(
                texte,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 14,
                  height: 1.45,
                ),
              ),
              ?action,
            ],
          ),
        ),
      ],
    );
  }
}

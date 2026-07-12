import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/realtime/realtime_service.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../deals/application/deal_providers.dart';
import '../../deals/domain/deal_models.dart';
import '../application/messages_unread_controller.dart';
import '../data/messages_repository.dart';
import '../domain/conversation.dart';
import '../domain/message_chat.dart';

/// Écran de FIL de discussion (CP2.3) — deux modes :
/// - fil EXISTANT : `/messages/:id` (conversationId fourni) ;
/// - CONTACT depuis une annonce : `/dealplace/:id/contact` (listingId
///   fourni) — s'il existe déjà un fil pour cette annonce il est repris,
///   sinon le premier envoi le crée (get-or-create serveur).
///
/// Messages en bulles chronologiques (les miens à droite), champ d'envoi en
/// bas, réception en TEMPS RÉEL (event 'message.created' du socket — repli :
/// le fil se recharge à l'ouverture), marquage lu à l'ouverture et à chaque
/// message reçu pendant que le fil est affiché.
class ChatScreen extends ConsumerStatefulWidget {
  /// Fil existant (route /messages/:id).
  const ChatScreen({super.key, required this.conversationId})
      : listingId = null;

  /// Contact depuis une annonce (route /dealplace/:id/contact).
  const ChatScreen.pourAnnonce({super.key, required this.listingId})
      : conversationId = null;

  /// Fil existant (mode /messages/:id), sinon null.
  final String? conversationId;

  /// Annonce à contacter (mode /dealplace/:id/contact), sinon null.
  final String? listingId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final TextEditingController _saisie = TextEditingController();
  final ScrollController _defilement = ScrollController();
  StreamSubscription<RealtimeEvent>? _abonnement;

  ConversationCard? _conversation;
  List<MessageChat> _messages = [];
  bool _chargement = true;
  bool _envoiEnCours = false;
  String? _erreur;

  MessagesRepository get _repo => ref.read(messagesRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _charger();
    // Réception en direct : si le message concerne CE fil, on l'ajoute et on
    // le marque lu immédiatement (l'utilisateur a le fil sous les yeux).
    _abonnement =
        ref.read(realtimeServiceProvider).evenements.listen((evenement) {
      if (evenement is! MessageRecu || !mounted) {
        return;
      }
      final String? filId = _conversation?.id;
      if (filId == null || evenement.conversationId != filId) {
        return;
      }
      try {
        final message = MessageChat.fromJson(evenement.message);
        setState(() => _messages = [..._messages, message]);
        _defilerEnBas();
        unawaited(_marquerLu());
      } catch (_) {
        // Charge utile inattendue : le prochain rechargement resynchronise.
      }
    });
  }

  @override
  void dispose() {
    unawaited(_abonnement?.cancel());
    _saisie.dispose();
    _defilement.dispose();
    super.dispose();
  }

  Future<void> _charger() async {
    setState(() {
      _chargement = true;
      _erreur = null;
    });
    try {
      // Résout la conversation selon le mode d'entrée.
      ConversationCard? conversation;
      if (widget.conversationId != null) {
        conversation = await _repo.chargerConversation(widget.conversationId!);
      } else {
        conversation = await _repo.chargerFilPourAnnonce(widget.listingId!);
      }
      List<MessageChat> messages = [];
      if (conversation != null) {
        // Le serveur renvoie du plus récent au plus ancien : on inverse pour
        // l'affichage chronologique. Une page de 50 suffit au MVP.
        final page = await _repo.chargerMessages(conversation.id);
        messages = page.items.reversed.toList();
      }
      if (!mounted) {
        return;
      }
      setState(() {
        _conversation = conversation;
        _messages = messages;
        _chargement = false;
      });
      _defilerEnBas();
      if (conversation != null) {
        unawaited(_marquerLu());
      }
    } on ApiException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _chargement = false;
        _erreur = e.message;
      });
    }
  }

  Future<void> _marquerLu() async {
    final String? filId = _conversation?.id;
    if (filId == null) {
      return;
    }
    try {
      final int badge = await _repo.marquerLu(filId);
      ref.read(messagerieNonLuesProvider.notifier).definir(badge);
    } on ApiException {
      // Silencieux : le badge se resynchronisera (polling / prochain écran).
    }
  }

  Future<void> _envoyer() async {
    final String texte = _saisie.text.trim();
    if (texte.isEmpty || _envoiEnCours) {
      return;
    }
    setState(() => _envoiEnCours = true);
    try {
      MessageChat envoye;
      if (_conversation == null) {
        // Premier message : crée (ou reprend) le fil côté serveur.
        final resultat = await _repo.demarrerConversation(
          listingId: widget.listingId!,
          body: texte,
        );
        _conversation = resultat.conversation;
        envoye = resultat.message;
      } else {
        envoye = await _repo.envoyerMessage(_conversation!.id, texte);
      }
      if (!mounted) {
        return;
      }
      _saisie.clear();
      setState(() => _messages = [..._messages, envoye]);
      _defilerEnBas();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _envoiEnCours = false);
      }
    }
  }

  void _defilerEnBas() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_defilement.hasClients) {
        _defilement.jumpTo(_defilement.position.maxScrollExtent);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final AuthState auth = ref.watch(authControllerProvider);
    final String monId = auth is AuthSignedIn ? auth.profile.id : '';
    final ConversationCard? fil = _conversation;

    // Deal OUVERT lié au fil (bandeau + action « Proposer un deal » sinon).
    final dealOuvert =
        fil == null ? null : ref.watch(dealDeConversationProvider(fil.id));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          fil?.otherParticipant.displayName ?? 'Nouvelle conversation',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          // Proposer un deal depuis le fil (CP2.4) — pour les DEUX parties
          // (le propriétaire de l'annonce propose ici, pas depuis le détail).
          if (fil != null &&
              fil.listing.estActive &&
              dealOuvert?.hasValue == true &&
              dealOuvert?.value == null)
            IconButton(
              tooltip: 'Proposer un deal',
              onPressed: () => context.push(
                '/dealplace/${fil.listing.id}/proposer'
                '?recipient=${fil.otherParticipant.id}',
              ),
              icon: const Icon(Icons.handshake_outlined),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (fil != null) _EnTeteAnnonce(listing: fil.listing),
            if (dealOuvert?.value != null)
              _BandeauDeal(deal: dealOuvert!.value!),
            Expanded(child: _corps(monId)),
            _BarreSaisie(
              controleur: _saisie,
              envoiEnCours: _envoiEnCours,
              surEnvoi: _envoyer,
            ),
          ],
        ),
      ),
    );
  }

  Widget _corps(String monId) {
    if (_chargement) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_erreur != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _erreur!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 13.5,
              ),
            ),
            TextButton(onPressed: _charger, child: const Text('Réessayer')),
          ],
        ),
      );
    }
    if (_messages.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text(
            'Présentez-vous et posez votre question au vendeur : votre '
            'premier message ouvrira la conversation.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: EndirekColors.encreSecondaire,
              fontSize: 13.5,
              height: 1.45,
            ),
          ),
        ),
      );
    }
    return ListView.builder(
      controller: _defilement,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final message = _messages[index];
        return _BulleMessage(
          message: message,
          estDeMoi: message.senderId == monId,
        );
      },
    );
  }
}

/// Bandeau d'annonce en tête du fil : vignette + titre, tap → détail
/// (grisé si l'annonce n'est plus active — le fil reste consultable).
class _EnTeteAnnonce extends StatelessWidget {
  const _EnTeteAnnonce({required this.listing});

  final ConversationListingRef listing;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: EndirekColors.surface,
      child: InkWell(
        onTap: listing.estActive
            ? () => context.push('/dealplace/${listing.id}')
            : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              const Icon(
                Icons.storefront_outlined,
                size: 18,
                color: EndirekColors.encreSecondaire,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  listing.estActive
                      ? listing.title
                      : '${listing.title} (annonce indisponible)',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: listing.estActive
                        ? EndirekColors.encre
                        : EndirekColors.encreSecondaire,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (listing.estActive)
                const Icon(
                  Icons.chevron_right,
                  size: 18,
                  color: EndirekColors.encreSecondaire,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bulle d'un message : les miens à droite (bleu), les siens à gauche (gris).
class _BulleMessage extends StatelessWidget {
  const _BulleMessage({required this.message, required this.estDeMoi});

  final MessageChat message;
  final bool estDeMoi;

  @override
  Widget build(BuildContext context) {
    // Message masqué par la modération (CP2.5) : placeholder en italique
    // gris, stylé d'après `status` (le serveur remplace déjà le corps) —
    // bulle neutre pour rester lisible même sur mes propres messages.
    final bool masque = message.estMasque;
    return Align(
      alignment: estDeMoi ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        decoration: BoxDecoration(
          color: estDeMoi && !masque
              ? EndirekColors.bleu
              : EndirekColors.surface,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft: Radius.circular(estDeMoi ? 14 : 4),
            bottomRight: Radius.circular(estDeMoi ? 4 : 14),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (masque)
              const Text(
                'Message masqué par la modération.',
                style: TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 14.5,
                  fontStyle: FontStyle.italic,
                  height: 1.35,
                ),
              )
            else
              Text(
                message.body,
                style: TextStyle(
                  color: estDeMoi ? Colors.white : EndirekColors.encre,
                  fontSize: 14.5,
                  height: 1.35,
                ),
              ),
            const SizedBox(height: 2),
            Text(
              _heure(message.createdAt),
              style: TextStyle(
                color: estDeMoi && !masque
                    ? Colors.white.withValues(alpha: 0.75)
                    : EndirekColors.encreSecondaire,
                fontSize: 10.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _heure(DateTime date) {
    final DateTime local = date.toLocal();
    String deux(int n) => n.toString().padLeft(2, '0');
    return '${deux(local.hour)}:${deux(local.minute)}';
  }
}

/// Barre de saisie : champ multiligne borné + bouton d'envoi.
class _BarreSaisie extends StatelessWidget {
  const _BarreSaisie({
    required this.controleur,
    required this.envoiEnCours,
    required this.surEnvoi,
  });

  final TextEditingController controleur;
  final bool envoiEnCours;
  final VoidCallback surEnvoi;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 8,
      shadowColor: Colors.black.withValues(alpha: 0.08),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controleur,
                minLines: 1,
                maxLines: 4,
                maxLength: 2000,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  hintText: 'Votre message…',
                  counterText: '',
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(width: 6),
            IconButton.filled(
              tooltip: 'Envoyer',
              onPressed: envoiEnCours ? null : surEnvoi,
              icon: envoiEnCours
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.send),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bandeau du deal OUVERT lié au fil (CP2.4) : « Deal N — statut », tap →
/// page du deal.
class _BandeauDeal extends StatelessWidget {
  const _BandeauDeal({required this.deal});

  final DealCard deal;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFE0EDFA),
      child: InkWell(
        onTap: () => context.push('/deals/${deal.id}'),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              const Icon(Icons.handshake_outlined,
                  size: 17, color: EndirekColors.bleu),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Deal ${deal.dealNumber} — '
                  '${deal.status == 'proposed' ? 'proposition en attente' : 'en cours'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: EndirekColors.bleu,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Icon(Icons.chevron_right,
                  size: 18, color: EndirekColors.bleu),
            ],
          ),
        ),
      ),
    );
  }
}

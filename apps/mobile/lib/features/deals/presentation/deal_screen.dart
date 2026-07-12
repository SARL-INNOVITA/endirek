import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../dealplace/domain/dealplace_value.dart';
import '../application/deal_providers.dart';
import '../data/deals_repository.dart';
import '../domain/deal_models.dart';
import 'widgets/deal_stepper.dart';
import 'widgets/etoiles_avis.dart';

/// PAGE DE DEAL (/deals/:id — CP2.4, mockup 07) : en-tête (numéro, partenaire,
/// annonce et conversation liées), stepper 5 étapes dérivé, sections
/// d'éléments avec sous-éléments actionnables (honorer / valider selon mon
/// rôle), ajustements (proposer / décider), timeline de notes, actions
/// sensibles (annulation amiable en deux temps, litige) et bloc d'avis quand
/// le deal est conclu. Chaque action recharge la page (le serveur renvoie
/// l'état à jour) ; l'event temps réel `deal.updated` la rafraîchit quand la
/// contrepartie agit.
class DealScreen extends ConsumerWidget {
  const DealScreen({super.key, required this.dealId});

  final String dealId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deal = ref.watch(dealProvider(dealId));
    return Scaffold(
      appBar: AppBar(
        title: Text(
          deal.hasValue ? 'Deal ${deal.value!.dealNumber}' : 'Deal',
        ),
      ),
      body: SafeArea(
        top: false,
        child: switch (deal) {
          AsyncData(:final value) => _Contenu(deal: value),
          AsyncError() => Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Deal introuvable ou indisponible.',
                    style: TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 14,
                    ),
                  ),
                  TextButton(
                    onPressed: () => ref.invalidate(dealProvider(dealId)),
                    child: const Text('Réessayer'),
                  ),
                ],
              ),
            ),
          _ => const Center(child: CircularProgressIndicator()),
        },
      ),
    );
  }
}

/// Exécute une action de deal et rafraîchit la page ; les erreurs métier
/// (400/403/409) remontent en snackbar.
Future<void> _agir(
  BuildContext context,
  WidgetRef ref,
  String dealId,
  Future<Deal> Function(DealsRepository repo) action,
) async {
  try {
    await action(ref.read(dealsRepositoryProvider));
    ref.invalidate(dealProvider(dealId));
  } on ApiException catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }
}

class _Contenu extends ConsumerWidget {
  const _Contenu({required this.deal});

  final Deal deal;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState auth = ref.watch(authControllerProvider);
    final String monId = auth is AuthSignedIn ? auth.profile.id : '';
    final bool jePropose = deal.proposerId == monId;

    final mesItems =
        deal.items.where((i) => i.providerId == monId).toList();
    final sesItems =
        deal.items.where((i) => i.providerId != monId).toList();

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(dealProvider(deal.id)),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _EnTete(deal: deal),
          const SizedBox(height: 14),
          DealStepper(stage: deal.stage, status: deal.status),
          const SizedBox(height: 14),
          ..._bandeaux(context, ref, monId, jePropose),
          _SectionTitre(titre: 'Ce que j’offre'),
          if (mesItems.isEmpty) const _SectionVide(),
          for (final item in mesItems)
            _CarteElement(deal: deal, item: item, monId: monId),
          const SizedBox(height: 18),
          _SectionTitre(titre: 'Ce que mon deal-partner offre'),
          if (sesItems.isEmpty) const _SectionVide(),
          for (final item in sesItems)
            _CarteElement(deal: deal, item: item, monId: monId),
          const SizedBox(height: 18),
          _SectionAjustements(deal: deal, monId: monId),
          const SizedBox(height: 18),
          _SectionSuivi(deal: deal),
          if (deal.status == 'active') ...[
            const SizedBox(height: 18),
            _ActionsSensibles(deal: deal, monId: monId),
          ],
          if (deal.status == 'completed') ...[
            const SizedBox(height: 18),
            _SectionAvis(deal: deal, monId: monId),
          ],
        ],
      ),
    );
  }

  /// Bandeaux contextuels selon le statut / l'état d'annulation.
  List<Widget> _bandeaux(
    BuildContext context,
    WidgetRef ref,
    String monId,
    bool jePropose,
  ) {
    final List<Widget> bandeaux = [];
    if (deal.status == 'proposed') {
      bandeaux.add(_Bandeau(
        couleur: const Color(0xFFE0EDFA),
        icone: Icons.hourglass_top,
        texte: jePropose
            ? 'Proposition envoyée — en attente de la réponse de votre partenaire.'
            : 'Vous avez reçu cette proposition de deal.',
        actions: jePropose
            ? [
                TextButton(
                  onPressed: () =>
                      _agir(context, ref, deal.id, (r) => r.retirer(deal.id)),
                  child: const Text('Retirer ma proposition'),
                ),
              ]
            : [
                OutlinedButton(
                  onPressed: () =>
                      _agir(context, ref, deal.id, (r) => r.refuser(deal.id)),
                  child: const Text('Refuser'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () =>
                      _agir(context, ref, deal.id, (r) => r.accepter(deal.id)),
                  child: const Text('Accepter'),
                ),
              ],
      ));
    }
    if (deal.status == 'active' && deal.cancellationRequestedBy != null) {
      final bool parMoi = deal.cancellationRequestedBy == monId;
      bandeaux.add(_Bandeau(
        couleur: const Color(0xFFFDF3E7),
        icone: Icons.warning_amber_outlined,
        texte: parMoi
            ? 'Vous avez proposé une annulation amiable — votre partenaire doit confirmer.'
            : 'Votre partenaire propose une annulation amiable.',
        actions: parMoi
            ? [
                TextButton(
                  onPressed: () => _agir(
                      context, ref, deal.id, (r) => r.retirerAnnulation(deal.id)),
                  child: const Text('Retirer ma demande'),
                ),
              ]
            : [
                FilledButton.tonal(
                  onPressed: () => _agir(context, ref, deal.id,
                      (r) => r.demanderAnnulation(deal.id)),
                  child: const Text('Confirmer l’annulation'),
                ),
              ],
      ));
    }
    if (deal.status == 'disputed') {
      bandeaux.add(_Bandeau(
        couleur: const Color(0xFFFDECEA),
        icone: Icons.gavel_outlined,
        texte:
            'Litige déclaré${deal.disputeReason != null ? ' : ${deal.disputeReason}' : ''}. '
            'L’équipe de modération va examiner la situation.',
        actions: const [],
      ));
    }
    // Litige TRANCHÉ par la modération (CP2.5) — affiché quel que soit le
    // statut courant (cancelled/completed/active après reprise).
    if (deal.disputeResolvedAt != null) {
      final String libelle = switch (deal.disputeResolution) {
        'cancelled' => 'deal annulé',
        'completed' => 'deal conclu',
        'resumed' => 'reprise du deal',
        _ => 'décision rendue',
      };
      bandeaux.add(_Bandeau(
        couleur: const Color(0xFFE8F1FB),
        icone: Icons.gavel_outlined,
        texte: 'Litige tranché par la modération : $libelle.'
            '${deal.disputeResolutionNote != null ? ' Décision : ${deal.disputeResolutionNote}' : ''}',
        actions: const [],
      ));
    }
    if (deal.status == 'declined' || deal.status == 'cancelled') {
      bandeaux.add(_Bandeau(
        couleur: EndirekColors.surface,
        icone: Icons.block_outlined,
        texte: deal.status == 'declined'
            ? 'Cette proposition a été refusée.'
            : 'Ce deal a été annulé.',
        actions: const [],
      ));
    }
    if (bandeaux.isNotEmpty) {
      bandeaux.add(const SizedBox(height: 14));
    }
    return bandeaux;
  }
}

/// En-tête : partenaire, annonce liée, conversation liée, dates.
class _EnTete extends StatelessWidget {
  const _EnTete({required this.deal});

  final Deal deal;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _BadgeStatut(status: deal.status),
                const Spacer(),
                Text(
                  'Créé le ${_date(deal.createdAt)}',
                  style: const TextStyle(
                    color: EndirekColors.encreSecondaire,
                    fontSize: 12.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _LigneLien(
              icone: Icons.person_outline,
              libelle: 'Avec ${deal.otherParticipant.displayName}',
              onTap: () => context
                  .push('/dealplace/profil/${deal.otherParticipant.id}'),
            ),
            _LigneLien(
              icone: Icons.storefront_outlined,
              libelle: deal.listing.title,
              onTap: deal.listing.estActive
                  ? () => context.push('/dealplace/${deal.listing.id}')
                  : null,
            ),
            if (deal.conversationId != null)
              _LigneLien(
                icone: Icons.chat_bubble_outline,
                libelle: 'Conversation liée',
                onTap: () => context.push('/messages/${deal.conversationId}'),
              ),
            _LigneLien(
              icone: Icons.event_outlined,
              libelle: deal.dueDate == null
                  ? 'Échéance : non définie'
                  : 'Échéance : ${_date(deal.dueDate!)}',
              onTap: null,
            ),
          ],
        ),
      ),
    );
  }

  static String _date(DateTime d) {
    final l = d.toLocal();
    String deux(int n) => n.toString().padLeft(2, '0');
    return '${deux(l.day)}/${deux(l.month)}/${l.year}';
  }
}

class _LigneLien extends StatelessWidget {
  const _LigneLien({
    required this.icone,
    required this.libelle,
    required this.onTap,
  });

  final IconData icone;
  final String libelle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          children: [
            Icon(icone, size: 17, color: EndirekColors.encreSecondaire),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                libelle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: onTap != null
                      ? EndirekColors.bleu
                      : EndirekColors.encre,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (onTap != null)
              const Icon(
                Icons.chevron_right,
                size: 17,
                color: EndirekColors.encreSecondaire,
              ),
          ],
        ),
      ),
    );
  }
}

/// Badge de statut coloré.
class _BadgeStatut extends StatelessWidget {
  const _BadgeStatut({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (String libelle, Color fond, Color texte) = switch (status) {
      'proposed' => ('Proposé', const Color(0xFFE0EDFA), EndirekColors.bleu),
      'active' => ('En cours', const Color(0xFFE0EDFA), EndirekColors.bleu),
      'completed' => ('Conclu', const Color(0xFFE7F6EC), const Color(0xFF16A34A)),
      'declined' => ('Refusé', const Color(0xFFFDECEA), const Color(0xFFB3261E)),
      'cancelled' => ('Annulé', EndirekColors.surface, EndirekColors.encreSecondaire),
      'disputed' => ('Litige', const Color(0xFFFDECEA), const Color(0xFFB3261E)),
      _ => (status, EndirekColors.surface, EndirekColors.encreSecondaire),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: fond,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        libelle,
        style: TextStyle(color: texte, fontSize: 12.5, fontWeight: FontWeight.w700),
      ),
    );
  }
}

/// Bandeau contextuel avec actions.
class _Bandeau extends StatelessWidget {
  const _Bandeau({
    required this.couleur,
    required this.icone,
    required this.texte,
    required this.actions,
  });

  final Color couleur;
  final IconData icone;
  final String texte;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: couleur,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icone, size: 20, color: EndirekColors.encre),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  texte,
                  style: const TextStyle(
                    color: EndirekColors.encre,
                    fontSize: 13.5,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
          if (actions.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: actions),
          ],
        ],
      ),
    );
  }
}

class _SectionTitre extends StatelessWidget {
  const _SectionTitre({required this.titre});

  final String titre;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        titre,
        style: const TextStyle(
          color: EndirekColors.encre,
          fontSize: 16,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _SectionVide extends StatelessWidget {
  const _SectionVide();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(bottom: 8),
      child: Text(
        'Aucun élément de ce côté du deal.',
        style: TextStyle(color: EndirekColors.encreSecondaire, fontSize: 13),
      ),
    );
  }
}

/// Carte d'un élément : titre, nature, valeur, badge dérivé, sous-éléments
/// actionnables selon mon rôle.
class _CarteElement extends ConsumerWidget {
  const _CarteElement({
    required this.deal,
    required this.item,
    required this.monId,
  });

  final Deal deal;
  final DealItem item;
  final String monId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bool jeFournis = item.providerId == monId;
    final bool actif = deal.status == 'active';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  switch (item.kind) {
                    'good' => Icons.inventory_2_outlined,
                    'money' => Icons.payments_outlined,
                    _ => Icons.handyman_outlined,
                  },
                  size: 20,
                  color: EndirekColors.bleu,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item.title,
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                _BadgeElement(badge: item.badge),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${switch (item.kind) { 'good' => 'Bien', 'money' => 'Paiement', _ => 'Service' }}'
              ' · Valeur estimée : ${formaterValeurAnnonce(valueKind: 'fixed', valueMin: item.value)}',
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 12.5,
              ),
            ),
            if (item.description.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                item.description,
                style: const TextStyle(
                  color: EndirekColors.encre,
                  fontSize: 13,
                  height: 1.35,
                ),
              ),
            ],
            const SizedBox(height: 8),
            for (final step in item.steps)
              _LigneStep(
                deal: deal,
                step: step,
                jeFournis: jeFournis,
                actif: actif,
              ),
          ],
        ),
      ),
    );
  }
}

/// Ligne d'un sous-élément : état + action contextuelle (honorer / valider).
class _LigneStep extends ConsumerWidget {
  const _LigneStep({
    required this.deal,
    required this.step,
    required this.jeFournis,
    required this.actif,
  });

  final Deal deal;
  final DealStep step;
  final bool jeFournis;
  final bool actif;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (IconData icone, Color couleur, String etat) = step.valide
        ? (Icons.check_circle, const Color(0xFF16A34A), 'Validé')
        : step.honore
            ? (Icons.radio_button_checked, const Color(0xFFF59E0B), 'En attente de validation')
            : (Icons.radio_button_unchecked, EndirekColors.encreSecondaire, 'À faire');
    // Action contextuelle : le FOURNISSEUR honore, la CONTREPARTIE valide.
    Widget? action;
    if (actif && jeFournis && !step.honore) {
      action = TextButton(
        onPressed: () => _agir(
            context, ref, deal.id, (r) => r.honorerStep(deal.id, step.id)),
        child: const Text('Marquer honoré'),
      );
    } else if (actif && !jeFournis && step.honore && !step.valide) {
      action = TextButton(
        onPressed: () => _agir(
            context, ref, deal.id, (r) => r.validerStep(deal.id, step.id)),
        child: const Text('Valider'),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(icone, size: 17, color: couleur),
          const SizedBox(width: 7),
          Expanded(
            child: Text(
              step.label,
              style: const TextStyle(color: EndirekColors.encre, fontSize: 13),
            ),
          ),
          if (action != null)
            action
          else
            Text(
              etat,
              style: TextStyle(color: couleur, fontSize: 11.5),
            ),
        ],
      ),
    );
  }
}

/// Badge d'un élément (dérivé serveur — mockup 07).
class _BadgeElement extends StatelessWidget {
  const _BadgeElement({required this.badge});

  final String badge;

  @override
  Widget build(BuildContext context) {
    final (String libelle, Color fond, Color texte) = switch (badge) {
      'honored' => ('Honoré', const Color(0xFFE7F6EC), const Color(0xFF16A34A)),
      'awaiting_validation' => (
          'En attente de validation',
          const Color(0xFFFDF3E7),
          const Color(0xFFB45309)
        ),
      'partial' => (
          'Validation partielle',
          const Color(0xFFFDF3E7),
          const Color(0xFFB45309)
        ),
      _ => ('À fournir', const Color(0xFFFDECEA), const Color(0xFFB3261E)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: fond,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        libelle,
        style: TextStyle(color: texte, fontSize: 10.5, fontWeight: FontWeight.w700),
      ),
    );
  }
}

/// Section « Ajustements proposés » : liste + proposition + décision.
class _SectionAjustements extends ConsumerWidget {
  const _SectionAjustements({required this.deal, required this.monId});

  final Deal deal;
  final String monId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(child: _SectionTitre(titre: 'Ajustements proposés')),
            if (deal.status == 'active')
              TextButton.icon(
                onPressed: () => _proposer(context, ref),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Proposer'),
              ),
          ],
        ),
        if (deal.adjustments.isEmpty)
          const Text(
            'Aucun ajustement pour le moment.',
            style: TextStyle(color: EndirekColors.encreSecondaire, fontSize: 13),
          ),
        for (final adj in deal.adjustments)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    switch (adj.kind) {
                      'add' => Icons.add_circle_outline,
                      'remove' => Icons.remove_circle_outline,
                      _ => Icons.edit_outlined,
                    },
                    size: 18,
                    color: EndirekColors.bleu,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${adj.proposedBy == monId ? 'Moi' : deal.otherParticipant.displayName} · '
                          '${switch (adj.kind) { 'add' => 'Ajouter', 'remove' => 'Supprimer', _ => 'Modifier' }}',
                          style: const TextStyle(
                            color: EndirekColors.encreSecondaire,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          adj.description,
                          style: const TextStyle(
                            color: EndirekColors.encre,
                            fontSize: 13,
                            height: 1.35,
                          ),
                        ),
                        if (deal.status == 'active' &&
                            adj.enAttente &&
                            adj.proposedBy != monId) ...[
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              TextButton(
                                onPressed: () => _agir(context, ref, deal.id,
                                    (r) => r.deciderAjustement(deal.id, adj.id, false)),
                                child: const Text('Refuser'),
                              ),
                              FilledButton.tonal(
                                onPressed: () => _agir(context, ref, deal.id,
                                    (r) => r.deciderAjustement(deal.id, adj.id, true)),
                                child: const Text('Accepter'),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  _BadgeAjustement(status: adj.status),
                ],
              ),
            ),
          ),
      ],
    );
  }

  /// Bottom sheet de proposition d'ajustement (add libre / modify valeur /
  /// remove élément).
  Future<void> _proposer(BuildContext context, WidgetRef ref) async {
    final resultat = await showModalBottomSheet<
        ({String kind, String? itemId, DealItemInput? item, String description})>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) =>
          _FeuilleAjustement(deal: deal, monId: monId),
    );
    if (resultat == null || !context.mounted) {
      return;
    }
    await _agir(
      context,
      ref,
      deal.id,
      (r) => r.proposerAjustement(
        deal.id,
        kind: resultat.kind,
        itemId: resultat.itemId,
        item: resultat.item,
        description: resultat.description,
      ),
    );
  }
}

class _BadgeAjustement extends StatelessWidget {
  const _BadgeAjustement({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (String libelle, Color couleur) = switch (status) {
      'accepted' => ('Accepté', const Color(0xFF16A34A)),
      'rejected' => ('Refusé', const Color(0xFFB3261E)),
      _ => ('En attente', const Color(0xFFB45309)),
    };
    return Text(
      libelle,
      style: TextStyle(color: couleur, fontSize: 11.5, fontWeight: FontWeight.w700),
    );
  }
}

/// Feuille de proposition d'ajustement — trois natures, formulaire minimal.
class _FeuilleAjustement extends StatefulWidget {
  const _FeuilleAjustement({required this.deal, required this.monId});

  final Deal deal;
  final String monId;

  @override
  State<_FeuilleAjustement> createState() => _FeuilleAjustementState();
}

class _FeuilleAjustementState extends State<_FeuilleAjustement> {
  String _kind = 'add';
  String? _itemId;
  final _titre = TextEditingController();
  final _valeur = TextEditingController();
  final _description = TextEditingController();
  String _nature = 'service';

  @override
  void dispose() {
    _titre.dispose();
    _valeur.dispose();
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.deal.items;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20, 0, 20, 16 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Proposer un ajustement',
              style: TextStyle(
                color: EndirekColors.encre,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'add', label: Text('Ajouter')),
                ButtonSegment(value: 'modify', label: Text('Modifier')),
                ButtonSegment(value: 'remove', label: Text('Supprimer')),
              ],
              selected: {_kind},
              onSelectionChanged: (s) => setState(() => _kind = s.first),
            ),
            const SizedBox(height: 12),
            if (_kind != 'add') ...[
              DropdownButtonFormField<String>(
                initialValue: _itemId,
                decoration: const InputDecoration(labelText: 'Élément visé'),
                items: [
                  for (final item in items)
                    DropdownMenuItem(
                      value: item.id,
                      child: Text(item.title, overflow: TextOverflow.ellipsis),
                    ),
                ],
                onChanged: (v) => setState(() => _itemId = v),
              ),
              const SizedBox(height: 10),
            ],
            if (_kind == 'add') ...[
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'service', label: Text('Service')),
                  ButtonSegment(value: 'good', label: Text('Bien')),
                  ButtonSegment(value: 'money', label: Text('Paiement')),
                ],
                selected: {_nature},
                onSelectionChanged: (s) => setState(() => _nature = s.first),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _titre,
                maxLength: 120,
                decoration: const InputDecoration(
                  labelText: 'Titre de l’élément', counterText: '',
                ),
              ),
            ],
            if (_kind != 'remove') ...[
              TextField(
                controller: _valeur,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: _kind == 'add'
                      ? 'Valeur estimée (€)'
                      : 'Nouvelle valeur (€) — laisser vide pour inchangée',
                ),
              ),
            ],
            const SizedBox(height: 10),
            TextField(
              controller: _description,
              maxLength: 500,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Expliquez l’ajustement à votre partenaire',
              ),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _valider,
              child: const Text('Proposer'),
            ),
          ],
        ),
      ),
    );
  }

  void _valider() {
    final description = _description.text.trim();
    if (description.isEmpty) {
      return;
    }
    DealItemInput? item;
    if (_kind == 'add') {
      final titre = _titre.text.trim();
      final valeur = int.tryParse(_valeur.text.trim());
      if (titre.isEmpty || valeur == null || valeur < 0) {
        return;
      }
      item = (
        providerId: widget.monId,
        kind: _nature,
        title: titre,
        description: '',
        value: valeur,
        steps: const <String>[],
      );
    } else {
      if (_itemId == null) {
        return;
      }
      if (_kind == 'modify') {
        final valeur = int.tryParse(_valeur.text.trim());
        if (valeur == null || valeur < 0) {
          return;
        }
        item = (
          providerId: null,
          kind: widget.deal.items
              .firstWhere((i) => i.id == _itemId)
              .kind,
          title: widget.deal.items.firstWhere((i) => i.id == _itemId).title,
          description: '',
          value: valeur,
          steps: const <String>[],
        );
      }
    }
    Navigator.of(context).pop((
      kind: _kind,
      itemId: _itemId,
      item: item,
      description: description,
    ));
  }
}

/// Timeline « Suivi du deal » + ajout de note.
class _SectionSuivi extends ConsumerWidget {
  const _SectionSuivi({required this.deal});

  final Deal deal;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bool peutNoter =
        deal.status == 'active' || deal.status == 'proposed';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(child: _SectionTitre(titre: 'Suivi du deal')),
            if (peutNoter)
              TextButton.icon(
                onPressed: () => _ajouter(context, ref),
                icon: const Icon(Icons.add_comment_outlined, size: 18),
                label: const Text('Ajouter une note'),
              ),
          ],
        ),
        if (deal.notes.isEmpty)
          const Text(
            'Aucune note pour le moment.',
            style: TextStyle(color: EndirekColors.encreSecondaire, fontSize: 13),
          ),
        for (final note in deal.notes)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.notes_outlined,
                    size: 17, color: EndirekColors.encreSecondaire),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${note.author.displayName} · ${_dateHeure(note.createdAt)}',
                        style: const TextStyle(
                          color: EndirekColors.encreSecondaire,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        note.body,
                        style: const TextStyle(
                          color: EndirekColors.encre,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Future<void> _ajouter(BuildContext context, WidgetRef ref) async {
    final controleur = TextEditingController();
    final bool? ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.fromLTRB(
          20, 0, 20, 16 + MediaQuery.of(sheetContext).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: controleur,
              autofocus: true,
              maxLines: 4,
              maxLength: 1000,
              decoration: const InputDecoration(
                labelText: 'Note de suivi (visible par votre partenaire)',
              ),
            ),
            FilledButton(
              onPressed: () => Navigator.of(sheetContext).pop(true),
              child: const Text('Publier la note'),
            ),
          ],
        ),
      ),
    );
    final texte = controleur.text.trim();
    controleur.dispose();
    if (ok == true && texte.isNotEmpty && context.mounted) {
      await _agir(context, ref, deal.id, (r) => r.ajouterNote(deal.id, texte));
    }
  }

  static String _dateHeure(DateTime d) {
    final l = d.toLocal();
    String deux(int n) => n.toString().padLeft(2, '0');
    return '${deux(l.day)}/${deux(l.month)} à ${deux(l.hour)}:${deux(l.minute)}';
  }
}

/// Actions sensibles (deal actif) : annulation amiable + litige (mockup 07).
class _ActionsSensibles extends ConsumerWidget {
  const _ActionsSensibles({required this.deal, required this.monId});

  final Deal deal;
  final String monId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionTitre(titre: 'Actions sensibles'),
        Row(
          children: [
            if (deal.cancellationRequestedBy == null)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _agir(context, ref, deal.id,
                      (r) => r.demanderAnnulation(deal.id)),
                  icon: const Icon(Icons.handshake_outlined, size: 18),
                  label: const Text('Proposer une annulation'),
                ),
              ),
            if (deal.cancellationRequestedBy == null)
              const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _declarerLitige(context, ref),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFB3261E),
                  side: const BorderSide(color: Color(0xFFF3C7C3)),
                ),
                icon: const Icon(Icons.warning_amber_outlined, size: 18),
                label: const Text('Déclarer un litige'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _declarerLitige(BuildContext context, WidgetRef ref) async {
    final controleur = TextEditingController();
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Déclarer un litige ?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Le deal sera gelé. Décrivez précisément le problème '
              '(10 caractères minimum).',
            ),
            const SizedBox(height: 10),
            TextField(
              controller: controleur,
              maxLines: 3,
              maxLength: 1000,
              decoration: const InputDecoration(labelText: 'Motif du litige'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Déclarer'),
          ),
        ],
      ),
    );
    final motif = controleur.text.trim();
    controleur.dispose();
    if (ok == true && context.mounted) {
      await _agir(
          context, ref, deal.id, (r) => r.declarerLitige(deal.id, motif));
    }
  }
}

/// Bloc AVIS d'un deal conclu : formulaire (si pas encore évalué) + avis
/// déposés (3 critères du mockup 05 + note globale).
class _SectionAvis extends ConsumerStatefulWidget {
  const _SectionAvis({required this.deal, required this.monId});

  final Deal deal;
  final String monId;

  @override
  ConsumerState<_SectionAvis> createState() => _SectionAvisState();
}

class _SectionAvisState extends ConsumerState<_SectionAvis> {
  int _honnetete = 5;
  int _conformite = 5;
  int _amabilite = 5;
  final _commentaire = TextEditingController();
  bool _envoi = false;

  @override
  void dispose() {
    _commentaire.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final deal = widget.deal;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionTitre(titre: 'Avis'),
        if (!deal.myReviewSubmitted)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Évaluez ${deal.otherParticipant.displayName}',
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 10),
                  SelecteurEtoiles(
                    libelle: 'Honnêteté et fiabilité',
                    valeur: _honnetete,
                    onChanged: (v) => setState(() => _honnetete = v),
                  ),
                  SelecteurEtoiles(
                    libelle: 'Conformité à la description',
                    valeur: _conformite,
                    onChanged: (v) => setState(() => _conformite = v),
                  ),
                  SelecteurEtoiles(
                    libelle: 'Amabilité et courtoisie',
                    valeur: _amabilite,
                    onChanged: (v) => setState(() => _amabilite = v),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _commentaire,
                    maxLength: 500,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Commentaire (facultatif)',
                    ),
                  ),
                  const SizedBox(height: 4),
                  FilledButton(
                    onPressed: _envoi ? null : _envoyer,
                    child: Text(_envoi ? 'Envoi…' : 'Publier mon avis'),
                  ),
                ],
              ),
            ),
          ),
        for (final avis in deal.reviews)
          Card(
            margin: const EdgeInsets.only(top: 8),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          avis.reviewer.displayName,
                          style: const TextStyle(
                            color: EndirekColors.encre,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      EtoilesLecture(note: avis.overall),
                    ],
                  ),
                  if (avis.comment != null && avis.comment!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      avis.comment!,
                      style: const TextStyle(
                        color: EndirekColors.encre,
                        fontSize: 13,
                        height: 1.35,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _envoyer() async {
    setState(() => _envoi = true);
    try {
      await ref.read(dealsRepositoryProvider).deposerAvis(
            widget.deal.id,
            honesty: _honnetete,
            conformity: _conformite,
            kindness: _amabilite,
            comment: _commentaire.text,
          );
      ref.invalidate(dealProvider(widget.deal.id));
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _envoi = false);
      }
    }
  }
}

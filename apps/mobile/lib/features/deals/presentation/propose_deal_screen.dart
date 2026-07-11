import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../dealplace/application/listing_detail_provider.dart';
import '../data/deals_repository.dart';

/// Élément en cours de saisie dans le formulaire.
class _ElementSaisi {
  _ElementSaisi({
    required this.kind,
    required this.title,
    required this.value,
    required this.description,
    required this.steps,
  });

  String kind;
  String title;
  int value;
  String description;
  List<String> steps;
}

/// ÉCRAN DE PROPOSITION DE DEAL (/dealplace/:id/proposer — CP2.4) : compose
/// les deux côtés de l'échange (« Je fournis » / « Il fournit ») élément par
/// élément (nature, titre, valeur estimée, sous-éléments facultatifs), puis
/// envoie la proposition. La contrepartie = propriétaire de l'annonce, ou
/// `?recipient=` quand le propriétaire propose depuis une conversation.
class ProposeDealScreen extends ConsumerStatefulWidget {
  const ProposeDealScreen({
    super.key,
    required this.listingId,
    this.recipientId,
  });

  final String listingId;

  /// Contrepartie explicite (cas du PROPRIÉTAIRE proposant depuis un fil).
  final String? recipientId;

  @override
  ConsumerState<ProposeDealScreen> createState() => _ProposeDealScreenState();
}

class _ProposeDealScreenState extends ConsumerState<ProposeDealScreen> {
  final List<_ElementSaisi> _mesElements = [];
  final List<_ElementSaisi> _sesElements = [];
  bool _envoi = false;

  @override
  Widget build(BuildContext context) {
    final annonce = ref.watch(listingDetailProvider(widget.listingId));
    return Scaffold(
      appBar: AppBar(title: const Text('Proposer un deal')),
      body: SafeArea(
        child: switch (annonce) {
          AsyncData(:final value) => _formulaire(value.title),
          AsyncError() => const Center(
              child: Text(
                'Annonce introuvable.',
                style: TextStyle(color: EndirekColors.encreSecondaire),
              ),
            ),
          _ => const Center(child: CircularProgressIndicator()),
        },
      ),
    );
  }

  Widget _formulaire(String titreAnnonce) {
    final bool valide = _mesElements.isNotEmpty || _sesElements.isNotEmpty;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      const Icon(Icons.storefront_outlined,
                          size: 18, color: EndirekColors.encreSecondaire),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          titreAnnonce,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: EndirekColors.encre,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              _section('Je fournis', _mesElements),
              const SizedBox(height: 14),
              _section('Mon deal-partner fournit', _sesElements),
              const SizedBox(height: 8),
              const Text(
                'Chaque élément porte une valeur estimée indicative — le '
                'paiement éventuel se règle entre vous, hors de l’application.',
                style: TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        Material(
          color: Colors.white,
          elevation: 8,
          shadowColor: Colors.black.withValues(alpha: 0.08),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: FilledButton.icon(
                onPressed: valide && !_envoi ? _envoyer : null,
                icon: const Icon(Icons.handshake_outlined),
                label: Text(_envoi ? 'Envoi…' : 'Envoyer la proposition'),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _section(String titre, List<_ElementSaisi> elements) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                titre,
                style: const TextStyle(
                  color: EndirekColors.encre,
                  fontSize: 15.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            TextButton.icon(
              onPressed: () => _ajouterElement(elements),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Ajouter'),
            ),
          ],
        ),
        if (elements.isEmpty)
          const Text(
            'Aucun élément — ajoutez ce qui sera échangé.',
            style: TextStyle(color: EndirekColors.encreSecondaire, fontSize: 13),
          ),
        for (final element in elements)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              dense: true,
              leading: Icon(
                switch (element.kind) {
                  'good' => Icons.inventory_2_outlined,
                  'money' => Icons.payments_outlined,
                  _ => Icons.handyman_outlined,
                },
                color: EndirekColors.bleu,
              ),
              title: Text(element.title),
              subtitle: Text(
                '${element.value} € · ${element.steps.isEmpty ? '1 sous-élément auto' : '${element.steps.length} sous-éléments'}',
              ),
              trailing: IconButton(
                icon: const Icon(Icons.delete_outline, size: 20),
                onPressed: () => setState(() => elements.remove(element)),
              ),
            ),
          ),
      ],
    );
  }

  /// Feuille d'ajout d'un élément (nature, titre, valeur, description,
  /// sous-éléments « un par ligne »).
  Future<void> _ajouterElement(List<_ElementSaisi> cible) async {
    String nature = 'service';
    final titre = TextEditingController();
    final valeur = TextEditingController();
    final description = TextEditingController();
    final steps = TextEditingController();

    final bool? ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            20, 0, 20, 16 + MediaQuery.of(sheetContext).viewInsets.bottom,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'service', label: Text('Service')),
                    ButtonSegment(value: 'good', label: Text('Bien')),
                    ButtonSegment(value: 'money', label: Text('Paiement')),
                  ],
                  selected: {nature},
                  onSelectionChanged: (s) =>
                      setSheetState(() => nature = s.first),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: titre,
                  maxLength: 120,
                  decoration: const InputDecoration(
                    labelText: 'Titre', counterText: '',
                  ),
                ),
                TextField(
                  controller: valeur,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Valeur estimée (€)'),
                ),
                TextField(
                  controller: description,
                  maxLength: 1000,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Description (facultative)', counterText: '',
                  ),
                ),
                TextField(
                  controller: steps,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText:
                        'Sous-éléments validables (un par ligne, facultatif)',
                    hintText: 'Maquette livrée\nMise en ligne',
                  ),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: () => Navigator.of(sheetContext).pop(true),
                  child: const Text('Ajouter l’élément'),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    final String t = titre.text.trim();
    final int? v = int.tryParse(valeur.text.trim());
    final String d = description.text.trim();
    final List<String> s = steps.text
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .take(8)
        .toList();
    titre.dispose();
    valeur.dispose();
    description.dispose();
    steps.dispose();
    if (ok == true && t.isNotEmpty && v != null && v >= 0) {
      setState(() {
        cible.add(_ElementSaisi(
          kind: nature,
          title: t,
          value: v,
          description: d,
          steps: s,
        ));
      });
    }
  }

  Future<void> _envoyer() async {
    final annonce = ref.read(listingDetailProvider(widget.listingId)).value;
    if (annonce == null) {
      return;
    }
    // Contrepartie : propriétaire de l'annonce, ou recipient explicite (cas
    // du propriétaire qui propose depuis un fil).
    final String recipientId = widget.recipientId ?? annonce.ownerId;
    setState(() => _envoi = true);
    try {
      final deal = await ref.read(dealsRepositoryProvider).proposerDeal(
            listingId: widget.listingId,
            recipientId: widget.recipientId,
            items: [
              for (final e in _mesElements)
                (
                  providerId: null, // défaut serveur : le proposeur.
                  kind: e.kind,
                  title: e.title,
                  description: e.description,
                  value: e.value,
                  steps: e.steps,
                ),
              for (final e in _sesElements)
                (
                  providerId: recipientId,
                  kind: e.kind,
                  title: e.title,
                  description: e.description,
                  value: e.value,
                  steps: e.steps,
                ),
            ],
          );
      if (mounted) {
        // Remplace l'écran de composition par la page du deal créé.
        context.pushReplacement('/deals/${deal.id}');
      }
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

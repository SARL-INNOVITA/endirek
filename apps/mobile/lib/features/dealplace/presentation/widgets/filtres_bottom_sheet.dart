import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/models/commune.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../../feed/application/referentiels_providers.dart';
import '../../application/taxonomy_provider.dart';
import '../../domain/dealplace_taxonomy.dart';
import '../../domain/listing_filters.dart';

/// Ouvre le bottom sheet de filtres de l'annuaire Dealplace et renvoie les
/// filtres CHOISIS (null si l'utilisateur ferme sans valider). La recherche
/// texte reste pilotée par la barre de recherche — elle est préservée telle
/// quelle.
Future<ListingFilters?> montrerFiltresAnnonces(
  BuildContext context,
  ListingFilters filtresCourants,
) {
  return showModalBottomSheet<ListingFilters>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _FiltresBottomSheet(filtresCourants: filtresCourants),
  );
}

class _FiltresBottomSheet extends ConsumerStatefulWidget {
  const _FiltresBottomSheet({required this.filtresCourants});

  final ListingFilters filtresCourants;

  @override
  ConsumerState<_FiltresBottomSheet> createState() =>
      _FiltresBottomSheetState();
}

class _FiltresBottomSheetState extends ConsumerState<_FiltresBottomSheet> {
  late String? _family;
  late String? _categorySlug;
  late String? _subcategorySlug;
  late String? _city;
  late final Set<String> _tags;
  final TextEditingController _valeurMinController = TextEditingController();
  final TextEditingController _valeurMaxController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final ListingFilters f = widget.filtresCourants;
    _family = f.family;
    _categorySlug = f.category;
    _subcategorySlug = f.subcategory;
    _city = f.city;
    _tags = {...f.tags};
    if (f.valueMin != null) _valeurMinController.text = '${f.valueMin}';
    if (f.valueMax != null) _valeurMaxController.text = '${f.valueMax}';
  }

  @override
  void dispose() {
    _valeurMinController.dispose();
    _valeurMaxController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<DealplaceTaxonomy> taxonomie =
        ref.watch(taxonomyProvider);
    final double hauteur = MediaQuery.of(context).size.height * 0.85;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SizedBox(
        height: hauteur,
        child: Column(
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: EndirekColors.bordure,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 12, 20, 4),
              child: Row(
                children: [
                  Text(
                    'Filtres',
                    style: TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: switch (taxonomie) {
                AsyncData(:final value) => _corps(value),
                AsyncError() => _erreurTaxonomie(),
                _ => const Center(child: CircularProgressIndicator()),
              },
            ),
            _barreActions(),
          ],
        ),
      ),
    );
  }

  Widget _erreurTaxonomie() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Taxonomie indisponible.',
            style: TextStyle(color: EndirekColors.encreSecondaire),
          ),
          TextButton(
            onPressed: () => ref.invalidate(taxonomyProvider),
            child: const Text('Réessayer'),
          ),
        ],
      ),
    );
  }

  Widget _corps(DealplaceTaxonomy taxonomie) {
    // Catégories filtrées par la famille sélectionnée (toutes si aucune).
    final List<ListingCategory> categories = _family == null
        ? taxonomie.categories
        : taxonomie.categoriesDeFamille(_family!);
    final ListingCategory? categorieChoisie = _categorySlug == null
        ? null
        : categories.where((c) => c.slug == _categorySlug).firstOrNull;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      children: [
        _titreSection('Type'),
        Wrap(
          spacing: 8,
          children: [
            _puceChoix(
              libelle: 'Tous',
              actif: _family == null,
              surTap: () => setState(() {
                _family = null;
                _categorySlug = null;
                _subcategorySlug = null;
              }),
            ),
            _puceChoix(
              libelle: 'Biens',
              actif: _family == 'good',
              surTap: () => setState(() => _choisirFamille('good')),
            ),
            _puceChoix(
              libelle: 'Services',
              actif: _family == 'service',
              surTap: () => setState(() => _choisirFamille('service')),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _titreSection('Catégorie'),
        DropdownButtonFormField<String?>(
          initialValue: _categorySlug,
          isExpanded: true,
          hint: const Text('Toutes les catégories'),
          items: [
            const DropdownMenuItem<String?>(
              value: null,
              child: Text('Toutes les catégories'),
            ),
            for (final ListingCategory c in categories)
              DropdownMenuItem<String?>(value: c.slug, child: Text(c.labelFr)),
          ],
          onChanged: (valeur) => setState(() {
            _categorySlug = valeur;
            _subcategorySlug = null;
          }),
        ),
        if (categorieChoisie != null &&
            categorieChoisie.subcategories.isNotEmpty) ...[
          const SizedBox(height: 12),
          _titreSection('Sous-catégorie'),
          DropdownButtonFormField<String?>(
            initialValue: _subcategorySlug,
            isExpanded: true,
            hint: const Text('Toutes les sous-catégories'),
            items: [
              const DropdownMenuItem<String?>(
                value: null,
                child: Text('Toutes les sous-catégories'),
              ),
              for (final s in categorieChoisie.subcategories)
                DropdownMenuItem<String?>(
                  value: s.slug,
                  child: Text(s.labelFr),
                ),
            ],
            onChanged: (valeur) => setState(() => _subcategorySlug = valeur),
          ),
        ],
        const SizedBox(height: 16),
        _titreSection('Commune'),
        _SelecteurCommune(
          valeur: _city,
          surCommune: (valeur) => setState(() => _city = valeur),
        ),
        const SizedBox(height: 16),
        _titreSection('Valeur (€)'),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _valeurMinController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(hintText: 'Min'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _valeurMaxController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(hintText: 'Max'),
              ),
            ),
          ],
        ),
        if (taxonomie.tags.isNotEmpty) ...[
          const SizedBox(height: 16),
          _titreSection('Tags'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final t in taxonomie.tags)
                _puceChoix(
                  libelle: t.labelFr,
                  actif: _tags.contains(t.slug),
                  surTap: () => setState(() {
                    if (!_tags.add(t.slug)) {
                      _tags.remove(t.slug);
                    }
                  }),
                ),
            ],
          ),
        ],
      ],
    );
  }

  void _choisirFamille(String famille) {
    _family = famille;
    // La catégorie choisie doit rester cohérente avec la famille.
    _categorySlug = null;
    _subcategorySlug = null;
  }

  Widget _titreSection(String titre) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        titre,
        style: const TextStyle(
          color: EndirekColors.encre,
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _puceChoix({
    required String libelle,
    required bool actif,
    required VoidCallback surTap,
  }) {
    return ChoiceChip(
      label: Text(libelle),
      selected: actif,
      onSelected: (_) => surTap(),
      showCheckmark: false,
      selectedColor: const Color(0xFFE0EDFA),
      backgroundColor: EndirekColors.surface,
      side: BorderSide(
        color: actif ? EndirekColors.bleu : EndirekColors.bordure,
      ),
      labelStyle: TextStyle(
        color: actif ? EndirekColors.bleu : EndirekColors.encre,
        fontWeight: actif ? FontWeight.w700 : FontWeight.w500,
        fontSize: 13,
      ),
    );
  }

  Widget _barreActions() {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _reinitialiser,
                child: const Text('Réinitialiser'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: _appliquer,
                child: const Text('Appliquer'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _reinitialiser() {
    // Conserve la recherche texte, efface tout le reste.
    Navigator.of(context).pop(
      ListingFilters(search: widget.filtresCourants.search),
    );
  }

  void _appliquer() {
    final int? min = int.tryParse(_valeurMinController.text.trim());
    final int? max = int.tryParse(_valeurMaxController.text.trim());
    Navigator.of(context).pop(
      ListingFilters(
        search: widget.filtresCourants.search,
        family: _family,
        category: _categorySlug,
        subcategory: _subcategorySlug,
        city: _city,
        valueMin: min,
        valueMax: max,
        tags: _tags.toList(),
      ),
    );
  }
}

/// Sélecteur de commune du filtre (référentiel GET /map/communes, réutilisé
/// du composer). « Toutes les communes » = aucun filtre.
class _SelecteurCommune extends ConsumerWidget {
  const _SelecteurCommune({required this.valeur, required this.surCommune});

  final String? valeur;
  final ValueChanged<String?> surCommune;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Commune>> communes = ref.watch(communesProvider);
    return switch (communes) {
      AsyncData(:final value) => DropdownButtonFormField<String?>(
          initialValue: valeur,
          isExpanded: true,
          hint: const Text('Toutes les communes'),
          items: [
            const DropdownMenuItem<String?>(
              value: null,
              child: Text('Toutes les communes'),
            ),
            for (final Commune c in value)
              DropdownMenuItem<String?>(value: c.name, child: Text(c.name)),
          ],
          onChanged: surCommune,
        ),
      AsyncError() => Row(
          children: [
            const Expanded(
              child: Text(
                'Communes indisponibles.',
                style: TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 13,
                ),
              ),
            ),
            TextButton(
              onPressed: () => ref.invalidate(communesProvider),
              child: const Text('Réessayer'),
            ),
          ],
        ),
      _ => const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: LinearProgressIndicator(minHeight: 2),
        ),
    };
  }
}

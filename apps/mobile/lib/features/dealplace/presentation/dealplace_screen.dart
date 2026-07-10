import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/endirek_theme.dart';
import '../application/listings_list_controller.dart';
import '../domain/listing_filters.dart';
import 'widgets/carte_annonce.dart';
import 'widgets/filtres_bottom_sheet.dart';

/// Onglet Dealplace : annuaire des annonces (biens & services) en grille de
/// cartes, barre de recherche + bouton de filtres (bottom sheet), états
/// loading/vide/erreur, tirer-pour-rafraîchir, pagination à l'infini, et
/// bouton flottant « Déposer une annonce » (→ /dealplace/create).
class DealplaceScreen extends ConsumerStatefulWidget {
  const DealplaceScreen({super.key});

  @override
  ConsumerState<DealplaceScreen> createState() => _DealplaceScreenState();
}

class _DealplaceScreenState extends ConsumerState<DealplaceScreen> {
  final ScrollController _defilement = ScrollController();
  final TextEditingController _rechercheController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _defilement.addListener(_surDefilement);
    Future.microtask(() => ref.read(listingsListProvider.notifier).charger());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _defilement.dispose();
    _rechercheController.dispose();
    super.dispose();
  }

  void _surDefilement() {
    if (_defilement.position.pixels >=
        _defilement.position.maxScrollExtent - 400) {
      ref.read(listingsListProvider.notifier).chargerSuite();
    }
  }

  /// Recherche « anti-rebond » : on attend 400 ms après la dernière frappe.
  void _surRecherche(String texte) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      ref.read(listingsListProvider.notifier).rechercher(texte);
    });
  }

  Future<void> _ouvrirFiltres() async {
    final ListingsListState etat = ref.read(listingsListProvider);
    final ListingFilters? choix =
        await montrerFiltresAnnonces(context, etat.filtres);
    if (choix != null) {
      await ref.read(listingsListProvider.notifier).appliquerFiltres(choix);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ListingsListState etat = ref.watch(listingsListProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/dealplace/create'),
        backgroundColor: EndirekColors.bleu,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Déposer'),
      ),
      body: Column(
        children: [
          _BarreRecherche(
            controller: _rechercheController,
            surRecherche: _surRecherche,
            surVider: () {
              _rechercheController.clear();
              _debounce?.cancel();
              ref.read(listingsListProvider.notifier).rechercher(null);
            },
            surFiltres: _ouvrirFiltres,
            nombreFiltres: etat.filtres.nombreFiltresActifs,
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () =>
                  ref.read(listingsListProvider.notifier).rafraichir(),
              child: _Contenu(etat: etat, defilement: _defilement),
            ),
          ),
        ],
      ),
    );
  }
}

/// Corps de l'annuaire selon l'état : chargement initial, erreur, liste vide,
/// ou grille paginée de cartes.
class _Contenu extends ConsumerWidget {
  const _Contenu({required this.etat, required this.defilement});

  final ListingsListState etat;
  final ScrollController defilement;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Chargement initial (aucun résultat encore affiché).
    if (etat.chargement && etat.items.isEmpty) {
      return ListView(
        controller: defilement,
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          Padding(
            padding: EdgeInsets.symmetric(vertical: 80),
            child: Center(child: CircularProgressIndicator()),
          ),
        ],
      );
    }
    // Erreur sans résultat.
    if (etat.erreur != null && etat.items.isEmpty) {
      return _EtatMessage(
        defilement: defilement,
        icone: Icons.wifi_off_outlined,
        message: etat.erreur!,
        actionLibelle: 'Réessayer',
        surAction: () => ref.read(listingsListProvider.notifier).rafraichir(),
      );
    }
    // Vide (initialisé sans résultat).
    if (etat.initialise && etat.items.isEmpty) {
      final bool avecFiltres =
          etat.filtres.aFiltresActifs || etat.filtres.search != null;
      return _EtatMessage(
        defilement: defilement,
        icone: Icons.storefront_outlined,
        message: avecFiltres
            ? 'Aucune annonce ne correspond à votre recherche.'
            : 'Aucune annonce pour le moment.\nSoyez le premier à en déposer une !',
        actionLibelle: avecFiltres ? 'Réinitialiser les filtres' : null,
        surAction: avecFiltres
            ? () => ref.read(listingsListProvider.notifier).reinitialiser()
            : null,
      );
    }

    // Grille de cartes + pied (indicateur de page suivante).
    return GridView.builder(
      controller: defilement,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 240,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.62,
      ),
      itemCount: etat.items.length,
      itemBuilder: (context, index) =>
          CarteAnnonce(annonce: etat.items[index]),
    );
  }
}

/// Barre de recherche + bouton de filtres (avec badge du nombre de filtres).
class _BarreRecherche extends StatelessWidget {
  const _BarreRecherche({
    required this.controller,
    required this.surRecherche,
    required this.surVider,
    required this.surFiltres,
    required this.nombreFiltres,
  });

  final TextEditingController controller;
  final ValueChanged<String> surRecherche;
  final VoidCallback surVider;
  final VoidCallback surFiltres;
  final int nombreFiltres;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: Row(
        children: [
          Expanded(
            child: ValueListenableBuilder<TextEditingValue>(
              valueListenable: controller,
              builder: (context, value, _) {
                return TextField(
                  controller: controller,
                  textInputAction: TextInputAction.search,
                  onChanged: surRecherche,
                  decoration: InputDecoration(
                    hintText: 'Rechercher une annonce…',
                    prefixIcon: const Icon(
                      Icons.search,
                      color: EndirekColors.encreSecondaire,
                    ),
                    suffixIcon: value.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Effacer',
                            icon: const Icon(Icons.close),
                            onPressed: surVider,
                          ),
                    contentPadding:
                        const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                  ),
                );
              },
            ),
          ),
          const SizedBox(width: 8),
          _BoutonFiltres(nombre: nombreFiltres, surTap: surFiltres),
        ],
      ),
    );
  }
}

class _BoutonFiltres extends StatelessWidget {
  const _BoutonFiltres({required this.nombre, required this.surTap});

  final int nombre;
  final VoidCallback surTap;

  @override
  Widget build(BuildContext context) {
    final bool actif = nombre > 0;
    return Material(
      color: actif ? const Color(0xFFE0EDFA) : EndirekColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: surTap,
        child: Container(
          height: 52,
          width: 52,
          alignment: Alignment.center,
          child: Badge(
            isLabelVisible: actif,
            label: Text('$nombre'),
            backgroundColor: EndirekColors.bleu,
            child: Icon(
              Icons.tune,
              color: actif ? EndirekColors.bleu : EndirekColors.encre,
            ),
          ),
        ),
      ),
    );
  }
}

/// État plein écran (vide / erreur) scrollable pour permettre le pull-to-
/// refresh, avec icône, message et action facultative.
class _EtatMessage extends StatelessWidget {
  const _EtatMessage({
    required this.defilement,
    required this.icone,
    required this.message,
    this.actionLibelle,
    this.surAction,
  });

  final ScrollController defilement;
  final IconData icone;
  final String message;
  final String? actionLibelle;
  final VoidCallback? surAction;

  @override
  Widget build(BuildContext context) {
    return ListView(
      controller: defilement,
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(32, 100, 32, 16),
          child: Column(
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
              if (actionLibelle != null && surAction != null) ...[
                const SizedBox(height: 16),
                TextButton.icon(
                  onPressed: surAction,
                  icon: const Icon(Icons.refresh),
                  label: Text(actionLibelle!),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

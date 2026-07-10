import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../data/dealplace_repository.dart';
import '../domain/listing_card.dart';
import '../domain/listing_filters.dart';

/// Marqueur « champ absent » pour [ListingsListState.copyWith] (erreur
/// nullable : distinguer « inchangée » de « effacée »).
const Object _champAbsent = Object();

/// État de l'annuaire Dealplace : cartes chargées, total serveur, filtres
/// courants (dont recherche), drapeaux de chargement et erreur affichable.
class ListingsListState {
  const ListingsListState({
    this.items = const [],
    this.total = 0,
    this.filtres = const ListingFilters(),
    this.initialise = false,
    this.chargement = false,
    this.chargementSuite = false,
    this.erreur,
  });

  final List<ListingCard> items;
  final int total;
  final ListingFilters filtres;
  final bool initialise;
  final bool chargement;
  final bool chargementSuite;
  final String? erreur;

  bool get peutChargerSuite =>
      initialise && !chargement && !chargementSuite && items.length < total;

  ListingsListState copyWith({
    List<ListingCard>? items,
    int? total,
    ListingFilters? filtres,
    bool? initialise,
    bool? chargement,
    bool? chargementSuite,
    Object? erreur = _champAbsent,
  }) {
    return ListingsListState(
      items: items ?? this.items,
      total: total ?? this.total,
      filtres: filtres ?? this.filtres,
      initialise: initialise ?? this.initialise,
      chargement: chargement ?? this.chargement,
      chargementSuite: chargementSuite ?? this.chargementSuite,
      erreur: identical(erreur, _champAbsent) ? this.erreur : erreur as String?,
    );
  }
}

/// Annuaire public paginé (GET /dealplace/listings) : pagination offset/limit,
/// pull-to-refresh, application de filtres et recherche (chaque changement
/// recharge depuis zéro). Vit pour la session (l'onglet reste monté).
class ListingsListController extends Notifier<ListingsListState> {
  static const int taillePage = 20;

  @override
  ListingsListState build() => const ListingsListState();

  DealplaceRepository get _repository =>
      ref.read(dealplaceRepositoryProvider);

  /// Premier chargement — sans effet si déjà initialisé ou en cours.
  Future<void> charger() async {
    if (state.initialise || state.chargement) {
      return;
    }
    await _rechargerDepuisZero();
  }

  /// Recharge complète (pull-to-refresh, retour de création).
  Future<void> rafraichir() async {
    if (state.chargement) {
      return;
    }
    await _rechargerDepuisZero();
  }

  /// Remplace TOUS les filtres (bottom sheet « Filtres ») et recharge.
  Future<void> appliquerFiltres(ListingFilters filtres) async {
    state = state.copyWith(filtres: filtres);
    await _rechargerDepuisZero();
  }

  /// Met à jour la seule recherche texte (barre de recherche) et recharge.
  Future<void> rechercher(String? texte) async {
    final String? valeur =
        (texte == null || texte.trim().isEmpty) ? null : texte.trim();
    if (valeur == state.filtres.search) {
      return;
    }
    state = state.copyWith(filtres: state.filtres.copyWith(search: valeur));
    await _rechargerDepuisZero();
  }

  /// Réinitialise tous les filtres et la recherche.
  Future<void> reinitialiser() async {
    state = state.copyWith(filtres: const ListingFilters());
    await _rechargerDepuisZero();
  }

  /// Page suivante (infinite scroll) — silencieux en cas d'erreur réseau.
  Future<void> chargerSuite() async {
    if (!state.peutChargerSuite) {
      return;
    }
    state = state.copyWith(chargementSuite: true);
    try {
      final ListingsPage page = await _repository.listerAnnonces(
        filtres: state.filtres,
        limit: taillePage,
        offset: state.items.length,
      );
      final Set<String> connus = {for (final c in state.items) c.id};
      state = state.copyWith(
        items: [
          ...state.items,
          ...page.items.where((c) => !connus.contains(c.id)),
        ],
        total: page.total,
        chargementSuite: false,
      );
    } on ApiException {
      state = state.copyWith(chargementSuite: false);
    }
  }

  Future<void> _rechargerDepuisZero() async {
    state = state.copyWith(chargement: true, erreur: null);
    try {
      final ListingsPage page = await _repository.listerAnnonces(
        filtres: state.filtres,
        limit: taillePage,
        offset: 0,
      );
      state = state.copyWith(
        items: page.items,
        total: page.total,
        initialise: true,
        chargement: false,
        erreur: null,
      );
    } on ApiException catch (erreur) {
      state = state.copyWith(chargement: false, erreur: erreur.message);
    }
  }
}

final listingsListProvider =
    NotifierProvider<ListingsListController, ListingsListState>(
        ListingsListController.new);

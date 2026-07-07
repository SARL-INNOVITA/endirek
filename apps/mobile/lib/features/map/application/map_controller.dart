import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/map_overview.dart';
import '../data/map_repository.dart';
import '../domain/map_marker.dart';

/// Bascules de filtrage de la carte (mode « Météo & trafic »). Chaque bascule
/// pilote à la fois l'affichage local des marqueurs ET les filtres envoyés à
/// l'API (types= pour les posts, categories= pour les caméras).
class MapFiltres {
  const MapFiltres({
    this.meteo = true,
    this.trafic = true,
    this.danger = true,
    this.cameras = true,
  });

  final bool meteo;
  final bool trafic;
  final bool danger;
  final bool cameras;

  MapFiltres copyWith({bool? meteo, bool? trafic, bool? danger, bool? cameras}) {
    return MapFiltres(
      meteo: meteo ?? this.meteo,
      trafic: trafic ?? this.trafic,
      danger: danger ?? this.danger,
      cameras: cameras ?? this.cameras,
    );
  }

  /// Slugs de types de post demandés à l'API (weather/traffic/danger).
  List<String> get typesPosts => [
        if (meteo) 'weather',
        if (trafic) 'traffic',
        if (danger) 'danger',
      ];

  /// Catégories de caméra demandées à l'API. Les caméras suivent les bascules
  /// météo/trafic : une caméra météo n'apparaît que si le mode Météo est actif
  /// ET les caméras affichées.
  List<String> get categoriesCameras => [
        if (meteo) 'weather',
        if (trafic) 'traffic',
      ];

  bool get toutDesactive =>
      !meteo && !trafic && !danger && !cameras;
}

/// État de la carte : marqueurs bruts (posts + caméras) + drapeaux d'UI.
class MapState {
  const MapState({
    this.marqueurs = const [],
    this.filtres = const MapFiltres(),
    this.chargement = false,
    this.initialise = false,
    this.erreur,
  });

  /// Marqueurs déjà filtrés selon [filtres] (prêts au clustering/affichage).
  final List<MapMarker> marqueurs;
  final MapFiltres filtres;
  final bool chargement;

  /// Vrai après le premier chargement abouti (distingue « en cours » de
  /// « chargé mais vide »).
  final bool initialise;

  final String? erreur;

  MapState copyWith({
    List<MapMarker>? marqueurs,
    MapFiltres? filtres,
    bool? chargement,
    bool? initialise,
    Object? erreur = _absent,
  }) {
    return MapState(
      marqueurs: marqueurs ?? this.marqueurs,
      filtres: filtres ?? this.filtres,
      chargement: chargement ?? this.chargement,
      initialise: initialise ?? this.initialise,
      erreur: identical(erreur, _absent) ? this.erreur : erreur as String?,
    );
  }

  static const Object _absent = Object();
}

/// Contrôleur de la carte : charge GET /map/overview, applique les filtres et
/// expose des marqueurs prêts à regrouper. Rechargé sur changement de filtres
/// et sur l'événement temps réel 'map.updated'.
final mapControllerProvider =
    NotifierProvider<CarteController, MapState>(CarteController.new);

class CarteController extends Notifier<MapState> {
  @override
  MapState build() => const MapState();

  MapRepository get _repo => ref.read(mapRepositoryProvider);

  /// Premier chargement (idempotent : ne recharge pas si déjà initialisé et
  /// sans erreur — l'onglet Carte reste monté dans l'IndexedStack).
  Future<void> chargerSiBesoin() async {
    if (state.initialise && state.erreur == null) {
      return;
    }
    await charger();
  }

  /// (Re)charge la vue d'ensemble depuis l'API avec les filtres courants.
  Future<void> charger() async {
    state = state.copyWith(chargement: true, erreur: null);
    final MapFiltres filtres = state.filtres;
    try {
      // Cas « tout décoché » : rien à demander, carte vide sans appel réseau.
      if (filtres.toutDesactive) {
        state = state.copyWith(
          marqueurs: const [],
          chargement: false,
          initialise: true,
          erreur: null,
        );
        return;
      }
      final MapOverview overview = await _repo.chargerOverview(
        types: filtres.typesPosts,
        categories: filtres.categoriesCameras,
      );
      state = state.copyWith(
        marqueurs: _construireMarqueurs(overview, filtres),
        chargement: false,
        initialise: true,
        erreur: null,
      );
    } on ApiException catch (e) {
      state = state.copyWith(chargement: false, erreur: e.message);
    }
  }

  /// Applique de nouveaux filtres puis recharge (les filtres pilotent l'appel
  /// API autant que l'affichage — on repart de la source de vérité).
  Future<void> appliquerFiltres(MapFiltres filtres) async {
    state = state.copyWith(filtres: filtres);
    await charger();
  }

  /// Rafraîchit sur demande (tirer-pour-rafraîchir, event realtime, bouton
  /// réessayer).
  Future<void> rafraichir() => charger();

  /// Construit les marqueurs affichables : caméras (si activées) + posts dont
  /// le type est activé et la position non nulle. Défense en profondeur —
  /// l'API filtre déjà, mais on ne fait jamais confiance à un post sans
  /// location.
  List<MapMarker> _construireMarqueurs(
    MapOverview overview,
    MapFiltres filtres,
  ) {
    final List<MapMarker> marqueurs = [];

    for (final post in overview.posts) {
      if (!_typeActif(post.typeSlug, filtres)) {
        continue;
      }
      final location = post.location;
      if (location == null) {
        continue;
      }
      marqueurs.add(
        MapMarker.depuisPost(post, LatLng(location.lat, location.lng)),
      );
    }

    if (filtres.cameras) {
      for (final camera in overview.cameras) {
        // La caméra suit sa catégorie : n'affiche que si le mode correspondant
        // est actif (une caméra trafic n'apparaît pas en mode météo seul).
        if (!_categorieActive(camera.category, filtres)) {
          continue;
        }
        marqueurs.add(MapMarker.depuisCamera(camera));
      }
    }

    return marqueurs;
  }

  bool _typeActif(String typeSlug, MapFiltres filtres) {
    return switch (typeSlug) {
      'weather' => filtres.meteo,
      'traffic' => filtres.trafic,
      'danger' => filtres.danger,
      _ => false,
    };
  }

  bool _categorieActive(String categorie, MapFiltres filtres) {
    return switch (categorie) {
      'weather' => filtres.meteo,
      'traffic' => filtres.trafic,
      _ => false,
    };
  }
}

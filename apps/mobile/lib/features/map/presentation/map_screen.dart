import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/endirek_theme.dart';
import '../application/map_controller.dart';
import '../domain/map_constants.dart';
import '../domain/map_marker.dart';
import '../domain/marker_clusterer.dart';
import 'widgets/filtres_carte_sheet.dart';
import 'widgets/marqueur_carte.dart';
import 'widgets/preview_marqueur.dart';

/// Écran Carte (onglet Carte du shell) :
/// - flutter_map + tuiles OSM, centré La Réunion, contraint à l'emprise île ;
/// - marqueurs posts (météo/trafic/danger + menu/offre/événement des pages
///   depuis le Lot 3) + caméras actives, REGROUPÉS par un clusterer maison
///   dépendant du zoom (features/map/domain/) ;
/// - preview card flottante au tap d'un marqueur → /post/:id ou /camera/:id ;
/// - FAB recentrer + FAB filtres (bottom sheet) + FAB recherche (placeholder) ;
/// - chips de mode = bascules rapides par famille (Météo & trafic / Offres &
///   restos / Événements) ;
/// - états chargement / vide / erreur.
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  final MapController _mapController = MapController();
  final MarkerClusterer _clusterer = const MarkerClusterer();

  /// Zoom courant (mis à jour par onPositionChanged) — pilote le clustering.
  double _zoom = MapConstants.zoomInitial;

  /// Marqueur actuellement sélectionné (preview card affichée), ou null.
  MapMarker? _selection;

  @override
  void initState() {
    super.initState();
    // Premier chargement des données (no-op si déjà chargé — onglet monté dans
    // l'IndexedStack du shell).
    Future.microtask(
      () => ref.read(mapControllerProvider.notifier).chargerSiBesoin(),
    );
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final MapState etat = ref.watch(mapControllerProvider);
    // Le marqueur sélectionné a disparu (filtre appliqué via les chips ou
    // le bottom sheet, rafraîchissement temps réel...) : la preview card
    // ne doit pas survivre à son marqueur.
    if (_selection != null &&
        etat.initialise &&
        !etat.marqueurs.any((m) => m.cle == _selection!.cle)) {
      _selection = null;
    }
    final List<ClusterCarte> clusters =
        _clusterer.regrouper(etat.marqueurs, _zoom);

    return Stack(
      children: [
        _carte(clusters),
        // Attribution OSM obligatoire (bas de carte).
        const Positioned(
          left: 8,
          bottom: 8,
          child: _AttributionOsm(),
        ),
        // Chips de mode en haut.
        const Positioned(
          top: 12,
          left: 12,
          right: 12,
          child: _ChipsMode(),
        ),
        // FAB recherche + filtres + recentrer (colonne haut-droite).
        Positioned(
          top: 64,
          right: 12,
          child: _BoutonsCarte(
            onRecentrer: _recentrer,
            onFiltres: _ouvrirFiltres,
            onRecherche: _recherche,
          ),
        ),
        // Preview card au tap d'un marqueur.
        if (_selection != null)
          Positioned(
            left: 12,
            right: 12,
            bottom: 24,
            child: PreviewMarqueur(
              marqueur: _selection!,
              onOuvrir: _ouvrirDetail,
              onFermer: _deselectionner,
            ),
          ),
        // Voile de chargement (premier chargement).
        if (etat.chargement && !etat.initialise)
          const Positioned.fill(child: _VoileChargement()),
        // État vide (chargé, aucun marqueur).
        if (etat.initialise && !etat.chargement && etat.marqueurs.isEmpty &&
            etat.erreur == null)
          const Positioned(
            left: 24,
            right: 24,
            bottom: 90,
            child: _MessageVide(),
          ),
        // État erreur (aucune donnée).
        if (etat.erreur != null && etat.marqueurs.isEmpty)
          Positioned(
            left: 24,
            right: 24,
            bottom: 90,
            child: _MessageErreur(
              message: etat.erreur!,
              onReessayer: () =>
                  ref.read(mapControllerProvider.notifier).rafraichir(),
            ),
          ),
      ],
    );
  }

  Widget _carte(List<ClusterCarte> clusters) {
    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: MapConstants.centreReunion,
        initialZoom: MapConstants.zoomInitial,
        minZoom: MapConstants.zoomMin,
        maxZoom: MapConstants.zoomMax,
        cameraConstraint: MapConstants.contrainteCamera,
        backgroundColor: EndirekColors.surface,
        // Tap ailleurs sur la carte → désélection de la preview.
        onTap: (_, _) => _deselectionner(),
        onPositionChanged: (camera, _) {
          if (camera.zoom != _zoom) {
            setState(() => _zoom = camera.zoom);
          }
        },
      ),
      children: [
        TileLayer(
          urlTemplate: MapConstants.tuilesUrlTemplate,
          userAgentPackageName: MapConstants.userAgentPackageName,
          maxZoom: MapConstants.zoomMax,
        ),
        MarkerLayer(markers: _marqueurs(clusters)),
      ],
    );
  }

  /// Construit les widgets de marqueurs à partir des clusters : bulle numérotée
  /// pour un agrégat, pin dédié pour un solitaire.
  List<Marker> _marqueurs(List<ClusterCarte> clusters) {
    final double pas = _clusterer.tailleCellulePourZoom(_zoom);
    return clusters.map((cluster) {
      final int code = MarkerClusterer.codeCellule(cluster.position, pas);
      if (cluster.estAgregat) {
        return Marker(
          key: ValueKey('cluster-${cluster.cle(code)}'),
          point: cluster.position,
          width: 56,
          height: 56,
          child: GestureDetector(
            onTap: () => _tapCluster(cluster),
            child: BulleCluster(nombre: cluster.taille),
          ),
        );
      }
      final MapMarker m = cluster.unique;
      final bool selectionne = _selection?.cle == m.cle;
      return Marker(
        key: ValueKey('marqueur-${m.cle}'),
        point: m.point,
        width: 48,
        height: 56,
        alignment: Alignment.topCenter,
        child: GestureDetector(
          onTap: () => _tapMarqueur(m),
          child: m.genre == GenreMarqueur.camera
              ? PinCamera(selectionne: selectionne)
              : PinPost(slug: m.typeSlug, selectionne: selectionne),
        ),
      );
    }).toList();
  }

  /// Tap sur un cluster : zoom de deux crans pour éclater le cluster sur sa
  /// position.
  void _tapCluster(ClusterCarte cluster) {
    _deselectionner();
    final double cible =
        (_zoom + 2).clamp(MapConstants.zoomMin, MapConstants.zoomMax);
    _mapController.move(cluster.position, cible);
  }

  /// Tap sur un marqueur solitaire : sélection (affiche la preview) + centrage
  /// doux.
  void _tapMarqueur(MapMarker m) {
    setState(() => _selection = m);
    _mapController.move(m.point, _zoom);
  }

  void _deselectionner() {
    if (_selection != null) {
      setState(() => _selection = null);
    }
  }

  /// Ouvre le détail depuis la preview : /post/:id ou /camera/:id.
  void _ouvrirDetail() {
    final MapMarker? m = _selection;
    if (m == null) {
      return;
    }
    if (m.genre == GenreMarqueur.camera) {
      context.push('/camera/${m.camera!.id}');
    } else {
      context.push('/post/${m.post!.id}');
    }
  }

  void _recentrer() {
    _deselectionner();
    _mapController.move(
      MapConstants.centreReunion,
      MapConstants.zoomInitial,
    );
  }

  Future<void> _ouvrirFiltres() async {
    final MapState etat = ref.read(mapControllerProvider);
    final MapFiltres? nouveaux = await montrerFiltresCarte(
      context,
      etat.filtres,
    );
    if (nouveaux != null) {
      _deselectionner();
      await ref.read(mapControllerProvider.notifier).appliquerFiltres(nouveaux);
    }
  }

  /// Recherche : placeholder propre au Lot 1 (le saut vers une commune via
  /// /map/communes est prévu pour un lot ultérieur — décision documentée).
  void _recherche() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Recherche bientôt disponible')),
    );
  }
}

/// Trois chips de mode en haut de la carte — bascules RAPIDES par famille
/// (le réglage fin par type reste dans le bottom sheet de filtres) :
/// « Météo & trafic » (météo/trafic/danger/caméras du Lot 1),
/// « Offres & restos » (menus + offres des pages — Lot 3) et
/// « Événements » (événements des pages — Lot 3).
class _ChipsMode extends ConsumerWidget {
  const _ChipsMode();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MapFiltres filtres =
        ref.watch(mapControllerProvider.select((etat) => etat.filtres));
    final bool live = filtres.meteo ||
        filtres.trafic ||
        filtres.danger ||
        filtres.cameras;
    final bool offresRestos = filtres.menus || filtres.offres;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _ChipMode(
            libelle: 'Météo & trafic',
            actif: live,
            onTap: () => _appliquer(
              ref,
              filtres.copyWith(
                meteo: !live,
                trafic: !live,
                danger: !live,
                cameras: !live,
              ),
            ),
          ),
          const SizedBox(width: 8),
          _ChipMode(
            libelle: 'Offres & restos',
            actif: offresRestos,
            onTap: () => _appliquer(
              ref,
              filtres.copyWith(menus: !offresRestos, offres: !offresRestos),
            ),
          ),
          const SizedBox(width: 8),
          _ChipMode(
            libelle: 'Événements',
            actif: filtres.evenements,
            onTap: () => _appliquer(
              ref,
              filtres.copyWith(evenements: !filtres.evenements),
            ),
          ),
        ],
      ),
    );
  }

  void _appliquer(WidgetRef ref, MapFiltres filtres) {
    ref.read(mapControllerProvider.notifier).appliquerFiltres(filtres);
  }
}

class _ChipMode extends StatelessWidget {
  const _ChipMode({required this.libelle, required this.actif, this.onTap});

  final String libelle;
  final bool actif;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: actif ? EndirekColors.bleu : Colors.white,
      borderRadius: BorderRadius.circular(20),
      elevation: 2,
      shadowColor: const Color(0x22000000),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          child: Text(
            libelle,
            style: TextStyle(
              color: actif ? Colors.white : EndirekColors.encre,
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

/// Colonne de boutons flottants (recherche, filtres, recentrer).
class _BoutonsCarte extends StatelessWidget {
  const _BoutonsCarte({
    required this.onRecentrer,
    required this.onFiltres,
    required this.onRecherche,
  });

  final VoidCallback onRecentrer;
  final VoidCallback onFiltres;
  final VoidCallback onRecherche;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _BoutonRond(
          icone: Icons.search,
          tooltip: 'Rechercher',
          onTap: onRecherche,
        ),
        const SizedBox(height: 10),
        _BoutonRond(
          icone: Icons.tune,
          tooltip: 'Filtres',
          onTap: onFiltres,
        ),
        const SizedBox(height: 10),
        _BoutonRond(
          icone: Icons.my_location,
          tooltip: 'Recentrer sur La Réunion',
          onTap: onRecentrer,
        ),
      ],
    );
  }
}

class _BoutonRond extends StatelessWidget {
  const _BoutonRond({
    required this.icone,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icone;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 3,
      shadowColor: const Color(0x33000000),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Tooltip(
          message: tooltip,
          child: SizedBox(
            width: 46,
            height: 46,
            child: Icon(icone, color: EndirekColors.encre, size: 22),
          ),
        ),
      ),
    );
  }
}

/// Attribution OSM (obligation de licence des tuiles).
class _AttributionOsm extends StatelessWidget {
  const _AttributionOsm();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(4),
      ),
      child: const Text(
        '© OpenStreetMap',
        style: TextStyle(color: EndirekColors.encreSecondaire, fontSize: 10),
      ),
    );
  }
}

/// Voile de chargement (premier chargement des données carte).
class _VoileChargement extends StatelessWidget {
  const _VoileChargement();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Colors.white.withValues(alpha: 0.55),
      child: const Center(child: CircularProgressIndicator()),
    );
  }
}

/// Encart « aucun élément » (chargé mais rien à afficher).
class _MessageVide extends StatelessWidget {
  const _MessageVide();

  @override
  Widget build(BuildContext context) {
    return const _EncartCarte(
      icone: Icons.location_off_outlined,
      texte: 'Aucun élément à afficher sur la carte pour le moment.',
    );
  }
}

/// Encart d'erreur avec bouton réessayer.
class _MessageErreur extends StatelessWidget {
  const _MessageErreur({required this.message, required this.onReessayer});

  final String message;
  final VoidCallback onReessayer;

  @override
  Widget build(BuildContext context) {
    return _EncartCarte(
      icone: Icons.wifi_off_outlined,
      texte: message,
      action: TextButton.icon(
        onPressed: onReessayer,
        icon: const Icon(Icons.refresh),
        label: const Text('Réessayer'),
      ),
    );
  }
}

/// Carte blanche arrondie centrée, portant un message d'état.
class _EncartCarte extends StatelessWidget {
  const _EncartCarte({
    required this.icone,
    required this.texte,
    this.action,
  });

  final IconData icone;
  final String texte;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: EndirekColors.bordure),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icone, size: 34, color: EndirekColors.encreSecondaire),
          const SizedBox(height: 10),
          Text(
            texte,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: EndirekColors.encreSecondaire,
              fontSize: 14,
              height: 1.4,
            ),
          ),
          if (action != null) ...[
            const SizedBox(height: 8),
            action!,
          ],
        ],
      ),
    );
  }
}

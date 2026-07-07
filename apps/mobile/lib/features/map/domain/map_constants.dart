import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// Constantes de la carte La Réunion — centrage, zoom et emprise. Alignées sur
/// REUNION_BBOX côté API (src/common/geo/reunion.ts) : latMin -21.6,
/// latMax -20.7, lngMin 55.0, lngMax 56.0.
abstract final class MapConstants {
  /// Gabarit des tuiles OSM. Constante configurable : un miroir ou un fournisseur
  /// self-hosted pourra être injecté ici sans toucher la couche présentation.
  /// (OSM impose l'attribution — affichée en overlay obligatoire.)
  static const String tuilesUrlTemplate =
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  /// Identifiant d'agent requis par la politique d'usage des tuiles OSM.
  static const String userAgentPackageName = 're.endirek';

  /// Centre de l'île (au large de l'intérieur montagneux) — vue par défaut.
  static const LatLng centreReunion = LatLng(-21.115, 55.536);

  /// Zoom initial : l'île tient à l'écran.
  static const double zoomInitial = 9.5;

  /// Bornes de zoom autorisées.
  static const double zoomMin = 8.5;
  static const double zoomMax = 18;

  /// Emprise de La Réunion (miroir de REUNION_BBOX côté API). La caméra de la
  /// carte est contrainte à cette zone : impossible de dériver loin de l'île.
  static final LatLngBounds empriseReunion = LatLngBounds(
    const LatLng(-21.6, 55.0),
    const LatLng(-20.7, 56.0),
  );

  /// Contrainte de caméra flutter_map : la vue ne peut pas sortir de l'emprise.
  static final CameraConstraint contrainteCamera =
      CameraConstraint.contain(bounds: empriseReunion);
}

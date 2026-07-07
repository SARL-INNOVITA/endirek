import 'package:flutter/material.dart';

import '../../../../core/theme/endirek_theme.dart';
import '../../domain/map_marker.dart';

/// Visuel d'un TYPE de marqueur carte : icône + couleur, distincts par type
/// de post et pour les caméras. Table centralisée pour rester cohérente entre
/// le pin sur la carte, la preview card et le bottom sheet de filtres.
class VisuelMarqueur {
  const VisuelMarqueur({
    required this.icone,
    required this.couleur,
    required this.libelle,
  });

  final IconData icone;
  final Color couleur;
  final String libelle;

  /// Couleurs distinctes par famille (alignées sur la référence visuelle) :
  /// météo = bleu, trafic = orange, danger = rouge, caméra = sombre.
  static const Color _bleuMeteo = Color(0xFF1173D4);
  static const Color _orangeTrafic = Color(0xFFF97316);
  static const Color _rougeDanger = Color(0xFFDC2626);

  /// Couleur des marqueurs caméra (carré sombre) — exposée pour les vignettes.
  static const Color couleurCamera = Color(0xFF1F2937);

  /// Visuel d'un marqueur de POST selon son slug de type.
  static VisuelMarqueur pourTypePost(String slug) {
    return switch (slug) {
      'weather' => const VisuelMarqueur(
          icone: Icons.cloud_outlined,
          couleur: _bleuMeteo,
          libelle: 'Météo',
        ),
      'traffic' => const VisuelMarqueur(
          icone: Icons.directions_car_outlined,
          couleur: _orangeTrafic,
          libelle: 'Trafic',
        ),
      'danger' => const VisuelMarqueur(
          icone: Icons.warning_amber_rounded,
          couleur: _rougeDanger,
          libelle: 'Danger',
        ),
      _ => const VisuelMarqueur(
          icone: Icons.place_outlined,
          couleur: _bleuMeteo,
          libelle: 'Publication',
        ),
    };
  }

  /// Visuel des caméras (identique quelle que soit la catégorie ; la nuance
  /// météo/trafic est portée par le libellé de la preview card).
  static const VisuelMarqueur camera = VisuelMarqueur(
    icone: Icons.videocam_outlined,
    couleur: couleurCamera,
    libelle: 'Caméra',
  );

  /// Visuel d'un marqueur quel qu'il soit.
  static VisuelMarqueur pour(MapMarker marqueur) {
    return marqueur.genre == GenreMarqueur.camera
        ? camera
        : pourTypePost(marqueur.typeSlug);
  }
}

/// Pin d'un POST : goutte colorée (triangle pointant vers le bas) portant
/// l'icône du type. Sélectionné → agrandi + halo.
class PinPost extends StatelessWidget {
  const PinPost({super.key, required this.slug, this.selectionne = false});

  final String slug;
  final bool selectionne;

  @override
  Widget build(BuildContext context) {
    final VisuelMarqueur visuel = VisuelMarqueur.pourTypePost(slug);
    return _GoutteMarqueur(
      icone: visuel.icone,
      couleur: visuel.couleur,
      selectionne: selectionne,
    );
  }
}

/// Pin d'une CAMÉRA : carré arrondi sombre + icône caméra + badge LIVE orange.
class PinCamera extends StatelessWidget {
  const PinCamera({super.key, this.selectionne = false});

  final bool selectionne;

  @override
  Widget build(BuildContext context) {
    final double taille = selectionne ? 40 : 34;
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        Container(
          width: taille,
          height: taille,
          decoration: BoxDecoration(
            color: VisuelMarqueur.camera.couleur,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 4,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Icon(
            VisuelMarqueur.camera.icone,
            color: Colors.white,
            size: taille * 0.55,
          ),
        ),
        Positioned(
          top: -6,
          right: -6,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            decoration: BoxDecoration(
              color: const Color(0xFFF97316),
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: Colors.white, width: 1),
            ),
            child: const Text(
              'LIVE',
              style: TextStyle(
                color: Colors.white,
                fontSize: 7,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Bulle d'un CLUSTER : disque bleu portant le nombre d'éléments regroupés.
class BulleCluster extends StatelessWidget {
  const BulleCluster({super.key, required this.nombre});

  final int nombre;

  @override
  Widget build(BuildContext context) {
    // Taille croissante par paliers pour signaler visuellement la densité.
    final double taille = nombre < 10
        ? 38
        : nombre < 50
            ? 46
            : 54;
    return Container(
      width: taille,
      height: taille,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: EndirekColors.bleu,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 5,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        '$nombre',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

/// Goutte (pin) générique : cercle coloré à icône blanche, pointe en bas.
class _GoutteMarqueur extends StatelessWidget {
  const _GoutteMarqueur({
    required this.icone,
    required this.couleur,
    required this.selectionne,
  });

  final IconData icone;
  final Color couleur;
  final bool selectionne;

  @override
  Widget build(BuildContext context) {
    final double taille = selectionne ? 40 : 34;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: taille,
          height: taille,
          decoration: BoxDecoration(
            color: couleur,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 4,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Icon(icone, color: Colors.white, size: taille * 0.55),
        ),
        // Petite pointe sous le cercle (effet goutte).
        Transform.translate(
          offset: const Offset(0, -4),
          child: Icon(
            Icons.arrow_drop_down,
            color: couleur,
            size: 16,
          ),
        ),
      ],
    );
  }
}

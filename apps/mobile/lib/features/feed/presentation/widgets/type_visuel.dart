import 'package:flutter/material.dart';

import '../../../../core/theme/endirek_theme.dart';

/// Correspondance nom d'icône du référentiel `post_types` → IconData
/// Material. La table étant pilotable par le backoffice, tout nom inconnu
/// retombe sur une icône générique (jamais d'erreur).
IconData iconePourType(String nomIcone) {
  return switch (nomIcone) {
    'pencil' => Icons.edit_outlined,
    'cloud' => Icons.cloud_outlined,
    'car' => Icons.directions_car_outlined,
    'warning' => Icons.warning_amber_rounded,
    'help' => Icons.help_outline,
    // Types de page du Lot 3 (table locale types_posts_page.dart) et noms
    // plausibles de futurs types (table pilotable).
    'megaphone' => Icons.campaign_outlined,
    'camera' => Icons.photo_camera_outlined,
    'event' => Icons.event_outlined,
    'sale' => Icons.local_offer_outlined,
    'restaurant' => Icons.restaurant_outlined,
    _ => Icons.label_outline,
  };
}

/// Couleur « #RRGGBB » du référentiel → [Color], avec repli sur le bleu
/// Endirek si la chaîne est invalide.
Color couleurPourType(String hex) {
  final String nettoye = hex.replaceFirst('#', '').trim();
  if (nettoye.length == 6) {
    final int? valeur = int.tryParse(nettoye, radix: 16);
    if (valeur != null) {
      return Color(0xFF000000 | valeur);
    }
  }
  return EndirekColors.bleu;
}

/// Pastille ronde colorée portant l'icône d'un type de post (coin haut
/// droit des cartes du fil, bottom sheet du composer...).
class PastilleType extends StatelessWidget {
  const PastilleType({
    super.key,
    required this.nomIcone,
    required this.couleurHex,
    this.taille = 32,
    this.tooltip,
  });

  final String nomIcone;
  final String couleurHex;
  final double taille;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final Color couleur = couleurPourType(couleurHex);
    final Widget pastille = Container(
      width: taille,
      height: taille,
      decoration: BoxDecoration(
        color: couleur.withValues(alpha: 0.12),
        shape: BoxShape.circle,
      ),
      child: Icon(iconePourType(nomIcone), size: taille * 0.55, color: couleur),
    );
    if (tooltip == null) {
      return pastille;
    }
    return Tooltip(message: tooltip!, child: pastille);
  }
}

import 'package:flutter/material.dart';

import '../../../../core/theme/endirek_theme.dart';

/// Badge « page vérifiée » : coche bleue accolée au nom de la page
/// (mockup 08) — partagé entre l'écran de page, la carte de post du fil,
/// le détail de post et les bandeaux de messagerie.
class BadgeVerifie extends StatelessWidget {
  const BadgeVerifie({super.key, this.taille = 18});

  final double taille;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Page vérifiée',
      child: Icon(Icons.verified, size: taille, color: EndirekColors.bleu),
    );
  }
}

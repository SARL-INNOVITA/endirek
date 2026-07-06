import 'package:flutter/material.dart';

import '../theme/endirek_theme.dart';

/// Écran « à venir » des onglets non couverts par le Lot 1 étape 4
/// (Carte → étape 5, News et Dealplace → lots suivants) : icône, titre et
/// message sobres, sans aucune logique.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({
    super.key,
    required this.icone,
    required this.titre,
    required this.message,
  });

  final IconData icone;
  final String titre;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: const BoxDecoration(
                color: EndirekColors.surface,
                shape: BoxShape.circle,
              ),
              child: Icon(icone, size: 40, color: EndirekColors.bleu),
            ),
            const SizedBox(height: 20),
            Text(
              titre,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EndirekColors.encre,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

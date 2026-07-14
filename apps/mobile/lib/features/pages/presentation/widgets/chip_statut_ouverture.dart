import 'package:flutter/material.dart';

import '../../domain/formatage_pages.dart';
import '../../domain/page_models.dart';

/// Chip du STATUT D'OUVERTURE dérivé d'une page (mockup 08) :
/// - OUVERT (vert), FERMÉ (rouge), EN CONGÉS (orange, avec la date de fin
///   quand [detaille] est vrai).
///
/// Partagé entre l'écran public de page et la tuile « Mes pages » du profil.
class ChipStatutOuverture extends StatelessWidget {
  const ChipStatutOuverture({
    super.key,
    required this.statut,
    this.detaille = false,
  });

  final PageOpenStatus statut;

  /// Ajoute « jusqu'au dd/MM » au libellé EN CONGÉS (écran de page).
  final bool detaille;

  @override
  Widget build(BuildContext context) {
    final (String libelle, Color texte, Color fond) = switch (statut.state) {
      'open' => ('OUVERT', const Color(0xFF16A34A), const Color(0xFFE7F6EC)),
      'vacation' => (
          detaille && statut.vacationUntil != null
              ? 'EN CONGÉS · jusqu\'au '
                  '${formaterDateCourte(statut.vacationUntil!)}'
              : 'EN CONGÉS',
          const Color(0xFFB45309),
          const Color(0xFFFEF3C7),
        ),
      _ => ('FERMÉ', const Color(0xFFB3261E), const Color(0xFFFDECEA)),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: fond,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        libelle,
        style: TextStyle(
          color: texte,
          fontSize: 12,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

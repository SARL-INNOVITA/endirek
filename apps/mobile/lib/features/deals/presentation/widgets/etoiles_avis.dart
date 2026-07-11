import 'package:flutter/material.dart';

import '../../../../core/theme/endirek_theme.dart';

const Color _orEtoile = Color(0xFFF59E0B);

/// Sélecteur d'étoiles 1-5 pour un critère d'avis (mockup 05).
class SelecteurEtoiles extends StatelessWidget {
  const SelecteurEtoiles({
    super.key,
    required this.libelle,
    required this.valeur,
    required this.onChanged,
  });

  final String libelle;
  final int valeur;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            libelle,
            style: const TextStyle(
              color: EndirekColors.encre,
              fontSize: 13,
            ),
          ),
        ),
        for (int i = 1; i <= 5; i++)
          GestureDetector(
            onTap: () => onChanged(i),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1.5),
              child: Icon(
                i <= valeur ? Icons.star : Icons.star_border,
                size: 22,
                color: i <= valeur ? _orEtoile : EndirekColors.encreSecondaire,
              ),
            ),
          ),
      ],
    );
  }
}

/// Note en lecture seule : « ★ 4,7 » (une décimale à la française).
class EtoilesLecture extends StatelessWidget {
  const EtoilesLecture({super.key, required this.note});

  final double note;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.star, size: 16, color: _orEtoile),
        const SizedBox(width: 3),
        Text(
          note.toStringAsFixed(1).replaceAll('.', ','),
          style: const TextStyle(
            color: EndirekColors.encre,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

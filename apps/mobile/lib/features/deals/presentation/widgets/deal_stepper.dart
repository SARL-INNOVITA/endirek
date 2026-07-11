import 'package:flutter/material.dart';

import '../../../../core/theme/endirek_theme.dart';

/// Stepper 5 étapes du mockup 07 : Discussion → Accord → En cours →
/// Validations → Conclu. L'étape courante vient du SERVEUR (`stage`,
/// dérivée du statut + de l'état des sous-éléments). Un deal clos non conclu
/// (refusé/annulé/litige) grise le stepper.
class DealStepper extends StatelessWidget {
  const DealStepper({super.key, required this.stage, required this.status});

  final String stage;
  final String status;

  static const List<(String, String)> _etapes = [
    ('discussion', 'Discussion'),
    ('agreement', 'Accord'),
    ('in_progress', 'En cours'),
    ('validations', 'Validations'),
    ('concluded', 'Conclu'),
  ];

  @override
  Widget build(BuildContext context) {
    final bool clos = stage == 'closed';
    final int courant =
        clos ? -1 : _etapes.indexWhere((e) => e.$1 == stage);
    return Row(
      children: [
        for (int i = 0; i < _etapes.length; i++) ...[
          if (i > 0)
            Expanded(
              child: Container(
                height: 2,
                color: !clos && i <= courant
                    ? EndirekColors.bleu
                    : EndirekColors.bordure,
              ),
            ),
          Column(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: clos
                      ? EndirekColors.surface
                      : i < courant
                          ? EndirekColors.bleu
                          : i == courant
                              ? Colors.white
                              : EndirekColors.surface,
                  border: Border.all(
                    color: !clos && i <= courant
                        ? EndirekColors.bleu
                        : EndirekColors.bordure,
                    width: 2,
                  ),
                ),
                child: Center(
                  child: !clos && i < courant
                      ? const Icon(Icons.check, size: 14, color: Colors.white)
                      : Text(
                          '${i + 1}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: !clos && i == courant
                                ? EndirekColors.bleu
                                : EndirekColors.encreSecondaire,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 3),
              Text(
                _etapes[i].$2,
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight:
                      !clos && i == courant ? FontWeight.w700 : FontWeight.w500,
                  color: !clos && i <= courant
                      ? EndirekColors.encre
                      : EndirekColors.encreSecondaire,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

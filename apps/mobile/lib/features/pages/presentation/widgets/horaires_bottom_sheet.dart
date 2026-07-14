import 'package:flutter/material.dart';

import '../../../../core/theme/endirek_theme.dart';
import '../../domain/formatage_pages.dart';
import '../../domain/page_models.dart';

/// Bottom sheet « Voir les horaires » : les 7 jours (Lundi → Dimanche) avec
/// leurs plages « HH:MM – HH:MM » (plusieurs plages séparées par « · »)
/// ou « Fermé ». Le jour COURANT est mis en évidence.
Future<void> montrerHorairesPage(
  BuildContext context,
  List<PageHourView> horaires,
) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (contexteFeuille) => _HorairesSheet(horaires: horaires),
  );
}

class _HorairesSheet extends StatelessWidget {
  const _HorairesSheet({required this.horaires});

  final List<PageHourView> horaires;

  @override
  Widget build(BuildContext context) {
    // DateTime.weekday : 1 = lundi … 7 = dimanche → index contrat 0..6.
    final int aujourdHui = DateTime.now().weekday - 1;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Horaires d\'ouverture',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: EndirekColors.encre,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            for (int jour = 0; jour < 7; jour++)
              _LigneJour(
                nom: joursSemaine[jour],
                plages: _plagesDuJour(jour),
                estAujourdHui: jour == aujourdHui,
              ),
          ],
        ),
      ),
    );
  }

  /// Plages du jour, jointes par « · », ou null si fermé ce jour-là.
  String? _plagesDuJour(int jour) {
    final List<String> plages = [
      for (final PageHourView plage in horaires)
        if (plage.weekday == jour)
          formaterPlageHoraire(plage.opensAt, plage.closesAt),
    ];
    return plages.isEmpty ? null : plages.join(' · ');
  }
}

/// Une ligne « Lundi | 11:30 – 14:00 · 19:00 – 22:00 » (ou « Fermé »).
class _LigneJour extends StatelessWidget {
  const _LigneJour({
    required this.nom,
    required this.plages,
    required this.estAujourdHui,
  });

  final String nom;
  final String? plages;
  final bool estAujourdHui;

  @override
  Widget build(BuildContext context) {
    final FontWeight graisse =
        estAujourdHui ? FontWeight.w800 : FontWeight.w500;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              nom,
              style: TextStyle(
                color: EndirekColors.encre,
                fontSize: 14.5,
                fontWeight: graisse,
              ),
            ),
          ),
          Expanded(
            child: Text(
              plages ?? 'Fermé',
              textAlign: TextAlign.right,
              style: TextStyle(
                color: plages == null
                    ? EndirekColors.encreSecondaire
                    : EndirekColors.encre,
                fontSize: 14.5,
                fontWeight: graisse,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

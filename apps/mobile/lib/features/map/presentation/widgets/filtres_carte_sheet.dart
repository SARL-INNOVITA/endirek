import 'package:flutter/material.dart';

import '../../../../core/theme/endirek_theme.dart';
import '../../application/map_controller.dart';
import 'marqueur_carte.dart';

/// Bottom sheet de filtrage de la carte : bascules Météo / Trafic / Danger /
/// Caméras. Renvoie les nouveaux filtres au `pop` (null si annulé).
Future<MapFiltres?> montrerFiltresCarte(
  BuildContext context,
  MapFiltres actuels,
) {
  return showModalBottomSheet<MapFiltres>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (context) => _FiltresCarteSheet(actuels: actuels),
  );
}

class _FiltresCarteSheet extends StatefulWidget {
  const _FiltresCarteSheet({required this.actuels});

  final MapFiltres actuels;

  @override
  State<_FiltresCarteSheet> createState() => _FiltresCarteSheetState();
}

class _FiltresCarteSheetState extends State<_FiltresCarteSheet> {
  late MapFiltres _filtres = widget.actuels;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Poignée.
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: EndirekColors.bordure,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const Text(
              'Afficher sur la carte',
              style: TextStyle(
                color: EndirekColors.encre,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Choisissez les éléments à afficher. Les caméras suivent les '
              'catégories météo et trafic sélectionnées.',
              style: TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 13,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 8),
            _Bascule(
              visuel: VisuelMarqueur.pourTypePost('weather'),
              valeur: _filtres.meteo,
              onChange: (v) => setState(() => _filtres = _filtres.copyWith(meteo: v)),
            ),
            _Bascule(
              visuel: VisuelMarqueur.pourTypePost('traffic'),
              valeur: _filtres.trafic,
              onChange: (v) => setState(() => _filtres = _filtres.copyWith(trafic: v)),
            ),
            _Bascule(
              visuel: VisuelMarqueur.pourTypePost('danger'),
              valeur: _filtres.danger,
              onChange: (v) => setState(() => _filtres = _filtres.copyWith(danger: v)),
            ),
            _Bascule(
              visuel: VisuelMarqueur.camera,
              valeur: _filtres.cameras,
              onChange: (v) => setState(() => _filtres = _filtres.copyWith(cameras: v)),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(_filtres),
              child: const Text('Appliquer'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Une ligne de bascule : icône colorée + libellé + Switch.
class _Bascule extends StatelessWidget {
  const _Bascule({
    required this.visuel,
    required this.valeur,
    required this.onChange,
  });

  final VisuelMarqueur visuel;
  final bool valeur;
  final ValueChanged<bool> onChange;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile.adaptive(
      contentPadding: EdgeInsets.zero,
      activeThumbColor: EndirekColors.bleu,
      value: valeur,
      onChanged: onChange,
      secondary: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: visuel.couleur.withValues(alpha: 0.12),
          shape: BoxShape.circle,
        ),
        child: Icon(visuel.icone, size: 20, color: visuel.couleur),
      ),
      title: Text(
        visuel.libelle,
        style: const TextStyle(
          color: EndirekColors.encre,
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

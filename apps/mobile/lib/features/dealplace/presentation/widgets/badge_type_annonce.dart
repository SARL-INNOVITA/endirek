import 'package:flutter/material.dart';

import '../../../../core/theme/endirek_theme.dart';

/// Petit badge du TYPE d'annonce (bien / service) : pastille colorée avec
/// icône + libellé, posée sur les cartes et l'en-tête du détail.
///
/// - bien    → « Bien » (icône inventaire, teinte ambre) ;
/// - service → « Service » (icône poignée de main, teinte bleu Endirek).
class BadgeTypeAnnonce extends StatelessWidget {
  const BadgeTypeAnnonce({super.key, required this.listingType, this.compact = false});

  /// 'good' | 'service'.
  final String listingType;

  /// Version compacte (icône seule un peu plus petite) pour les cartes denses.
  final bool compact;

  bool get _estBien => listingType == 'good';

  @override
  Widget build(BuildContext context) {
    final Color couleur = _estBien ? const Color(0xFFB45309) : EndirekColors.bleu;
    final Color fond = _estBien ? const Color(0xFFFEF3C7) : const Color(0xFFE0EDFA);
    final IconData icone =
        _estBien ? Icons.inventory_2_outlined : Icons.handshake_outlined;
    final String libelle = _estBien ? 'Bien' : 'Service';

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 7 : 9,
        vertical: compact ? 3 : 4,
      ),
      decoration: BoxDecoration(
        color: fond,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icone, size: compact ? 12 : 14, color: couleur),
          const SizedBox(width: 4),
          Text(
            libelle,
            style: TextStyle(
              color: couleur,
              fontSize: compact ? 11 : 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

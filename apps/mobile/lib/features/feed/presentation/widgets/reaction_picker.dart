import 'package:flutter/material.dart';

import '../../../../core/theme/endirek_theme.dart';
import '../../domain/reactions_palette.dart';

/// Ouvre le sélecteur de réactions (appui long sur « J'aime ») et renvoie
/// l'emoji choisi, ou null si l'utilisateur referme sans choisir.
///
/// [reactionActuelle] met en évidence la réaction déjà posée par le viewer.
Future<String?> montrerSelecteurReaction(
  BuildContext context, {
  String? reactionActuelle,
}) {
  return showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (contexteFeuille) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Réagir',
                style: TextStyle(
                  color: EndirekColors.encre,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  for (final ReactionChoix choix in paletteReactions)
                    Expanded(
                      child: _ChoixReaction(
                        choix: choix,
                        actif: choix.emoji == reactionActuelle,
                        surSelection: () =>
                            Navigator.of(contexteFeuille).pop(choix.emoji),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _ChoixReaction extends StatelessWidget {
  const _ChoixReaction({
    required this.choix,
    required this.actif,
    required this.surSelection,
  });

  final ReactionChoix choix;
  final bool actif;
  final VoidCallback surSelection;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: surSelection,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: actif
            ? BoxDecoration(
                color: const Color(0xFFE0EDFA),
                borderRadius: BorderRadius.circular(12),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(choix.emoji, style: const TextStyle(fontSize: 28)),
            const SizedBox(height: 4),
            Text(
              choix.labelFr,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

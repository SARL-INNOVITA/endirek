import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/post_type.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../feed/application/referentiels_providers.dart';
import '../../feed/presentation/widgets/type_visuel.dart';

/// Ouvre la bottom sheet de choix du type de publication (référentiel
/// GET /posts/types, actifs triés par position) et renvoie le type choisi,
/// ou null si l'utilisateur referme sans choisir.
Future<PostType?> montrerChoixTypePost(BuildContext context) {
  return showModalBottomSheet<PostType>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (contexteFeuille) {
      return SafeArea(
        child: Consumer(
          builder: (context, ref, _) {
            final AsyncValue<List<PostType>> types =
                ref.watch(postTypesProvider);
            return switch (types) {
              AsyncData(:final value) => _ListeTypes(types: value),
              AsyncError() => _ErreurTypes(
                  surReessayer: () => ref.invalidate(postTypesProvider),
                ),
              _ => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                ),
            };
          },
        ),
      );
    },
  );
}

class _ListeTypes extends StatelessWidget {
  const _ListeTypes({required this.types});

  final List<PostType> types;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Text(
            'Créer une publication',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: EndirekColors.encre,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        for (final PostType type in types)
          ListTile(
            leading: PastilleType(
              nomIcone: type.icon,
              couleurHex: type.color,
              taille: 40,
            ),
            title: Text(
              type.labelFr,
              style: const TextStyle(
                color: EndirekColors.encre,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            subtitle: Text(
              _descriptionCourte(type),
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 12.5,
              ),
            ),
            onTap: () => Navigator.of(context).pop(type),
          ),
        const SizedBox(height: 12),
      ],
    );
  }

  /// Description courte DÉRIVÉE des attributs du type (table pilotable —
  /// aucun texte codé par slug) : visibilité carte et durée lisible.
  static String _descriptionCourte(PostType type) {
    if (!type.showsOnMap) {
      return 'Publiée dans le fil';
    }
    final int? minutes = type.defaultMapDurationMinutes;
    if (minutes == null || minutes <= 0) {
      return 'Visible sur la carte';
    }
    return 'Visible sur la carte pendant ${_dureeLisible(minutes)}';
  }

  static String _dureeLisible(int minutes) {
    if (minutes < 60) {
      return '$minutes min';
    }
    final int heures = minutes ~/ 60;
    final int reste = minutes % 60;
    return reste == 0 ? '$heures h' : '$heures h $reste';
  }
}

class _ErreurTypes extends StatelessWidget {
  const _ErreurTypes({required this.surReessayer});

  final VoidCallback surReessayer;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Impossible de charger les types de publication.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: EndirekColors.encreSecondaire,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: surReessayer,
            icon: const Icon(Icons.refresh),
            label: const Text('Réessayer'),
          ),
        ],
      ),
    );
  }
}

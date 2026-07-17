import 'package:flutter/material.dart';

import '../../../../core/api/models/camera.dart';
import '../../../../core/api/models/map_post_item.dart';
import '../../../../core/api/models/post_page_ref.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../../../core/utils/temps_relatif.dart';
import '../../domain/map_marker.dart';
import 'marqueur_carte.dart';

/// Bottom sheet listant le CONTENU d'un cluster INDIVISIBLE : des marqueurs
/// confondus au même endroit qu'aucun zoom ne peut séparer — cas nominal des
/// publications d'une même page (menu/offre/événement au point de la page,
/// Lot 3). Renvoie le marqueur choisi au `pop` (null si fermé sans choix) ;
/// l'appelant le sélectionne comme un tap de marqueur ordinaire (preview).
Future<MapMarker?> montrerContenuCluster(
  BuildContext context,
  List<MapMarker> marqueurs,
) {
  return showModalBottomSheet<MapMarker>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (context) => _ContenuClusterSheet(marqueurs: marqueurs),
  );
}

class _ContenuClusterSheet extends StatelessWidget {
  const _ContenuClusterSheet({required this.marqueurs});

  final List<MapMarker> marqueurs;

  @override
  Widget build(BuildContext context) {
    // Contenu DÉFILANT : la hauteur dépend du nombre de marqueurs confondus.
    return SafeArea(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: EndirekColors.bordure,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                _titre(marqueurs),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: EndirekColors.encre,
                ),
              ),
              const SizedBox(height: 6),
              for (final MapMarker m in marqueurs) _LigneMarqueur(marqueur: m),
            ],
          ),
        ),
      ),
    );
  }

  /// « N publications à cet endroit » — « contenus » si une caméra s'y mêle.
  static String _titre(List<MapMarker> marqueurs) {
    final bool quePosts =
        marqueurs.every((m) => m.genre == GenreMarqueur.post);
    final int n = marqueurs.length;
    final String nom = quePosts
        ? (n > 1 ? 'publications' : 'publication')
        : (n > 1 ? 'contenus' : 'contenu');
    return '$n $nom à cet endroit';
  }
}

/// Une ligne du cluster : icône du type, en-tête (type + page éventuelle),
/// titre et « ville · temps relatif ». Tap → renvoie le marqueur.
class _LigneMarqueur extends StatelessWidget {
  const _LigneMarqueur({required this.marqueur});

  final MapMarker marqueur;

  @override
  Widget build(BuildContext context) {
    final VisuelMarqueur visuel = VisuelMarqueur.pour(marqueur);
    return InkWell(
      onTap: () => Navigator.of(context).pop(marqueur),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: visuel.couleur.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(visuel.icone, size: 22, color: visuel.couleur),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _enTete(visuel),
                  const SizedBox(height: 2),
                  Text(
                    _titre(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: EndirekColors.encre,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _sousTitre(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: EndirekColors.encreSecondaire,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right,
              color: EndirekColors.encreSecondaire,
            ),
          ],
        ),
      ),
    );
  }

  /// Ligne de type (libellé coloré) + identité de PAGE éventuelle (nom + ✓).
  Widget _enTete(VisuelMarqueur visuel) {
    final PostPageRef? page = marqueur.post?.page;
    return Row(
      children: [
        Text(
          visuel.libelle,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: visuel.couleur,
          ),
        ),
        if (page != null) ...[
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              page.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (page.verified) ...[
            const SizedBox(width: 3),
            const Icon(Icons.verified, size: 13, color: EndirekColors.bleu),
          ],
        ],
      ],
    );
  }

  String _titre() {
    if (marqueur.genre == GenreMarqueur.camera) {
      return marqueur.camera!.name;
    }
    final MapPostItem post = marqueur.post!;
    final String? titre = post.title?.trim();
    if (titre != null && titre.isNotEmpty) {
      return titre;
    }
    return 'Publication';
  }

  /// « ville · il y a … » pour un post, « ville · quartier » pour une caméra.
  String _sousTitre() {
    if (marqueur.genre == GenreMarqueur.camera) {
      final Camera camera = marqueur.camera!;
      final String? quartier = camera.districtName;
      if (quartier != null && quartier.isNotEmpty) {
        return '${camera.cityName} · $quartier';
      }
      return camera.cityName;
    }
    final MapPostItem post = marqueur.post!;
    final String temps = tempsRelatif(post.createdAt);
    final String? ville = post.city;
    if (ville != null && ville.isNotEmpty) {
      return '$ville · $temps';
    }
    return temps;
  }
}

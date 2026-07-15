import 'package:flutter/material.dart';

import '../../../../core/api/models/camera.dart';
import '../../../../core/api/models/map_post_item.dart';
import '../../../../core/api/models/post_page_ref.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../../../core/utils/temps_relatif.dart';
import '../../domain/map_marker.dart';
import 'marqueur_carte.dart';

/// Preview card flottante affichée au tap d'un marqueur (bas de carte). Un tap
/// sur la card ouvre le détail : /post/:id ou /camera/:id.
class PreviewMarqueur extends StatelessWidget {
  const PreviewMarqueur({
    super.key,
    required this.marqueur,
    required this.onOuvrir,
    required this.onFermer,
  });

  final MapMarker marqueur;
  final VoidCallback onOuvrir;
  final VoidCallback onFermer;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: EndirekColors.bordure),
          boxShadow: const [
            BoxShadow(
              color: Color(0x22000000),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onOuvrir,
          child: marqueur.genre == GenreMarqueur.camera
              ? _ContenuCamera(camera: marqueur.camera!, onFermer: onFermer)
              : _ContenuPost(post: marqueur.post!, onFermer: onFermer),
        ),
      ),
    );
  }
}

/// Preview d'un post carte : vignette média (si présente), libellé de type,
/// titre/texte court, ville et temps relatif. Publication DE PAGE (Lot 3) :
/// l'avatar de la page sert de vignette et son nom (+ coche vérifiée)
/// complète la ligne de type.
class _ContenuPost extends StatelessWidget {
  const _ContenuPost({required this.post, required this.onFermer});

  final MapPostItem post;
  final VoidCallback onFermer;

  @override
  Widget build(BuildContext context) {
    final VisuelMarqueur visuel = VisuelMarqueur.pourTypePost(post.typeSlug);
    final PostPageRef? page = post.page;
    final String titre = (post.title != null && post.title!.trim().isNotEmpty)
        ? post.title!.trim()
        : 'Publication ${visuel.libelle.toLowerCase()}';
    final Widget ligneType = _LigneType(
      icone: visuel.icone,
      couleur: visuel.couleur,
      texte: visuel.libelle,
    );
    return _Cadre(
      onFermer: onFermer,
      vignette: page == null
          ? _VignetteIcone(icone: visuel.icone, couleur: visuel.couleur)
          : _VignettePage(page: page, visuel: visuel),
      enTete: page == null
          ? ligneType
          : Row(
              children: [
                ligneType,
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
                  const Icon(
                    Icons.verified,
                    size: 13,
                    color: EndirekColors.bleu,
                  ),
                ],
              ],
            ),
      titre: titre,
      sousTitre: _sousTitre(post),
      lienTexte: 'Voir la publication →',
    );
  }

  /// « ville · il y a … » (chaque partie omise si absente).
  String _sousTitre(MapPostItem post) {
    final String temps = tempsRelatif(post.createdAt);
    final String? ville = post.city;
    if (ville != null && ville.isNotEmpty) {
      return '$ville · $temps';
    }
    return temps;
  }
}

/// Preview d'une caméra : vignette (image du flux si streamType 'image', sinon
/// icône), libellé « Caméra météo/trafic • LIVE », nom, ville.
class _ContenuCamera extends StatelessWidget {
  const _ContenuCamera({required this.camera, required this.onFermer});

  final Camera camera;
  final VoidCallback onFermer;

  @override
  Widget build(BuildContext context) {
    return _Cadre(
      onFermer: onFermer,
      vignette: _VignetteCamera(camera: camera),
      enTete: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _LigneType(
            icone: VisuelMarqueur.camera.icone,
            couleur: VisuelMarqueur.camera.couleur,
            texte: camera.libelleCategorie,
          ),
          const SizedBox(width: 6),
          const _BadgeLive(),
        ],
      ),
      titre: camera.name,
      sousTitre: _sousTitre(camera),
      lienTexte: 'Voir la caméra →',
    );
  }

  String _sousTitre(Camera camera) {
    final String? quartier = camera.districtName;
    if (quartier != null && quartier.isNotEmpty) {
      return '${camera.cityName} · $quartier';
    }
    return camera.cityName;
  }
}

/// Ossature commune de la preview : vignette à gauche, textes à droite, croix
/// de fermeture, lien d'action.
class _Cadre extends StatelessWidget {
  const _Cadre({
    required this.vignette,
    required this.enTete,
    required this.titre,
    required this.sousTitre,
    required this.lienTexte,
    required this.onFermer,
  });

  final Widget vignette;
  final Widget enTete;
  final String titre;
  final String sousTitre;
  final String lienTexte;
  final VoidCallback onFermer;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(width: 72, height: 72, child: vignette),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                enTete,
                const SizedBox(height: 4),
                Text(
                  titre,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: EndirekColors.encre,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  sousTitre,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: EndirekColors.encreSecondaire,
                    fontSize: 12.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  lienTexte,
                  style: const TextStyle(
                    color: EndirekColors.bleu,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          // Croix de fermeture.
          InkResponse(
            onTap: onFermer,
            radius: 18,
            child: const Padding(
              padding: EdgeInsets.all(2),
              child: Icon(
                Icons.close,
                size: 18,
                color: EndirekColors.encreSecondaire,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// En-tête « icône + libellé de type » (ligne colorée).
class _LigneType extends StatelessWidget {
  const _LigneType({
    required this.icone,
    required this.couleur,
    required this.texte,
  });

  final IconData icone;
  final Color couleur;
  final String texte;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icone, size: 14, color: couleur),
        const SizedBox(width: 4),
        Text(
          texte,
          style: TextStyle(
            color: couleur,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

/// Badge « LIVE » orange (preview caméra).
class _BadgeLive extends StatelessWidget {
  const _BadgeLive();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
      decoration: BoxDecoration(
        color: const Color(0xFFF97316),
        borderRadius: BorderRadius.circular(4),
      ),
      child: const Text(
        'LIVE',
        style: TextStyle(
          color: Colors.white,
          fontSize: 9,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

/// Vignette de repli (icône colorée sur fond teinté) — post sans média.
class _VignetteIcone extends StatelessWidget {
  const _VignetteIcone({required this.icone, required this.couleur});

  final IconData icone;
  final Color couleur;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: couleur.withValues(alpha: 0.12),
      child: Icon(icone, color: couleur, size: 30),
    );
  }
}

/// Vignette d'une publication DE PAGE (Lot 3) : avatar de la page, repli sur
/// l'icône du type si absent ou en erreur.
class _VignettePage extends StatelessWidget {
  const _VignettePage({required this.page, required this.visuel});

  final PostPageRef page;
  final VisuelMarqueur visuel;

  @override
  Widget build(BuildContext context) {
    final String? url = page.avatarUrl;
    if (url != null && url.isNotEmpty) {
      return Image.network(
        ApiConfig.resolveMediaUrl(url),
        fit: BoxFit.cover,
        errorBuilder: (context, error, stack) =>
            _VignetteIcone(icone: visuel.icone, couleur: visuel.couleur),
      );
    }
    return _VignetteIcone(icone: visuel.icone, couleur: visuel.couleur);
  }
}

/// Vignette d'une caméra : image du flux si streamType 'image', sinon icône.
class _VignetteCamera extends StatelessWidget {
  const _VignetteCamera({required this.camera});

  final Camera camera;

  @override
  Widget build(BuildContext context) {
    if (camera.streamType == 'image' && camera.url.isNotEmpty) {
      return Image.network(
        ApiConfig.resolveMediaUrl(camera.url),
        fit: BoxFit.cover,
        errorBuilder: (context, error, stack) => const _VignetteIcone(
          icone: Icons.videocam_off_outlined,
          couleur: EndirekColors.encreSecondaire,
        ),
      );
    }
    return const _VignetteIcone(
      icone: Icons.videocam_outlined,
      couleur: VisuelMarqueur.couleurCamera,
    );
  }
}

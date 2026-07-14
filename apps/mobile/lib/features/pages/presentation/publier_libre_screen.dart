import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/post_media.dart';
import '../../../core/config/api_config.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../post_composer/data/media_repository.dart';
import '../data/pages_repository.dart';

/// Nombre maximal d'images d'une publication de page (contrat Lot 3).
const int _maxImages = 4;

/// PUBLICATION LIBRE au nom d'une page (/pages/:id/publier — choix
/// « Publication libre » de la bottom sheet « Publier ») : titre optionnel,
/// texte 1..2000, jusqu'à 4 images uploadées immédiatement — miroir du
/// composer utilisateur (create_post_screen), POST /pages/:id/posts
/// kind=free. Renvoie true au pop après une publication réussie.
class PublierLibreScreen extends ConsumerStatefulWidget {
  const PublierLibreScreen({super.key, required this.pageId});

  final String pageId;

  @override
  ConsumerState<PublierLibreScreen> createState() =>
      _PublierLibreScreenState();
}

/// Image en cours d'ajout : fichier local, résultat d'upload, échec
/// relançable (même pattern que le composer utilisateur).
class _MediaEnCours {
  _MediaEnCours(this.fichier);

  final XFile fichier;
  PostMedia? resultat;
  bool echec = false;

  bool get enEnvoi => resultat == null && !echec;
}

class _PublierLibreScreenState extends ConsumerState<PublierLibreScreen> {
  final TextEditingController _titreController = TextEditingController();
  final TextEditingController _texteController = TextEditingController();
  final ImagePicker _selecteur = ImagePicker();

  final List<_MediaEnCours> _medias = [];
  bool _publication = false;

  @override
  void dispose() {
    _titreController.dispose();
    _texteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bool uploadsEnCours = _medias.any((m) => m.enEnvoi);
    final bool peutPublier = !_publication &&
        !uploadsEnCours &&
        _texteController.text.trim().isNotEmpty;

    return Scaffold(
      appBar: AppBar(title: const Text('Publication de la page')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            TextField(
              controller: _titreController,
              maxLength: 120,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Titre (optionnel)',
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _texteController,
              maxLength: 2000,
              minLines: 5,
              maxLines: 10,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: 'Quoi de neuf sur votre page ?',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 16),
            _SectionImages(
              medias: _medias,
              surAjouter: _ajouterImages,
              surRetirer: (media) => setState(() => _medias.remove(media)),
              surReessayer: _relancerUpload,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: peutPublier ? _publier : null,
              child: _publication
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Publier'),
            ),
            if (uploadsEnCours) ...[
              const SizedBox(height: 8),
              const Text(
                'Envoi des images en cours…',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 12.5,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // Images (upload immédiat, comme le composer utilisateur)
  // ───────────────────────────────────────────────────────────────────────

  Future<void> _ajouterImages() async {
    final int restants = _maxImages - _medias.length;
    if (restants <= 0) {
      return;
    }
    final List<XFile> fichiers;
    try {
      fichiers = await _selecteur.pickMultiImage(limit: restants);
    } catch (_) {
      return;
    }
    if (fichiers.isEmpty || !mounted) {
      return;
    }
    final List<_MediaEnCours> ajouts = [
      for (final XFile fichier in fichiers.take(restants))
        _MediaEnCours(fichier),
    ];
    setState(() => _medias.addAll(ajouts));
    for (final _MediaEnCours ajout in ajouts) {
      await _uploader(ajout);
    }
  }

  Future<void> _relancerUpload(_MediaEnCours media) async {
    setState(() => media.echec = false);
    await _uploader(media);
  }

  Future<void> _uploader(_MediaEnCours media) async {
    try {
      final PostMedia resultat =
          await ref.read(mediaRepositoryProvider).uploaderImage(media.fichier);
      if (!mounted) {
        return;
      }
      setState(() => media.resultat = resultat);
    } on ApiException catch (erreur) {
      if (!mounted) {
        return;
      }
      setState(() => media.echec = true);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(erreur.message)));
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Publication
  // ───────────────────────────────────────────────────────────────────────

  Future<void> _publier() async {
    FocusScope.of(context).unfocus();
    final String texte = _texteController.text.trim();
    final String titre = _titreController.text.trim();
    if (texte.isEmpty) {
      return;
    }

    final List<PostMedia> medias = [
      for (final (int index, _MediaEnCours media)
          in _medias.where((m) => m.resultat != null).toList().indexed)
        media.resultat!.avecPosition(index),
    ];

    setState(() => _publication = true);
    try {
      await ref.read(pagesRepositoryProvider).publierPostDePage(
            widget.pageId,
            kind: 'free',
            title: titre.isEmpty ? null : titre,
            body: texte,
            media: medias,
          );
      if (mounted) {
        // L'écran de page confirme (snackbar) et rafraîchit ses sections.
        context.pop(true);
      }
    } on ApiException catch (erreur) {
      if (mounted) {
        setState(() => _publication = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erreur.message)));
      }
    }
  }
}

/// Rangée des vignettes d'images + tuile d'ajout (≤ 4, upload immédiat).
class _SectionImages extends StatelessWidget {
  const _SectionImages({
    required this.medias,
    required this.surAjouter,
    required this.surRetirer,
    required this.surReessayer,
  });

  final List<_MediaEnCours> medias;
  final VoidCallback surAjouter;
  final ValueChanged<_MediaEnCours> surRetirer;
  final ValueChanged<_MediaEnCours> surReessayer;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Photos (${medias.length}/$_maxImages)',
          style: const TextStyle(
            color: EndirekColors.encre,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 88,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final _MediaEnCours media in medias) ...[
                _Vignette(
                  media: media,
                  surRetirer: () => surRetirer(media),
                  surReessayer: () => surReessayer(media),
                ),
                const SizedBox(width: 8),
              ],
              if (medias.length < _maxImages)
                InkWell(
                  onTap: surAjouter,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: 88,
                    decoration: BoxDecoration(
                      color: EndirekColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: EndirekColors.bordure),
                    ),
                    child: const Icon(
                      Icons.add_photo_alternate_outlined,
                      color: EndirekColors.bleu,
                      size: 28,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Vignette 88×88 (voile + indicateur en envoi, relance sur échec, croix).
class _Vignette extends StatelessWidget {
  const _Vignette({
    required this.media,
    required this.surRetirer,
    required this.surReessayer,
  });

  final _MediaEnCours media;
  final VoidCallback surRetirer;
  final VoidCallback surReessayer;

  @override
  Widget build(BuildContext context) {
    final PostMedia? resultat = media.resultat;
    return SizedBox(
      width: 88,
      height: 88,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: resultat != null
                ? Image.network(
                    ApiConfig.resolveMediaUrl(
                      resultat.thumbnailUrl ?? resultat.url,
                    ),
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) =>
                        const ColoredBox(color: EndirekColors.surface),
                  )
                : Image.file(
                    File(media.fichier.path),
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) =>
                        const ColoredBox(color: EndirekColors.surface),
                  ),
          ),
          if (media.enEnvoi)
            Container(
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.35),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          if (media.echec)
            Container(
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.45),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: IconButton(
                  tooltip: 'Relancer l\'envoi',
                  onPressed: surReessayer,
                  icon: const Icon(Icons.refresh, color: Colors.white),
                ),
              ),
            ),
          Positioned(
            top: 2,
            right: 2,
            child: InkWell(
              onTap: surRetirer,
              customBorder: const CircleBorder(),
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.55),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close, size: 14, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

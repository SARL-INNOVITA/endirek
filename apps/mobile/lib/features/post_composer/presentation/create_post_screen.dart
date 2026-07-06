import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/commune.dart';
import '../../../core/api/models/geo_point.dart';
import '../../../core/api/models/post_media.dart';
import '../../../core/api/models/post_type.dart';
import '../../../core/config/api_config.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../feed/application/posts_liste_controller.dart';
import '../../feed/application/referentiels_providers.dart';
import '../../feed/data/posts_repository.dart';
import '../../feed/presentation/widgets/type_visuel.dart';
import '../data/media_repository.dart';

/// Nombre maximal d'images par publication (contrat étape 4).
const int _maxImages = 4;

/// Écran de création d'une publication, adapté au TYPE choisi dans la
/// bottom sheet :
/// - titre optionnel (tous les types), texte 1..2000 multiligne ;
/// - jusqu'à 4 images (galerie via image_picker), uploadées IMMÉDIATEMENT
///   sur POST /media/upload avec indicateur, vignettes supprimables ;
/// - types `requiresLocationForMap` : carte « Publier sur la carte » avec
///   sélecteur de commune (le centre-ville sert de position — la position
///   GPS réelle arrive avec la carte, TODO étapes 5/7) ; les autres types
///   ne proposent PAS de localisation.
///
/// Publier sans localisation un type carte reste LÉGAL : le post est
/// simplement « feed-only » (mapExpiresAt null, règle côté API).
class CreatePostScreen extends ConsumerStatefulWidget {
  const CreatePostScreen({super.key, required this.typeSlug});

  final String typeSlug;

  @override
  ConsumerState<CreatePostScreen> createState() => _CreatePostScreenState();
}

/// Image en cours d'ajout : fichier local choisi, résultat d'upload quand
/// il est arrivé, drapeau d'échec (avec relance possible).
class _MediaEnCours {
  _MediaEnCours(this.fichier);

  final XFile fichier;
  PostMedia? resultat;
  bool echec = false;

  bool get enEnvoi => resultat == null && !echec;
}

class _CreatePostScreenState extends ConsumerState<CreatePostScreen> {
  final TextEditingController _titreController = TextEditingController();
  final TextEditingController _texteController = TextEditingController();
  final ImagePicker _selecteur = ImagePicker();

  final List<_MediaEnCours> _medias = [];
  bool _publierSurCarte = true;
  Commune? _commune;
  bool _publication = false;

  @override
  void dispose() {
    _titreController.dispose();
    _texteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<List<PostType>> types = ref.watch(postTypesProvider);

    return switch (types) {
      AsyncData(:final value) => _construire(context, _trouverType(value)),
      AsyncError() => _ErreurPleinEcran(
          message: 'Impossible de charger les types de publication.',
          surReessayer: () => ref.invalidate(postTypesProvider),
        ),
      _ => const Scaffold(body: Center(child: CircularProgressIndicator())),
    };
  }

  PostType? _trouverType(List<PostType> types) {
    for (final PostType type in types) {
      if (type.slug == widget.typeSlug) {
        return type;
      }
    }
    return null;
  }

  Widget _construire(BuildContext context, PostType? type) {
    if (type == null) {
      return _ErreurPleinEcran(
        message: 'Type de publication introuvable.',
        surReessayer: () => context.pop(),
        libelleBouton: 'Retour',
      );
    }

    final bool uploadsEnCours = _medias.any((m) => m.enEnvoi);
    final bool peutPublier = !_publication &&
        !uploadsEnCours &&
        _texteController.text.trim().isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            PastilleType(
              nomIcone: type.icon,
              couleurHex: type.color,
              taille: 28,
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(type.labelFr, overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      ),
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
                hintText: 'Que se passe-t-il ?',
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
            if (type.requiresLocationForMap) ...[
              const SizedBox(height: 16),
              _SectionLocalisation(
                type: type,
                actif: _publierSurCarte,
                commune: _commune,
                surBascule: (valeur) =>
                    setState(() => _publierSurCarte = valeur),
                surCommune: (valeur) => setState(() => _commune = valeur),
              ),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: peutPublier ? () => _publier(type) : null,
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
  // Images
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
      // Sélecteur natif indisponible (permission refusée…) : rien à faire.
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
    // Upload IMMÉDIAT de chaque image (l'utilisateur voit l'indicateur sur
    // chaque vignette et peut continuer à rédiger pendant l'envoi).
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

  Future<void> _publier(PostType type) async {
    FocusScope.of(context).unfocus();
    final String texte = _texteController.text.trim();
    final String titre = _titreController.text.trim();

    final bool avecCarte = type.requiresLocationForMap && _publierSurCarte;
    if (avecCarte && _commune == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Choisissez une commune pour publier sur la carte, ou '
            'désactivez « Publier sur la carte ».',
          ),
        ),
      );
      return;
    }

    // Les images en échec d'upload sont ignorées (vignettes marquées, à
    // relancer ou retirer avant de publier si l'utilisateur y tient).
    final List<PostMedia> medias = [
      for (final (int index, _MediaEnCours media) in _medias
          .where((m) => m.resultat != null)
          .toList()
          .indexed)
        media.resultat!.avecPosition(index),
    ];

    setState(() => _publication = true);
    try {
      await ref.read(postsRepositoryProvider).creerPost(
            typeSlug: type.slug,
            title: titre.isEmpty ? null : titre,
            body: texte,
            location: avecCarte && _commune != null
                ? GeoPoint(lat: _commune!.lat, lng: _commune!.lng)
                : null,
            city: avecCarte ? _commune?.name : null,
            media: medias,
          );
      // Le nouveau post doit apparaître : rafraîchit le fil (sans attendre,
      // le fil affiche son propre indicateur) puis revient à l'accueil.
      ref.read(feedProvider.notifier).rafraichir();
      if (mounted) {
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

// ─────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────

/// Rangée des vignettes d'images + bouton d'ajout (≤ 4, upload immédiat).
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
                _VignetteMedia(
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

/// Vignette 88×88 d'une image : aperçu local pendant l'envoi (voile +
/// indicateur), aperçu serveur une fois uploadée, état d'échec relançable.
/// Toujours supprimable (croix).
class _VignetteMedia extends StatelessWidget {
  const _VignetteMedia({
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
                  tooltip: "Relancer l'envoi",
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

/// Carte « Publier sur la carte » des types à localisation : bascule +
/// sélecteur de commune (GET /map/communes). La position publiée est le
/// centre-ville de la commune — TODO(étapes 5/7) : position GPS réelle de
/// l'appareil (geolocator) et carte interactive.
class _SectionLocalisation extends ConsumerWidget {
  const _SectionLocalisation({
    required this.type,
    required this.actif,
    required this.commune,
    required this.surBascule,
    required this.surCommune,
  });

  final PostType type;
  final bool actif;
  final Commune? commune;
  final ValueChanged<bool> surBascule;
  final ValueChanged<Commune?> surCommune;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: BoxDecoration(
        color: EndirekColors.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'Publier sur la carte',
              style: TextStyle(
                color: EndirekColors.encre,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            subtitle: const Text(
              'Une localisation est nécessaire pour apparaître sur la carte.',
              style: TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 12.5,
              ),
            ),
            value: actif,
            onChanged: surBascule,
          ),
          if (actif) ...[
            _SelecteurCommune(commune: commune, surCommune: surCommune),
            const SizedBox(height: 8),
            const Text(
              'La position publiée est le centre-ville de la commune '
              'choisie. Position GPS précise : bientôt disponible.',
              style: TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ] else
            const Text(
              'Sans localisation, votre publication apparaîtra uniquement '
              'dans le fil.',
              style: TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 12,
                height: 1.35,
              ),
            ),
        ],
      ),
    );
  }
}

class _SelecteurCommune extends ConsumerWidget {
  const _SelecteurCommune({required this.commune, required this.surCommune});

  final Commune? commune;
  final ValueChanged<Commune?> surCommune;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Commune>> communes = ref.watch(communesProvider);
    return switch (communes) {
      AsyncData(:final value) => DropdownButtonFormField<Commune>(
          initialValue: commune,
          isExpanded: true,
          hint: const Text('Choisissez une commune'),
          items: [
            for (final Commune element in value)
              DropdownMenuItem(value: element, child: Text(element.name)),
          ],
          onChanged: surCommune,
          decoration: const InputDecoration(
            fillColor: Colors.white,
            contentPadding:
                EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      AsyncError() => Row(
          children: [
            const Expanded(
              child: Text(
                'Communes indisponibles.',
                style: TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 13,
                ),
              ),
            ),
            TextButton(
              onPressed: () => ref.invalidate(communesProvider),
              child: const Text('Réessayer'),
            ),
          ],
        ),
      _ => const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: LinearProgressIndicator(minHeight: 2),
        ),
    };
  }
}

/// Écran d'erreur plein écran du composer (types indisponibles…).
class _ErreurPleinEcran extends StatelessWidget {
  const _ErreurPleinEcran({
    required this.message,
    required this.surReessayer,
    this.libelleBouton = 'Réessayer',
  });

  final String message;
  final VoidCallback surReessayer;
  final String libelleBouton;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvelle publication')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: surReessayer,
                child: Text(libelleBouton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

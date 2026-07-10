import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/commune.dart';
import '../../../core/api/models/post_media.dart';
import '../../../core/config/api_config.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../feed/application/referentiels_providers.dart';
import '../../post_composer/data/media_repository.dart';
import '../application/listings_list_controller.dart';
import '../application/taxonomy_provider.dart';
import '../data/dealplace_repository.dart';
import '../domain/create_listing_input.dart';
import '../domain/dealplace_taxonomy.dart';
import '../domain/listing.dart';

/// Nombre maximal de médias par annonce (aligné sur le contrat API).
const int _maxImages = 8;

/// Nombre maximal de liens externes.
const int _maxLiens = 5;

/// Préférences d'échange proposées (miroir du contrat).
const List<({String slug, String libelle})> _prefsEchange = [
  (slug: 'money', libelle: 'Contre de l\'argent'),
  (slug: 'goods', libelle: 'Contre un bien'),
  (slug: 'services', libelle: 'Contre un service'),
  (slug: 'open', libelle: 'Ouvert aux propositions'),
];

/// Écran de CRÉATION d'une annonce Dealplace (/dealplace/create).
///
/// Formulaire complet : type (bien/service), titre, description, catégorie +
/// sous-catégorie (pickers depuis la taxonomie, filtrés par le type), valeur
/// fixe ou fourchette, commune (référentiel), préférences d'échange
/// (multi-select non vide), liens externes, photos (upload immédiat via
/// image_picker + /media/upload). PHOTO OBLIGATOIRE pour un bien (message
/// clair). Le service revérifie toutes les règles.
class CreateListingScreen extends ConsumerStatefulWidget {
  const CreateListingScreen({super.key});

  @override
  ConsumerState<CreateListingScreen> createState() =>
      _CreateListingScreenState();
}

/// Image en cours d'ajout : fichier local, résultat d'upload, échec relançable.
class _MediaEnCours {
  _MediaEnCours(this.fichier);

  final XFile fichier;
  PostMedia? resultat;
  bool echec = false;

  bool get enEnvoi => resultat == null && !echec;
}

/// Un lien externe en cours de saisie (contrôleurs libellé + url).
class _LienEnCours {
  _LienEnCours();

  final TextEditingController label = TextEditingController();
  final TextEditingController url = TextEditingController();

  void dispose() {
    label.dispose();
    url.dispose();
  }
}

class _CreateListingScreenState extends ConsumerState<CreateListingScreen> {
  final TextEditingController _titreController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  final TextEditingController _valeurMinController = TextEditingController();
  final TextEditingController _valeurMaxController = TextEditingController();
  final ImagePicker _selecteur = ImagePicker();

  String _family = 'service';
  String? _categorySlug;
  String? _subcategorySlug;
  String _valueKind = 'fixed';
  Commune? _commune;
  final Set<String> _exchangePrefs = {'money'};
  final List<_MediaEnCours> _medias = [];
  final List<_LienEnCours> _liens = [];
  bool _publication = false;

  @override
  void dispose() {
    _titreController.dispose();
    _descriptionController.dispose();
    _valeurMinController.dispose();
    _valeurMaxController.dispose();
    for (final lien in _liens) {
      lien.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<DealplaceTaxonomy> taxonomie =
        ref.watch(taxonomyProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Déposer une annonce')),
      body: SafeArea(
        child: switch (taxonomie) {
          AsyncData(:final value) => _formulaire(value),
          AsyncError() => _ErreurPleinEcran(
              message: 'Impossible de charger la taxonomie Dealplace.',
              surReessayer: () => ref.invalidate(taxonomyProvider),
            ),
          _ => const Center(child: CircularProgressIndicator()),
        },
      ),
    );
  }

  Widget _formulaire(DealplaceTaxonomy taxonomie) {
    final List<ListingCategory> categories =
        taxonomie.categoriesDeFamille(_family);
    final ListingCategory? categorie = _categorySlug == null
        ? null
        : categories.where((c) => c.slug == _categorySlug).firstOrNull;
    final bool uploadsEnCours = _medias.any((m) => m.enEnvoi);
    final bool estBien = _family == 'good';

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        _Label('Type d\'annonce'),
        Row(
          children: [
            Expanded(
              child: _BoutonType(
                actif: _family == 'service',
                icone: Icons.handshake_outlined,
                libelle: 'Service',
                surTap: () => setState(() => _choisirFamille('service')),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _BoutonType(
                actif: estBien,
                icone: Icons.inventory_2_outlined,
                libelle: 'Bien',
                surTap: () => setState(() => _choisirFamille('good')),
              ),
            ),
          ],
        ),
        if (estBien)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text(
              'Une photo au moins est obligatoire pour un bien.',
              style: TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 12.5,
              ),
            ),
          ),
        const SizedBox(height: 20),

        _Label('Titre'),
        TextField(
          controller: _titreController,
          maxLength: 120,
          textInputAction: TextInputAction.next,
          decoration: const InputDecoration(
            hintText: 'Ex : Faire un site internet vitrine',
            counterText: '',
          ),
        ),
        const SizedBox(height: 16),

        _Label('Description'),
        TextField(
          controller: _descriptionController,
          maxLength: 4000,
          minLines: 4,
          maxLines: 10,
          decoration: const InputDecoration(
            hintText: 'Décrivez votre bien ou service…',
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 8),

        _Label('Catégorie'),
        DropdownButtonFormField<String>(
          initialValue: _categorySlug,
          isExpanded: true,
          hint: const Text('Choisissez une catégorie'),
          items: [
            for (final c in categories)
              DropdownMenuItem(value: c.slug, child: Text(c.labelFr)),
          ],
          onChanged: (valeur) => setState(() {
            _categorySlug = valeur;
            _subcategorySlug = null;
          }),
        ),
        if (categorie != null && categorie.subcategories.isNotEmpty) ...[
          const SizedBox(height: 16),
          _Label('Sous-catégorie'),
          DropdownButtonFormField<String>(
            initialValue: _subcategorySlug,
            isExpanded: true,
            hint: const Text('Choisissez une sous-catégorie'),
            items: [
              for (final s in categorie.subcategories)
                DropdownMenuItem(value: s.slug, child: Text(s.labelFr)),
            ],
            onChanged: (valeur) => setState(() => _subcategorySlug = valeur),
          ),
        ],
        const SizedBox(height: 20),

        _Label('Valeur'),
        _SelecteurNatureValeur(
          valueKind: _valueKind,
          surChangement: (valeur) => setState(() => _valueKind = valeur),
        ),
        const SizedBox(height: 12),
        _ChampsValeur(
          valueKind: _valueKind,
          minController: _valeurMinController,
          maxController: _valeurMaxController,
        ),
        const SizedBox(height: 20),

        _Label('Commune'),
        _SelecteurCommune(
          commune: _commune,
          surCommune: (valeur) => setState(() => _commune = valeur),
        ),
        const SizedBox(height: 20),

        _Label('Préférences d\'échange'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final pref in _prefsEchange)
              FilterChip(
                label: Text(pref.libelle),
                selected: _exchangePrefs.contains(pref.slug),
                showCheckmark: true,
                selectedColor: const Color(0xFFE0EDFA),
                backgroundColor: EndirekColors.surface,
                side: BorderSide(
                  color: _exchangePrefs.contains(pref.slug)
                      ? EndirekColors.bleu
                      : EndirekColors.bordure,
                ),
                onSelected: (choisi) => setState(() {
                  if (choisi) {
                    _exchangePrefs.add(pref.slug);
                  } else {
                    _exchangePrefs.remove(pref.slug);
                  }
                }),
              ),
          ],
        ),
        const SizedBox(height: 20),

        _SectionMedias(
          medias: _medias,
          surAjouter: _ajouterImages,
          surRetirer: (media) => setState(() => _medias.remove(media)),
          surReessayer: _relancerUpload,
        ),
        const SizedBox(height: 20),

        _SectionLiens(
          liens: _liens,
          surAjouter: _liens.length < _maxLiens
              ? () => setState(() => _liens.add(_LienEnCours()))
              : null,
          surRetirer: (lien) => setState(() {
            _liens.remove(lien);
            lien.dispose();
          }),
        ),
        const SizedBox(height: 28),

        FilledButton(
          onPressed:
              (_publication || uploadsEnCours) ? null : () => _publier(),
          child: _publication
              ? const SizedBox(
                  height: 22,
                  width: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white,
                  ),
                )
              : const Text('Publier l\'annonce'),
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
    );
  }

  void _choisirFamille(String famille) {
    if (_family == famille) {
      return;
    }
    _family = famille;
    // La catégorie/sous-catégorie doit rester cohérente avec la famille.
    _categorySlug = null;
    _subcategorySlug = null;
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
    final String titre = _titreController.text.trim();
    final String description = _descriptionController.text.trim();
    final bool estBien = _family == 'good';

    // Validations côté client (le service revérifie tout, mais on épargne un
    // aller-retour et on donne un message clair immédiat).
    final String? erreur = _valider(
      titre: titre,
      description: description,
      estBien: estBien,
    );
    if (erreur != null) {
      _snack(erreur);
      return;
    }

    final int valeurMin = int.parse(_valeurMinController.text.trim());
    final int? valeurMax = _valueKind == 'range'
        ? int.tryParse(_valeurMaxController.text.trim())
        : null;

    // Médias uploadés uniquement, position = ordre d'ajout.
    final List<PostMedia> medias = [
      for (final (int index, _MediaEnCours media)
          in _medias.where((m) => m.resultat != null).toList().indexed)
        media.resultat!.avecPosition(index),
    ];

    // Liens complets uniquement (libellé + url renseignés).
    final List<ListingExternalLink> liens = [
      for (final lien in _liens)
        if (lien.label.text.trim().isNotEmpty && lien.url.text.trim().isNotEmpty)
          ListingExternalLink(
            label: lien.label.text.trim(),
            url: lien.url.text.trim(),
          ),
    ];

    final CreateListingInput input = CreateListingInput(
      listingType: _family,
      title: titre,
      description: description,
      categorySlug: _categorySlug!,
      subcategorySlug: _subcategorySlug!,
      valueKind: _valueKind,
      valueMin: valeurMin,
      valueMax: valeurMax,
      city: _commune!.name,
      exchangePrefs: _exchangePrefs.toList(),
      externalLinks: liens,
      media: medias,
      tags: const [],
    );

    setState(() => _publication = true);
    try {
      await ref.read(dealplaceRepositoryProvider).creerAnnonce(input);
      // La nouvelle annonce doit apparaître dans l'annuaire.
      ref.read(listingsListProvider.notifier).rafraichir();
      if (mounted) {
        context.pop(true);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _publication = false);
        _snack(e.message);
      }
    }
  }

  /// Validation client — renvoie le premier message d'erreur, ou null si OK.
  String? _valider({
    required String titre,
    required String description,
    required bool estBien,
  }) {
    if (titre.isEmpty) {
      return 'Le titre est obligatoire.';
    }
    if (description.isEmpty) {
      return 'La description est obligatoire.';
    }
    if (_categorySlug == null) {
      return 'Choisissez une catégorie.';
    }
    if (_subcategorySlug == null) {
      return 'Choisissez une sous-catégorie.';
    }
    final int? min = int.tryParse(_valeurMinController.text.trim());
    if (min == null || min < 0) {
      return 'Indiquez une valeur valide (entier positif).';
    }
    if (_valueKind == 'range') {
      final int? max = int.tryParse(_valeurMaxController.text.trim());
      if (max == null || max < min) {
        return 'La borne haute doit être supérieure ou égale à la borne basse.';
      }
    }
    if (_commune == null) {
      return 'Choisissez une commune.';
    }
    if (_exchangePrefs.isEmpty) {
      return 'Sélectionnez au moins une préférence d\'échange.';
    }
    if (estBien && _medias.where((m) => m.resultat != null).isEmpty) {
      return 'Une photo au moins est obligatoire pour un bien.';
    }
    return null;
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Sous-widgets
// ─────────────────────────────────────────────────────────────────────────

/// Libellé de champ (titre de section du formulaire).
class _Label extends StatelessWidget {
  const _Label(this.texte);

  final String texte;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        texte,
        style: const TextStyle(
          color: EndirekColors.encre,
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Bouton de sélection du type (bien / service).
class _BoutonType extends StatelessWidget {
  const _BoutonType({
    required this.actif,
    required this.icone,
    required this.libelle,
    required this.surTap,
  });

  final bool actif;
  final IconData icone;
  final String libelle;
  final VoidCallback surTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: surTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: actif ? const Color(0xFFE0EDFA) : EndirekColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: actif ? EndirekColors.bleu : EndirekColors.bordure,
            width: actif ? 1.5 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icone,
              color: actif ? EndirekColors.bleu : EndirekColors.encreSecondaire,
            ),
            const SizedBox(height: 6),
            Text(
              libelle,
              style: TextStyle(
                color: actif ? EndirekColors.bleu : EndirekColors.encre,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Choix « Valeur fixe » / « Fourchette » (segmented).
class _SelecteurNatureValeur extends StatelessWidget {
  const _SelecteurNatureValeur({
    required this.valueKind,
    required this.surChangement,
  });

  final String valueKind;
  final ValueChanged<String> surChangement;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<String>(
      segments: const [
        ButtonSegment(value: 'fixed', label: Text('Valeur fixe')),
        ButtonSegment(value: 'range', label: Text('Fourchette')),
      ],
      selected: {valueKind},
      showSelectedIcon: false,
      onSelectionChanged: (selection) => surChangement(selection.first),
    );
  }
}

/// Champs de valeur : un champ « fixed » ou deux (min/max) en « range ».
class _ChampsValeur extends StatelessWidget {
  const _ChampsValeur({
    required this.valueKind,
    required this.minController,
    required this.maxController,
  });

  final String valueKind;
  final TextEditingController minController;
  final TextEditingController maxController;

  @override
  Widget build(BuildContext context) {
    if (valueKind == 'fixed') {
      return TextField(
        controller: minController,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(
          hintText: 'Valeur en euros',
          suffixText: '€',
        ),
      );
    }
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: minController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              hintText: 'Min',
              suffixText: '€',
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: TextField(
            controller: maxController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              hintText: 'Max',
              suffixText: '€',
            ),
          ),
        ),
      ],
    );
  }
}

/// Sélecteur de commune (référentiel GET /map/communes).
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

/// Section photos : vignettes (upload immédiat) + bouton d'ajout.
class _SectionMedias extends StatelessWidget {
  const _SectionMedias({
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
        _Label('Photos (${medias.length}/$_maxImages)'),
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

/// Vignette 88×88 d'une image (aperçu local pendant l'envoi, serveur ensuite,
/// état d'échec relançable, toujours supprimable).
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

/// Section liens externes : lignes { libellé, url } + bouton d'ajout.
class _SectionLiens extends StatelessWidget {
  const _SectionLiens({
    required this.liens,
    required this.surAjouter,
    required this.surRetirer,
  });

  final List<_LienEnCours> liens;
  final VoidCallback? surAjouter;
  final ValueChanged<_LienEnCours> surRetirer;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Label('Liens externes (${liens.length}/$_maxLiens)'),
        for (final lien in liens)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    children: [
                      TextField(
                        controller: lien.label,
                        maxLength: 80,
                        decoration: const InputDecoration(
                          hintText: 'Libellé',
                          counterText: '',
                          isDense: true,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: lien.url,
                        keyboardType: TextInputType.url,
                        decoration: const InputDecoration(
                          hintText: 'https://…',
                          isDense: true,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Retirer',
                  onPressed: () => surRetirer(lien),
                  icon: const Icon(
                    Icons.remove_circle_outline,
                    color: EndirekColors.encreSecondaire,
                  ),
                ),
              ],
            ),
          ),
        if (surAjouter != null)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: surAjouter,
              icon: const Icon(Icons.add),
              label: const Text('Ajouter un lien'),
            ),
          ),
      ],
    );
  }
}

/// Écran d'erreur plein écran (taxonomie indisponible).
class _ErreurPleinEcran extends StatelessWidget {
  const _ErreurPleinEcran({
    required this.message,
    required this.surReessayer,
  });

  final String message;
  final VoidCallback surReessayer;

  @override
  Widget build(BuildContext context) {
    return Center(
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
              child: const Text('Réessayer'),
            ),
          ],
        ),
      ),
    );
  }
}

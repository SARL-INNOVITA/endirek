import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/api/models/post_media.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../../post_composer/data/media_repository.dart';
import '../../application/pages_providers.dart';
import '../../data/pages_repository.dart';
import '../../domain/formatage_pages.dart';
import '../../domain/page_models.dart';

/// GESTION DES PLATS d'un restaurant (/pages/:id/gerer/plats) : liste des
/// plats actifs, création/édition en bottom sheet (nom, description, photo,
/// prix à emporter et sur place SAISIS EN EUROS puis convertis en
/// centimes), suppression avec confirmation (le plat est aussi retiré des
/// menus programmés).
class GererPlatsScreen extends ConsumerWidget {
  const GererPlatsScreen({super.key, required this.pageId});

  final String pageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Dish>> etat = ref.watch(platsDePageProvider(pageId));

    return Scaffold(
      appBar: AppBar(title: const Text('Plats')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _ouvrirFormulaire(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Ajouter un plat'),
      ),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(platsDePageProvider(pageId)),
          child: switch (etat) {
            AsyncData(:final value) => _liste(context, ref, value),
            AsyncError() => _EtatMessage(
                icone: Icons.wifi_off_outlined,
                message: 'Impossible de charger les plats.',
                actionLibelle: 'Réessayer',
                surAction: () => ref.invalidate(platsDePageProvider(pageId)),
              ),
            _ => const Center(child: CircularProgressIndicator()),
          },
        ),
      ),
    );
  }

  Widget _liste(BuildContext context, WidgetRef ref, List<Dish> plats) {
    if (plats.isEmpty) {
      return const _EtatMessage(
        icone: Icons.restaurant_outlined,
        message: 'Aucun plat pour le moment.\nAjoutez vos plats pour '
            'composer vos menus de la semaine !',
      );
    }
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        for (final Dish plat in plats)
          _TuilePlat(
            plat: plat,
            surModifier: () => _ouvrirFormulaire(context, ref, plat: plat),
            surSupprimer: () => _confirmerSuppression(context, ref, plat),
          ),
      ],
    );
  }

  /// Bottom sheet de création/édition — invalide la liste au succès.
  Future<void> _ouvrirFormulaire(
    BuildContext context,
    WidgetRef ref, {
    Dish? plat,
  }) async {
    final bool? enregistre = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (contexteFeuille) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(contexteFeuille).viewInsets.bottom,
        ),
        child: _FormulairePlat(pageId: pageId, plat: plat),
      ),
    );
    if (enregistre == true) {
      ref.invalidate(platsDePageProvider(pageId));
      ref.invalidate(menusDePageProvider(pageId));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(plat == null ? 'Plat ajouté' : 'Plat modifié')),
        );
      }
    }
  }

  Future<void> _confirmerSuppression(
    BuildContext context,
    WidgetRef ref,
    Dish plat,
  ) async {
    final bool? confirme = await showDialog<bool>(
      context: context,
      builder: (contexteDialogue) => AlertDialog(
        title: Text('Supprimer « ${plat.name} » ?'),
        content: const Text(
          'Le plat sera aussi retiré des menus de la semaine où il figure.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contexteDialogue).pop(false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.of(contexteDialogue).pop(true),
            child: const Text(
              'Supprimer',
              style: TextStyle(color: Color(0xFFB3261E)),
            ),
          ),
        ],
      ),
    );
    if (confirme != true || !context.mounted) {
      return;
    }
    try {
      await ref.read(pagesRepositoryProvider).supprimerPlat(pageId, plat.id);
      ref.invalidate(platsDePageProvider(pageId));
      ref.invalidate(menusDePageProvider(pageId));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Plat supprimé')),
        );
      }
    } on ApiException catch (erreur) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erreur.message)));
      }
    }
  }
}

/// Tuile d'un plat : vignette, nom, prix, actions modifier/supprimer.
class _TuilePlat extends StatelessWidget {
  const _TuilePlat({
    required this.plat,
    required this.surModifier,
    required this.surSupprimer,
  });

  final Dish plat;
  final VoidCallback surModifier;
  final VoidCallback surSupprimer;

  @override
  Widget build(BuildContext context) {
    final String? lignePrix = formaterLignePrixPlat(
      aEmporterCents: plat.priceTakeawayCents,
      surPlaceCents: plat.priceDineInCents,
    );
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                width: 56,
                height: 56,
                child: (plat.imageUrl != null && plat.imageUrl!.isNotEmpty)
                    ? Image.network(
                        ApiConfig.resolveMediaUrl(plat.imageUrl!),
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const _PictoPlat(),
                      )
                    : const _PictoPlat(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    plat.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (lignePrix != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      lignePrix,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 12.5,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            IconButton(
              tooltip: 'Modifier',
              onPressed: surModifier,
              icon: const Icon(
                Icons.edit_outlined,
                size: 20,
                color: EndirekColors.encreSecondaire,
              ),
            ),
            IconButton(
              tooltip: 'Supprimer',
              onPressed: surSupprimer,
              icon: const Icon(
                Icons.delete_outline,
                size: 20,
                color: Color(0xFFB3261E),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PictoPlat extends StatelessWidget {
  const _PictoPlat();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: EndirekColors.surface,
      child: Icon(
        Icons.restaurant_outlined,
        color: EndirekColors.encreSecondaire,
      ),
    );
  }
}

/// Formulaire de plat (bottom sheet) : nom requis, description, photo
/// (upload immédiat), prix en euros (au moins un des deux) — pop(true) au
/// succès.
class _FormulairePlat extends ConsumerStatefulWidget {
  const _FormulairePlat({required this.pageId, this.plat});

  final String pageId;

  /// Plat à modifier — null en création.
  final Dish? plat;

  @override
  ConsumerState<_FormulairePlat> createState() => _FormulairePlatState();
}

class _FormulairePlatState extends ConsumerState<_FormulairePlat> {
  late final TextEditingController _nomController =
      TextEditingController(text: widget.plat?.name ?? '');
  late final TextEditingController _descriptionController =
      TextEditingController(text: widget.plat?.description ?? '');
  late final TextEditingController _prixEmporterController =
      TextEditingController(
    text: widget.plat?.priceTakeawayCents == null
        ? ''
        : saisieDepuisCentimes(widget.plat!.priceTakeawayCents!),
  );
  late final TextEditingController _prixSurPlaceController =
      TextEditingController(
    text: widget.plat?.priceDineInCents == null
        ? ''
        : saisieDepuisCentimes(widget.plat!.priceDineInCents!),
  );
  final ImagePicker _selecteur = ImagePicker();

  late String? _imageUrl = widget.plat?.imageUrl;
  bool _envoiImage = false;
  bool _enregistrement = false;

  @override
  void dispose() {
    _nomController.dispose();
    _descriptionController.dispose();
    _prixEmporterController.dispose();
    _prixSurPlaceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.plat == null ? 'Ajouter un plat' : 'Modifier le plat',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EndirekColors.encre,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _nomController,
              maxLength: 120,
              decoration: const InputDecoration(
                labelText: 'Nom du plat',
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descriptionController,
              maxLength: 300,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Description (optionnel)',
                counterText: '',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _prixEmporterController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'À emporter',
                      hintText: '7,50',
                      suffixText: '€',
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _prixSurPlaceController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Sur place',
                      hintText: '12,00',
                      suffixText: '€',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Renseignez au moins un des deux prix.',
              style: TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: SizedBox(
                    width: 56,
                    height: 56,
                    child: _envoiImage
                        ? const ColoredBox(
                            color: EndirekColors.surface,
                            child: Center(
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2.5),
                              ),
                            ),
                          )
                        : (_imageUrl != null && _imageUrl!.isNotEmpty)
                            ? Image.network(
                                ApiConfig.resolveMediaUrl(_imageUrl!),
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => const _PictoPlat(),
                              )
                            : const _PictoPlat(),
                  ),
                ),
                const SizedBox(width: 10),
                TextButton.icon(
                  onPressed: _envoiImage ? null : _choisirImage,
                  icon:
                      const Icon(Icons.add_photo_alternate_outlined, size: 18),
                  label: Text(_imageUrl == null ? 'Photo' : 'Remplacer'),
                ),
                if (_imageUrl != null)
                  TextButton(
                    onPressed: _envoiImage
                        ? null
                        : () => setState(() => _imageUrl = null),
                    child: const Text(
                      'Retirer',
                      style: TextStyle(color: Color(0xFFB3261E)),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed:
                  (_enregistrement || _envoiImage) ? null : _enregistrer,
              child: _enregistrement
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : Text(widget.plat == null ? 'Ajouter' : 'Enregistrer'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _choisirImage() async {
    final XFile? fichier;
    try {
      fichier = await _selecteur.pickImage(source: ImageSource.gallery);
    } catch (_) {
      return;
    }
    if (fichier == null || !mounted) {
      return;
    }
    setState(() => _envoiImage = true);
    try {
      final PostMedia resultat =
          await ref.read(mediaRepositoryProvider).uploaderImage(fichier);
      if (mounted) {
        setState(() => _imageUrl = resultat.url);
      }
    } on ApiException catch (erreur) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erreur.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _envoiImage = false);
      }
    }
  }

  Future<void> _enregistrer() async {
    FocusScope.of(context).unfocus();
    final String nom = _nomController.text.trim();
    if (nom.isEmpty) {
      _snack('Le nom du plat est obligatoire.');
      return;
    }
    final String saisieEmporter = _prixEmporterController.text.trim();
    final String saisieSurPlace = _prixSurPlaceController.text.trim();
    final int? prixEmporter =
        saisieEmporter.isEmpty ? null : centimesDepuisSaisie(saisieEmporter);
    final int? prixSurPlace =
        saisieSurPlace.isEmpty ? null : centimesDepuisSaisie(saisieSurPlace);
    if (saisieEmporter.isNotEmpty && prixEmporter == null) {
      _snack('Prix « à emporter » invalide (ex : 7,50).');
      return;
    }
    if (saisieSurPlace.isNotEmpty && prixSurPlace == null) {
      _snack('Prix « sur place » invalide (ex : 12,00).');
      return;
    }
    if (prixEmporter == null && prixSurPlace == null) {
      _snack('Renseignez au moins un des deux prix.');
      return;
    }
    final String description = _descriptionController.text.trim();

    setState(() => _enregistrement = true);
    try {
      final PagesRepository repo = ref.read(pagesRepositoryProvider);
      if (widget.plat == null) {
        await repo.creerPlat(
          widget.pageId,
          name: nom,
          description: description.isEmpty ? null : description,
          imageUrl: _imageUrl,
          priceTakeawayCents: prixEmporter,
          priceDineInCents: prixSurPlace,
        );
      } else {
        // PATCH complet du formulaire : les prix/image effacés partent en
        // null explicite (le contrat les accepte nullables pour effacer).
        await repo.modifierPlat(
          widget.pageId,
          widget.plat!.id,
          name: nom,
          description: description,
          imageUrl: _imageUrl,
          priceTakeawayCents: prixEmporter,
          priceDineInCents: prixSurPlace,
        );
      }
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (erreur) {
      if (mounted) {
        setState(() => _enregistrement = false);
        _snack(erreur.message);
      }
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}

/// État centré (vide / erreur) compatible tirer-pour-rafraîchir.
class _EtatMessage extends StatelessWidget {
  const _EtatMessage({
    required this.icone,
    required this.message,
    this.actionLibelle,
    this.surAction,
  });

  final IconData icone;
  final String message;
  final String? actionLibelle;
  final VoidCallback? surAction;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(32, 96, 32, 0),
          child: Column(
            children: [
              Icon(icone, size: 44, color: EndirekColors.encreSecondaire),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 14,
                  height: 1.45,
                ),
              ),
              if (actionLibelle != null)
                TextButton.icon(
                  onPressed: surAction,
                  icon: const Icon(Icons.refresh),
                  label: Text(actionLibelle!),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

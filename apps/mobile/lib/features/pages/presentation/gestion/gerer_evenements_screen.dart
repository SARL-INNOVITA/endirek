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

/// GESTION DES ÉVÉNEMENTS d'une page (/pages/:id/gerer/evenements) : liste
/// de TOUS les événements actifs (passés compris — all=true), création/
/// édition en bottom sheet (titre, DÉBUT OBLIGATOIRE date + heure, fin
/// optionnelle, description, image), suppression douce avec confirmation.
class GererEvenementsScreen extends ConsumerWidget {
  const GererEvenementsScreen({super.key, required this.pageId});

  final String pageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<PageEvent>> etat =
        ref.watch(evenementsGestionProvider(pageId));

    return Scaffold(
      appBar: AppBar(title: const Text('Événements')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _ouvrirFormulaire(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Créer un événement'),
      ),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(evenementsGestionProvider(pageId)),
          child: switch (etat) {
            AsyncData(:final value) => _liste(context, ref, value),
            AsyncError() => _EtatMessage(
                icone: Icons.wifi_off_outlined,
                message: 'Impossible de charger les événements.',
                actionLibelle: 'Réessayer',
                surAction: () =>
                    ref.invalidate(evenementsGestionProvider(pageId)),
              ),
            _ => const Center(child: CircularProgressIndicator()),
          },
        ),
      ),
    );
  }

  Widget _liste(
    BuildContext context,
    WidgetRef ref,
    List<PageEvent> evenements,
  ) {
    if (evenements.isEmpty) {
      return const _EtatMessage(
        icone: Icons.event_outlined,
        message: 'Aucun événement pour le moment.\nAnnoncez vos soirées, '
            'concerts et animations : ils apparaîtront sur votre page et '
            'sur la carte !',
      );
    }
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        for (final PageEvent evenement in evenements)
          _TuileEvenement(
            evenement: evenement,
            surModifier: () =>
                _ouvrirFormulaire(context, ref, evenement: evenement),
            surSupprimer: () =>
                _confirmerSuppression(context, ref, evenement),
          ),
      ],
    );
  }

  /// Bottom sheet de création/édition. L'invalidation des listes est
  /// portée par un callback exécuté PAR LE FORMULAIRE au succès de la
  /// requête : si la sheet est rejetée pendant l'enregistrement (barrière,
  /// glissement), la mutation aboutie rafraîchit quand même les vues.
  Future<void> _ouvrirFormulaire(
    BuildContext context,
    WidgetRef ref, {
    PageEvent? evenement,
  }) async {
    final bool? enregistre = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (contexteFeuille) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(contexteFeuille).viewInsets.bottom,
        ),
        child: _FormulaireEvenement(
          pageId: pageId,
          evenement: evenement,
          surSucces: () {
            // Le ref de l'ÉCRAN survit à la sheet ; s'il est lui-même
            // démonté, les providers autoDispose rechargeront d'eux-mêmes.
            if (!context.mounted) {
              return;
            }
            ref.invalidate(evenementsGestionProvider(pageId));
            ref.invalidate(evenementsDePageProvider(pageId));
          },
        ),
      ),
    );
    if (enregistre == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            evenement == null ? 'Événement créé' : 'Événement modifié',
          ),
        ),
      );
    }
  }

  Future<void> _confirmerSuppression(
    BuildContext context,
    WidgetRef ref,
    PageEvent evenement,
  ) async {
    final bool? confirme = await showDialog<bool>(
      context: context,
      builder: (contexteDialogue) => AlertDialog(
        title: Text('Supprimer « ${evenement.title} » ?'),
        content: const Text(
          'L\'événement ne sera plus annoncé sur votre page. Les '
          'publications déjà parues dans le fil restent inchangées.',
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
      await ref
          .read(pagesRepositoryProvider)
          .supprimerEvenement(pageId, evenement.id);
      // Écran quitté pendant la requête : ref inutilisable, les providers
      // autoDispose rechargeront au prochain montage.
      if (!context.mounted) {
        return;
      }
      ref.invalidate(evenementsGestionProvider(pageId));
      ref.invalidate(evenementsDePageProvider(pageId));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Événement supprimé')),
      );
    } on ApiException catch (erreur) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erreur.message)));
      }
    }
  }
}

/// Tuile d'un événement : date française + badge de timing, titre,
/// description, actions modifier/supprimer.
class _TuileEvenement extends StatelessWidget {
  const _TuileEvenement({
    required this.evenement,
    required this.surModifier,
    required this.surSupprimer,
  });

  final PageEvent evenement;
  final VoidCallback surModifier;
  final VoidCallback surSupprimer;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _Badge(
                        texte: formaterDateEvenement(evenement.startsAt),
                        couleur: const Color(0xFFDB2777),
                        fond: const Color(0xFFFCE7F3),
                      ),
                      switch (evenement.timing) {
                        'ongoing' => const _Badge(
                            texte: 'En cours',
                            couleur: Color(0xFF16A34A),
                            fond: Color(0xFFE7F6EC),
                          ),
                        'past' => const _Badge(
                            texte: 'Passé',
                            couleur: EndirekColors.encreSecondaire,
                            fond: EndirekColors.surface,
                          ),
                        _ => const _Badge(
                            texte: 'À venir',
                            couleur: EndirekColors.bleu,
                            fond: Color(0xFFE0EDFA),
                          ),
                      },
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    evenement.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (evenement.description.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      evenement.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 12.5,
                        height: 1.3,
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

/// Petit badge coloré arrondi (date, timing).
class _Badge extends StatelessWidget {
  const _Badge({
    required this.texte,
    required this.couleur,
    required this.fond,
  });

  final String texte;
  final Color couleur;
  final Color fond;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: fond,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        texte,
        style: TextStyle(
          color: couleur,
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Formulaire d'événement (bottom sheet) : titre requis, DÉBUT REQUIS
/// (date + heure), fin optionnelle (date + heure, effaçable), description,
/// image (upload immédiat). Au succès : [surSucces] (invalidations de
/// l'écran hôte, même si la sheet a été rejetée entre-temps) puis
/// pop(true).
class _FormulaireEvenement extends ConsumerStatefulWidget {
  const _FormulaireEvenement({
    required this.pageId,
    required this.surSucces,
    this.evenement,
  });

  final String pageId;

  /// Invalidations à exécuter dès que la mutation serveur a abouti.
  final VoidCallback surSucces;

  /// Événement à modifier — null en création.
  final PageEvent? evenement;

  @override
  ConsumerState<_FormulaireEvenement> createState() =>
      _FormulaireEvenementState();
}

class _FormulaireEvenementState extends ConsumerState<_FormulaireEvenement> {
  late final TextEditingController _titreController =
      TextEditingController(text: widget.evenement?.title ?? '');
  late final TextEditingController _descriptionController =
      TextEditingController(text: widget.evenement?.description ?? '');
  final ImagePicker _selecteur = ImagePicker();

  late String? _imageUrl = widget.evenement?.imageUrl;
  late DateTime? _debut = widget.evenement?.startsAt.toLocal();
  late DateTime? _fin = widget.evenement?.endsAt?.toLocal();
  bool _envoiImage = false;
  bool _enregistrement = false;

  @override
  void dispose() {
    _titreController.dispose();
    _descriptionController.dispose();
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
              widget.evenement == null
                  ? 'Créer un événement'
                  : 'Modifier l\'événement',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EndirekColors.encre,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _titreController,
              maxLength: 120,
              decoration: const InputDecoration(
                labelText: 'Titre de l\'événement',
                hintText: 'Soirée musique live',
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descriptionController,
              maxLength: 1000,
              minLines: 2,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Description (optionnel)',
                counterText: '',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 12),
            _LigneDateHeure(
              libelle: 'Début',
              valeur: _debut,
              surChoisir: () => _choisirDateHeure(debut: true),
              surEffacer: null,
            ),
            const SizedBox(height: 8),
            _LigneDateHeure(
              libelle: 'Fin',
              valeur: _fin,
              surChoisir: () => _choisirDateHeure(debut: false),
              surEffacer:
                  _fin == null ? null : () => setState(() => _fin = null),
            ),
            const SizedBox(height: 6),
            const Text(
              'Sans fin renseignée, l\'événement dure 6 heures.',
              style: TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 12),
            _LigneImage(
              imageUrl: _imageUrl,
              envoiEnCours: _envoiImage,
              surChoisir: _choisirImage,
              surRetirer: () => setState(() => _imageUrl = null),
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
                  : Text(widget.evenement == null ? 'Créer' : 'Enregistrer'),
            ),
          ],
        ),
      ),
    );
  }

  /// Sélecteur combiné date PUIS heure (l'heure d'un événement compte).
  Future<void> _choisirDateHeure({required bool debut}) async {
    final DateTime maintenant = DateTime.now();
    final DateTime? initiale = debut ? _debut : _fin;
    final DateTime premierJour = DateTime(maintenant.year - 1);
    final DateTime dernierJour = DateTime(maintenant.year + 2);
    // Borne la date initiale dans [firstDate, lastDate] : un événement
    // PASSÉ (la gestion liste tout) violerait sinon l'assertion de
    // showDatePicker.
    DateTime initialeBornee = initiale ?? maintenant;
    if (initialeBornee.isBefore(premierJour)) {
      initialeBornee = premierJour;
    } else if (initialeBornee.isAfter(dernierJour)) {
      initialeBornee = dernierJour;
    }
    final DateTime? date = await showDatePicker(
      context: context,
      initialDate: initialeBornee,
      firstDate: premierJour,
      lastDate: dernierJour,
    );
    if (date == null || !mounted) {
      return;
    }
    final TimeOfDay? heure = await showTimePicker(
      context: context,
      initialTime: initiale == null
          ? const TimeOfDay(hour: 19, minute: 0)
          : TimeOfDay.fromDateTime(initiale),
    );
    if (heure == null || !mounted) {
      return;
    }
    final DateTime valeur =
        DateTime(date.year, date.month, date.day, heure.hour, heure.minute);
    setState(() {
      if (debut) {
        _debut = valeur;
      } else {
        _fin = valeur;
      }
    });
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
        _snack(erreur.message);
      }
    } finally {
      if (mounted) {
        setState(() => _envoiImage = false);
      }
    }
  }

  Future<void> _enregistrer() async {
    FocusScope.of(context).unfocus();
    final String titre = _titreController.text.trim();
    if (titre.isEmpty) {
      _snack('Le titre de l\'événement est obligatoire.');
      return;
    }
    final DateTime? debut = _debut;
    if (debut == null) {
      _snack('La date de début est obligatoire.');
      return;
    }
    if (_fin != null && !_fin!.isAfter(debut)) {
      _snack('La fin de l\'événement doit être postérieure à son début.');
      return;
    }
    final String description = _descriptionController.text.trim();

    setState(() => _enregistrement = true);
    try {
      final PagesRepository repo = ref.read(pagesRepositoryProvider);
      if (widget.evenement == null) {
        await repo.creerEvenement(
          widget.pageId,
          title: titre,
          startsAt: debut,
          description: description.isEmpty ? null : description,
          imageUrl: _imageUrl,
          endsAt: _fin,
        );
      } else {
        // PATCH complet du formulaire : image/fin effacées partent en null
        // explicite ; le début, lui, est toujours renseigné (contrat).
        await repo.modifierEvenement(
          widget.pageId,
          widget.evenement!.id,
          title: titre,
          description: description,
          imageUrl: _imageUrl,
          startsAt: debut,
          endsAt: _fin,
        );
      }
      // Rafraîchit les vues de l'écran hôte AVANT le pop : le signal
      // survit ainsi à une sheet rejetée pendant la requête.
      widget.surSucces();
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

/// Ligne de choix d'une date + heure : libellé, valeur lisible (ou « — »),
/// boutons choisir/effacer.
class _LigneDateHeure extends StatelessWidget {
  const _LigneDateHeure({
    required this.libelle,
    required this.valeur,
    required this.surChoisir,
    required this.surEffacer,
  });

  final String libelle;
  final DateTime? valeur;
  final VoidCallback surChoisir;
  final VoidCallback? surEffacer;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: 52,
          child: Text(
            libelle,
            style: const TextStyle(
              color: EndirekColors.encre,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Expanded(
          child: Text(
            valeur == null ? '—' : formaterDateEvenement(valeur!),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: valeur == null
                  ? EndirekColors.encreSecondaire
                  : EndirekColors.encre,
              fontSize: 13.5,
            ),
          ),
        ),
        TextButton.icon(
          onPressed: surChoisir,
          icon: const Icon(Icons.calendar_today_outlined, size: 16),
          label: Text(valeur == null ? 'Choisir' : 'Modifier'),
        ),
        if (surEffacer != null)
          TextButton(
            onPressed: surEffacer,
            child: const Text(
              'Effacer',
              style: TextStyle(color: Color(0xFFB3261E)),
            ),
          ),
      ],
    );
  }
}

/// Ligne de choix d'image (vignette + boutons), partagée par le formulaire.
class _LigneImage extends StatelessWidget {
  const _LigneImage({
    required this.imageUrl,
    required this.envoiEnCours,
    required this.surChoisir,
    required this.surRetirer,
  });

  final String? imageUrl;
  final bool envoiEnCours;
  final VoidCallback surChoisir;
  final VoidCallback surRetirer;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            width: 56,
            height: 56,
            child: envoiEnCours
                ? const ColoredBox(
                    color: EndirekColors.surface,
                    child: Center(
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      ),
                    ),
                  )
                : (imageUrl != null && imageUrl!.isNotEmpty)
                    ? Image.network(
                        ApiConfig.resolveMediaUrl(imageUrl!),
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const _PictoImage(),
                      )
                    : const _PictoImage(),
          ),
        ),
        const SizedBox(width: 10),
        TextButton.icon(
          onPressed: envoiEnCours ? null : surChoisir,
          icon: const Icon(Icons.add_photo_alternate_outlined, size: 18),
          label: Text(imageUrl == null ? 'Photo' : 'Remplacer'),
        ),
        if (imageUrl != null)
          TextButton(
            onPressed: envoiEnCours ? null : surRetirer,
            child: const Text(
              'Retirer',
              style: TextStyle(color: Color(0xFFB3261E)),
            ),
          ),
      ],
    );
  }
}

class _PictoImage extends StatelessWidget {
  const _PictoImage();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: EndirekColors.surface,
      child: Icon(
        Icons.image_outlined,
        color: EndirekColors.encreSecondaire,
      ),
    );
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

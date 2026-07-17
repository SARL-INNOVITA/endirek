import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/api/models/commune.dart';
import '../../../../core/api/models/post_media.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../../feed/application/referentiels_providers.dart';
import '../../../post_composer/data/media_repository.dart';
import '../../application/pages_providers.dart';
import '../../data/pages_repository.dart';
import '../../domain/formatage_pages.dart';
import '../../domain/page_models.dart';

/// Nombre maximal d'attributs d'une page.
const int _maxAttributs = 5;

/// ÉDITION des informations d'une page (/pages/:id/gerer/infos) : nom, bio,
/// commune, téléphone, attributs, avatar/couverture, et CONGÉS (date de fin
/// via DatePicker + message facultatif — les effacer termine les congés).
/// PATCH /pages/:id au bouton Enregistrer.
class GererInfosScreen extends ConsumerWidget {
  const GererInfosScreen({super.key, required this.pageId});

  final String pageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<PageDetail> etat = ref.watch(pageDetailProvider(pageId));

    return Scaffold(
      appBar: AppBar(title: const Text('Informations')),
      body: SafeArea(
        child: switch (etat) {
          AsyncData(:final value) => _FormulaireInfos(page: value),
          AsyncError() => Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Impossible de charger la page.',
                    style: TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 14,
                    ),
                  ),
                  TextButton(
                    onPressed: () =>
                        ref.invalidate(pageDetailProvider(pageId)),
                    child: const Text('Réessayer'),
                  ),
                ],
              ),
            ),
          _ => const Center(child: CircularProgressIndicator()),
        },
      ),
    );
  }
}

/// Formulaire pré-rempli avec la page chargée (état local mutable).
class _FormulaireInfos extends ConsumerStatefulWidget {
  const _FormulaireInfos({required this.page});

  final PageDetail page;

  @override
  ConsumerState<_FormulaireInfos> createState() => _FormulaireInfosState();
}

class _FormulaireInfosState extends ConsumerState<_FormulaireInfos> {
  late final TextEditingController _nomController =
      TextEditingController(text: widget.page.name);
  late final TextEditingController _bioController =
      TextEditingController(text: widget.page.bio);
  late final TextEditingController _telephoneController =
      TextEditingController(text: widget.page.phone ?? '');
  late final TextEditingController _messageCongesController =
      TextEditingController(text: widget.page.openStatus.vacationMessage ?? '');
  final TextEditingController _attributController = TextEditingController();
  final ImagePicker _selecteur = ImagePicker();

  late String _ville = widget.page.city;
  late final List<String> _attributs = [...widget.page.attributes];
  late String? _avatarUrl = widget.page.avatarUrl;
  late String? _coverUrl = widget.page.coverUrl;
  late DateTime? _finConges = widget.page.openStatus.vacationUntil;

  bool _envoiAvatar = false;
  bool _envoiCouverture = false;
  bool _enregistrement = false;

  @override
  void dispose() {
    _nomController.dispose();
    _bioController.dispose();
    _telephoneController.dispose();
    _messageCongesController.dispose();
    _attributController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bool uploadsEnCours = _envoiAvatar || _envoiCouverture;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        const _Label('Nom de la page'),
        TextField(
          controller: _nomController,
          maxLength: 80,
          decoration: const InputDecoration(counterText: ''),
        ),
        const SizedBox(height: 16),
        const _Label('Commune'),
        _SelecteurCommuneNom(
          ville: _ville,
          surVille: (valeur) => setState(() => _ville = valeur),
        ),
        const SizedBox(height: 16),
        const _Label('Bio'),
        TextField(
          controller: _bioController,
          maxLength: 500,
          minLines: 3,
          maxLines: 6,
          decoration: const InputDecoration(alignLabelWithHint: true),
        ),
        const SizedBox(height: 8),
        const _Label('Téléphone (optionnel)'),
        TextField(
          controller: _telephoneController,
          maxLength: 20,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(counterText: ''),
        ),
        const SizedBox(height: 16),
        _SectionAttributs(
          attributs: _attributs,
          controleur: _attributController,
          surAjouter: _ajouterAttribut,
          surRetirer: (attribut) => setState(() => _attributs.remove(attribut)),
        ),
        const SizedBox(height: 20),
        _SectionImage(
          titre: 'Avatar',
          url: _avatarUrl,
          enEnvoi: _envoiAvatar,
          surChoisir: () => _choisirImage(avatar: true),
          surRetirer: () => setState(() => _avatarUrl = null),
        ),
        const SizedBox(height: 16),
        _SectionImage(
          titre: 'Photo de couverture',
          url: _coverUrl,
          enEnvoi: _envoiCouverture,
          surChoisir: () => _choisirImage(avatar: false),
          surRetirer: () => setState(() => _coverUrl = null),
        ),
        const SizedBox(height: 20),
        _SectionConges(
          finConges: _finConges,
          messageController: _messageCongesController,
          surChoisirDate: _choisirFinConges,
          surTerminer: () => setState(() {
            _finConges = null;
            _messageCongesController.clear();
          }),
        ),
        const SizedBox(height: 28),
        FilledButton(
          onPressed: (_enregistrement || uploadsEnCours) ? null : _enregistrer,
          child: _enregistrement
              ? const SizedBox(
                  height: 22,
                  width: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white,
                  ),
                )
              : const Text('Enregistrer'),
        ),
      ],
    );
  }

  void _ajouterAttribut() {
    final String saisie = _attributController.text.trim();
    if (saisie.isEmpty || _attributs.length >= _maxAttributs) {
      return;
    }
    if (_attributs.any(
      (attribut) => attribut.toLowerCase() == saisie.toLowerCase(),
    )) {
      _attributController.clear();
      return;
    }
    setState(() {
      _attributs.add(saisie);
      _attributController.clear();
    });
  }

  Future<void> _choisirImage({required bool avatar}) async {
    final XFile? fichier;
    try {
      fichier = await _selecteur.pickImage(source: ImageSource.gallery);
    } catch (_) {
      return;
    }
    if (fichier == null || !mounted) {
      return;
    }
    setState(() {
      if (avatar) {
        _envoiAvatar = true;
      } else {
        _envoiCouverture = true;
      }
    });
    try {
      final PostMedia resultat =
          await ref.read(mediaRepositoryProvider).uploaderImage(fichier);
      if (!mounted) {
        return;
      }
      setState(() {
        if (avatar) {
          _avatarUrl = resultat.url;
        } else {
          _coverUrl = resultat.url;
        }
      });
    } on ApiException catch (erreur) {
      if (mounted) {
        _snack(erreur.message);
      }
    } finally {
      if (mounted) {
        setState(() {
          if (avatar) {
            _envoiAvatar = false;
          } else {
            _envoiCouverture = false;
          }
        });
      }
    }
  }

  Future<void> _choisirFinConges() async {
    final DateTime maintenant = DateTime.now();
    final DateTime? choisie = await showDatePicker(
      context: context,
      initialDate: _finConges ?? maintenant.add(const Duration(days: 7)),
      firstDate: maintenant,
      lastDate: maintenant.add(const Duration(days: 365)),
      helpText: 'Fin des congés',
    );
    if (choisie != null) {
      // Fin de journée locale : la page rouvre le lendemain matin.
      setState(() => _finConges =
          DateTime(choisie.year, choisie.month, choisie.day, 23, 59));
    }
  }

  Future<void> _enregistrer() async {
    FocusScope.of(context).unfocus();
    final String nom = _nomController.text.trim();
    if (nom.isEmpty) {
      _snack('Le nom de la page est obligatoire.');
      return;
    }
    final String bio = _bioController.text.trim();
    final String telephone = _telephoneController.text.trim();
    final String messageConges = _messageCongesController.text.trim();

    setState(() => _enregistrement = true);
    try {
      await ref.read(pagesRepositoryProvider).modifierPage(
            widget.page.id,
            name: nom,
            bio: bio,
            city: _ville,
            phone: telephone.isEmpty ? null : telephone,
            attributes: _attributs,
            // Avatar/couverture OMIS si inchangés : la garde de provenance
            // serveur (D16/D77) refuse une URL hors upload Endirek renvoyée
            // telle quelle — cas des visuels de démonstration du seed.
            avatarUrl: _avatarUrl == widget.page.avatarUrl
                ? champAbsent
                : _avatarUrl,
            coverUrl:
                _coverUrl == widget.page.coverUrl ? champAbsent : _coverUrl,
            // null EFFACE les congés (page de nouveau pilotée par les
            // horaires) ; une date les active/positionne.
            vacationUntil: _finConges?.toUtc().toIso8601String(),
            vacationMessage:
                _finConges == null || messageConges.isEmpty
                    ? null
                    : messageConges,
          );
      ref.invalidate(pageDetailProvider(widget.page.id));
      ref.invalidate(mesPagesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Informations enregistrées')),
        );
        context.pop();
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

// ─────────────────────────────────────────────────────────────────────────
// Sous-widgets
// ─────────────────────────────────────────────────────────────────────────

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

/// Sélecteur de commune par NOM (la page stocke `city`) — pré-sélectionne
/// la commune actuelle dans le référentiel /map/communes.
class _SelecteurCommuneNom extends ConsumerWidget {
  const _SelecteurCommuneNom({required this.ville, required this.surVille});

  final String ville;
  final ValueChanged<String> surVille;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Commune>> communes = ref.watch(communesProvider);
    return switch (communes) {
      AsyncData(:final value) => DropdownButtonFormField<String>(
          initialValue:
              value.any((commune) => commune.name == ville) ? ville : null,
          isExpanded: true,
          hint: const Text('Choisissez une commune'),
          items: [
            for (final Commune element in value)
              DropdownMenuItem(value: element.name, child: Text(element.name)),
          ],
          onChanged: (valeur) {
            if (valeur != null) {
              surVille(valeur);
            }
          },
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

/// Attributs (chips retirables + petit champ d'ajout).
class _SectionAttributs extends StatelessWidget {
  const _SectionAttributs({
    required this.attributs,
    required this.controleur,
    required this.surAjouter,
    required this.surRetirer,
  });

  final List<String> attributs;
  final TextEditingController controleur;
  final VoidCallback surAjouter;
  final ValueChanged<String> surRetirer;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Label('Attributs (${attributs.length}/$_maxAttributs)'),
        if (attributs.isNotEmpty) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final String attribut in attributs)
                InputChip(
                  label: Text(attribut),
                  backgroundColor: EndirekColors.surface,
                  side: const BorderSide(color: EndirekColors.bordure),
                  onDeleted: () => surRetirer(attribut),
                ),
            ],
          ),
          const SizedBox(height: 8),
        ],
        if (attributs.length < _maxAttributs)
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controleur,
                  maxLength: 30,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => surAjouter(),
                  decoration: const InputDecoration(
                    hintText: 'Ajouter un attribut…',
                    counterText: '',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              IconButton.filled(
                tooltip: 'Ajouter',
                onPressed: surAjouter,
                icon: const Icon(Icons.add),
              ),
            ],
          ),
      ],
    );
  }
}

/// Aperçu + sélection d'une image (avatar / couverture).
class _SectionImage extends StatelessWidget {
  const _SectionImage({
    required this.titre,
    required this.url,
    required this.enEnvoi,
    required this.surChoisir,
    required this.surRetirer,
  });

  final String titre;
  final String? url;
  final bool enEnvoi;
  final VoidCallback surChoisir;
  final VoidCallback surRetirer;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Label(titre),
        Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 72,
                height: 72,
                child: enEnvoi
                    ? const ColoredBox(
                        color: EndirekColors.surface,
                        child: Center(
                          child: SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2.5),
                          ),
                        ),
                      )
                    : (url != null && url!.isNotEmpty)
                        ? Image.network(
                            ApiConfig.resolveMediaUrl(url!),
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) =>
                                const ColoredBox(color: EndirekColors.surface),
                          )
                        : const ColoredBox(
                            color: EndirekColors.surface,
                            child: Icon(
                              Icons.image_outlined,
                              color: EndirekColors.encreSecondaire,
                            ),
                          ),
              ),
            ),
            const SizedBox(width: 12),
            TextButton.icon(
              onPressed: enEnvoi ? null : surChoisir,
              icon: const Icon(Icons.add_photo_alternate_outlined, size: 18),
              label: Text(url == null ? 'Choisir une photo' : 'Remplacer'),
            ),
            if (url != null)
              TextButton(
                onPressed: enEnvoi ? null : surRetirer,
                child: const Text(
                  'Retirer',
                  style: TextStyle(color: Color(0xFFB3261E)),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Congés : date de fin (DatePicker) + message facultatif, bouton
/// « Terminer les congés » quand ils sont actifs.
class _SectionConges extends StatelessWidget {
  const _SectionConges({
    required this.finConges,
    required this.messageController,
    required this.surChoisirDate,
    required this.surTerminer,
  });

  final DateTime? finConges;
  final TextEditingController messageController;
  final VoidCallback surChoisirDate;
  final VoidCallback surTerminer;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: EndirekColors.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Congés',
            style: TextStyle(
              color: EndirekColors.encre,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Pendant vos congés, la page affiche « EN CONGÉS » avec la date '
            'de réouverture et votre message éventuel.',
            style: TextStyle(
              color: EndirekColors.encreSecondaire,
              fontSize: 12.5,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  finConges == null
                      ? 'Aucun congé programmé.'
                      : 'En congés jusqu\'au '
                          '${formaterDateCourte(finConges!)}.',
                  style: const TextStyle(
                    color: EndirekColors.encre,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: surChoisirDate,
                icon: const Icon(Icons.event_outlined, size: 18),
                label: Text(finConges == null ? 'Programmer' : 'Modifier'),
              ),
            ],
          ),
          if (finConges != null) ...[
            TextField(
              controller: messageController,
              maxLength: 200,
              decoration: const InputDecoration(
                hintText: 'Message affiché (optionnel)…',
                counterText: '',
                fillColor: Colors.white,
                isDense: true,
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: surTerminer,
                child: const Text(
                  'Terminer les congés',
                  style: TextStyle(color: Color(0xFFB3261E)),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

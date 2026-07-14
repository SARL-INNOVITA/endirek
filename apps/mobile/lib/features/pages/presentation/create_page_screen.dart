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
import '../application/pages_providers.dart';
import '../data/pages_repository.dart';
import '../domain/page_models.dart';

/// Nombre maximal d'attributs d'une page (chips « Créole », « Sur place »…).
const int _maxAttributs = 5;

/// Écran de CRÉATION d'une page (/pages/create — section « Mes pages » du
/// profil) : type restaurant/entreprise, nom, commune (référentiel
/// /map/communes), bio, téléphone, attributs (≤ 5 petites chips), avatar et
/// couverture via image_picker + POST /media/upload. Au succès, remplace
/// l'écran par la page publique créée.
class CreatePageScreen extends ConsumerStatefulWidget {
  const CreatePageScreen({super.key});

  @override
  ConsumerState<CreatePageScreen> createState() => _CreatePageScreenState();
}

class _CreatePageScreenState extends ConsumerState<CreatePageScreen> {
  final TextEditingController _nomController = TextEditingController();
  final TextEditingController _bioController = TextEditingController();
  final TextEditingController _telephoneController = TextEditingController();
  final TextEditingController _attributController = TextEditingController();
  final ImagePicker _selecteur = ImagePicker();

  String _pageType = 'restaurant';
  Commune? _commune;
  final List<String> _attributs = [];

  String? _avatarUrl;
  String? _coverUrl;
  bool _envoiAvatar = false;
  bool _envoiCouverture = false;
  bool _creation = false;

  @override
  void dispose() {
    _nomController.dispose();
    _bioController.dispose();
    _telephoneController.dispose();
    _attributController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bool uploadsEnCours = _envoiAvatar || _envoiCouverture;

    return Scaffold(
      appBar: AppBar(title: const Text('Créer une page')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            const _Label('Type de page'),
            Row(
              children: [
                Expanded(
                  child: _BoutonType(
                    actif: _pageType == 'restaurant',
                    icone: Icons.restaurant_outlined,
                    libelle: 'Restaurant',
                    surTap: () => setState(() => _pageType = 'restaurant'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _BoutonType(
                    actif: _pageType == 'business',
                    icone: Icons.business_outlined,
                    libelle: 'Entreprise',
                    surTap: () => setState(() => _pageType = 'business'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const _Label('Nom de la page'),
            TextField(
              controller: _nomController,
              maxLength: 80,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                hintText: 'Ex : Bon Goût',
                counterText: '',
              ),
            ),
            const SizedBox(height: 16),
            const _Label('Commune'),
            _SelecteurCommune(
              commune: _commune,
              surCommune: (valeur) => setState(() => _commune = valeur),
            ),
            const SizedBox(height: 16),
            const _Label('Bio'),
            TextField(
              controller: _bioController,
              maxLength: 500,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(
                hintText: 'Présentez votre activité en quelques mots…',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 8),
            const _Label('Téléphone (optionnel)'),
            TextField(
              controller: _telephoneController,
              maxLength: 20,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                hintText: 'Ex : 0262 12 34 56',
                counterText: '',
              ),
            ),
            const SizedBox(height: 16),
            _SectionAttributs(
              attributs: _attributs,
              controleur: _attributController,
              surAjouter: _ajouterAttribut,
              surRetirer: (attribut) =>
                  setState(() => _attributs.remove(attribut)),
            ),
            const SizedBox(height: 20),
            _SectionImagePage(
              titre: 'Avatar',
              url: _avatarUrl,
              enEnvoi: _envoiAvatar,
              surChoisir: () => _choisirImage(avatar: true),
              surRetirer: () => setState(() => _avatarUrl = null),
            ),
            const SizedBox(height: 16),
            _SectionImagePage(
              titre: 'Photo de couverture',
              url: _coverUrl,
              enEnvoi: _envoiCouverture,
              surChoisir: () => _choisirImage(avatar: false),
              surRetirer: () => setState(() => _coverUrl = null),
            ),
            const SizedBox(height: 28),
            FilledButton(
              onPressed: (_creation || uploadsEnCours) ? null : _creer,
              child: _creation
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Créer la page'),
            ),
          ],
        ),
      ),
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

  /// Choisit puis uploade IMMÉDIATEMENT l'avatar ou la couverture.
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

  Future<void> _creer() async {
    FocusScope.of(context).unfocus();
    final String nom = _nomController.text.trim();
    if (nom.isEmpty) {
      _snack('Le nom de la page est obligatoire.');
      return;
    }
    if (_commune == null) {
      _snack('Choisissez une commune.');
      return;
    }
    final String bio = _bioController.text.trim();
    final String telephone = _telephoneController.text.trim();

    setState(() => _creation = true);
    try {
      final PageDetail page = await ref.read(pagesRepositoryProvider).creerPage(
            pageType: _pageType,
            name: nom,
            city: _commune!.name,
            bio: bio.isEmpty ? null : bio,
            phone: telephone.isEmpty ? null : telephone,
            attributes: _attributs,
            avatarUrl: _avatarUrl,
            coverUrl: _coverUrl,
          );
      // La section « Mes pages » du profil doit refléter la nouvelle page.
      ref.invalidate(mesPagesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Votre page est créée')),
        );
        context.pushReplacement('/pages/${page.id}');
      }
    } on ApiException catch (erreur) {
      if (mounted) {
        setState(() => _creation = false);
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

/// Bouton de sélection du type (restaurant / entreprise) — même visuel que
/// le choix bien/service du composer Dealplace.
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

/// Sélecteur de commune (référentiel GET /map/communes) — même pattern que
/// les composers existants.
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

/// Attributs de la page : petit champ + bouton d'ajout, chips retirables.
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
        const Text(
          'Quelques mots-clés affichés en chips sur la page '
          '(ex : Créole, Sur place, À emporter).',
          style: TextStyle(
            color: EndirekColors.encreSecondaire,
            fontSize: 12.5,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 8),
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

/// Sélection + aperçu d'une image de page (avatar ou couverture), uploadée
/// immédiatement sur POST /media/upload.
class _SectionImagePage extends StatelessWidget {
  const _SectionImagePage({
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

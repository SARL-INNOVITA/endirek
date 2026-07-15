import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../../post_composer/data/media_repository.dart';
import '../../application/pages_providers.dart';
import '../../data/pages_repository.dart';
import '../../domain/formatage_pages.dart';
import '../../domain/page_models.dart';

/// Nombre maximal de documents « Nos cartes » par page (contrat serveur).
const int _maxDocuments = 5;

/// GESTION DES CARTES PDF d'un restaurant (/pages/:id/gerer/cartes —
/// section « Nos cartes ») : liste des documents, ajout en trois temps
/// (sélection d'un PDF via file_picker → libellé → upload
/// `POST /media/upload-document` puis attache `POST /pages/:id/documents`),
/// suppression avec confirmation. Quota : 5 documents par page.
class GererCartesScreen extends ConsumerStatefulWidget {
  const GererCartesScreen({super.key, required this.pageId});

  final String pageId;

  @override
  ConsumerState<GererCartesScreen> createState() => _GererCartesScreenState();
}

class _GererCartesScreenState extends ConsumerState<GererCartesScreen> {
  bool _envoi = false;

  @override
  Widget build(BuildContext context) {
    final AsyncValue<PageDetail> etat =
        ref.watch(pageDetailProvider(widget.pageId));

    return Scaffold(
      appBar: AppBar(title: const Text('Nos cartes')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _envoi ? null : () => _ajouter(etat.value),
        icon: _envoi
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: Colors.white,
                ),
              )
            : const Icon(Icons.add),
        label: Text(_envoi ? 'Envoi…' : 'Ajouter une carte'),
      ),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(pageDetailProvider(widget.pageId)),
          child: switch (etat) {
            AsyncData(:final value) => _liste(value),
            AsyncError() => _EtatMessage(
                icone: Icons.wifi_off_outlined,
                message: 'Impossible de charger la page.',
                actionLibelle: 'Réessayer',
                surAction: () =>
                    ref.invalidate(pageDetailProvider(widget.pageId)),
              ),
            _ => const Center(child: CircularProgressIndicator()),
          },
        ),
      ),
    );
  }

  Widget _liste(PageDetail page) {
    if (page.documents.isEmpty) {
      return const _EtatMessage(
        icone: Icons.picture_as_pdf_outlined,
        message: 'Aucune carte pour le moment.\nAjoutez vos cartes PDF '
            '(carte principale, carte des boissons…) : elles seront '
            'consultables sur votre page.',
      );
    }
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        Text(
          '${page.documents.length}/$_maxDocuments documents',
          style: const TextStyle(
            color: EndirekColors.encreSecondaire,
            fontSize: 12.5,
          ),
        ),
        const SizedBox(height: 10),
        for (final PageDocumentView document in page.documents)
          _TuileDocument(
            document: document,
            surSupprimer: () => _confirmerSuppression(document),
          ),
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ajout
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _ajouter(PageDetail? page) async {
    if (page != null && page.documents.length >= _maxDocuments) {
      _snack('$_maxDocuments documents maximum par page.');
      return;
    }
    // 1. Sélection du PDF.
    final FilePickerResult? resultat;
    try {
      resultat = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
      );
    } catch (_) {
      return;
    }
    if (resultat == null || resultat.files.isEmpty || !mounted) {
      return;
    }
    final PlatformFile fichier = resultat.files.first;
    final String? chemin = fichier.path;
    if (chemin == null) {
      _snack('Fichier inaccessible.');
      return;
    }
    // 2. Libellé (pré-rempli avec le nom du fichier sans extension).
    final String? libelle = await _demanderLibelle(
      fichier.name.replaceFirst(RegExp(r'\.pdf$', caseSensitive: false), ''),
    );
    if (libelle == null || !mounted) {
      return;
    }
    // 3. Upload puis attache à la page.
    setState(() => _envoi = true);
    try {
      final ({String url, int fileSizeBytes}) upload = await ref
          .read(mediaRepositoryProvider)
          .uploaderDocument(chemin, nomFichier: fichier.name);
      await ref.read(pagesRepositoryProvider).ajouterDocument(
            widget.pageId,
            label: libelle,
            url: upload.url,
            fileSizeBytes: upload.fileSizeBytes,
          );
      // Écran quitté pendant l'envoi : ref inutilisable, le provider
      // autoDispose rechargera au prochain montage.
      if (!mounted) {
        return;
      }
      ref.invalidate(pageDetailProvider(widget.pageId));
      _snack('Carte ajoutée');
    } on ApiException catch (erreur) {
      // Inclut le 400 de quota et le rejet des fichiers non PDF (magic
      // bytes vérifiés côté serveur).
      if (mounted) {
        _snack(erreur.message);
      }
    } finally {
      if (mounted) {
        setState(() => _envoi = false);
      }
    }
  }

  Future<String?> _demanderLibelle(String suggestion) {
    return showDialog<String>(
      context: context,
      builder: (contexteDialogue) => _DialogueLibelle(suggestion: suggestion),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Suppression
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _confirmerSuppression(PageDocumentView document) async {
    final bool? confirme = await showDialog<bool>(
      context: context,
      builder: (contexteDialogue) => AlertDialog(
        title: Text('Supprimer « ${document.label} » ?'),
        content: const Text(
          'La carte ne sera plus proposée sur votre page.',
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
    if (confirme != true || !mounted) {
      return;
    }
    try {
      await ref
          .read(pagesRepositoryProvider)
          .supprimerDocument(widget.pageId, document.id);
      if (!mounted) {
        return;
      }
      ref.invalidate(pageDetailProvider(widget.pageId));
      _snack('Carte supprimée');
    } on ApiException catch (erreur) {
      if (mounted) {
        _snack(erreur.message);
      }
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}

/// Dialogue de saisie du libellé d'une carte — StatefulWidget pour que le
/// TextEditingController vive aussi longtemps que le dialogue (l'animation
/// de fermeture touche encore le champ après le pop).
class _DialogueLibelle extends StatefulWidget {
  const _DialogueLibelle({required this.suggestion});

  final String suggestion;

  @override
  State<_DialogueLibelle> createState() => _DialogueLibelleState();
}

class _DialogueLibelleState extends State<_DialogueLibelle> {
  late final TextEditingController _controleur =
      TextEditingController(text: widget.suggestion);

  @override
  void dispose() {
    _controleur.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Nom de la carte'),
      content: TextField(
        controller: _controleur,
        autofocus: true,
        maxLength: 80,
        decoration: const InputDecoration(
          labelText: 'Libellé',
          hintText: 'Carte principale',
          counterText: '',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Annuler'),
        ),
        TextButton(
          onPressed: () {
            final String saisie = _controleur.text.trim();
            if (saisie.isEmpty) {
              return;
            }
            Navigator.of(context).pop(saisie);
          },
          child: const Text('Ajouter'),
        ),
      ],
    );
  }
}

/// Ligne d'un document : icône PDF, libellé, « PDF · 1,2 Mo », suppression.
class _TuileDocument extends StatelessWidget {
  const _TuileDocument({required this.document, required this.surSupprimer});

  final PageDocumentView document;
  final VoidCallback surSupprimer;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: const Color(0xFFE0EDFA),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.picture_as_pdf_outlined,
                color: EndirekColors.bleu,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    document.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    'PDF · ${formaterTailleFichier(document.fileSizeBytes)}',
                    style: const TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 12,
                    ),
                  ),
                ],
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

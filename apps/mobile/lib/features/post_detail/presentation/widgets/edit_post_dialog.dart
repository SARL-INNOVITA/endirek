import 'package:flutter/material.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/api/models/feed_post.dart';

/// Dialogue d'édition d'une publication (titre/texte uniquement — le type
/// et la localisation ne sont pas modifiables au MVP, règle produit côté
/// API). [enregistrer] fait le PATCH ; renvoie true si l'édition a abouti.
Future<bool> montrerDialogEditionPost(
  BuildContext context, {
  required FeedPost post,
  required Future<void> Function({String? title, String? body}) enregistrer,
}) async {
  final bool? modifie = await showDialog<bool>(
    context: context,
    builder: (_) => _DialogEdition(post: post, enregistrer: enregistrer),
  );
  return modifie ?? false;
}

class _DialogEdition extends StatefulWidget {
  const _DialogEdition({required this.post, required this.enregistrer});

  final FeedPost post;
  final Future<void> Function({String? title, String? body}) enregistrer;

  @override
  State<_DialogEdition> createState() => _DialogEditionState();
}

class _DialogEditionState extends State<_DialogEdition> {
  late final TextEditingController _titreController =
      TextEditingController(text: widget.post.title ?? '');
  late final TextEditingController _texteController =
      TextEditingController(text: widget.post.body);

  bool _envoi = false;
  String? _erreur;

  @override
  void dispose() {
    _titreController.dispose();
    _texteController.dispose();
    super.dispose();
  }

  Future<void> _enregistrer() async {
    final String texte = _texteController.text.trim();
    if (texte.isEmpty) {
      setState(() => _erreur = 'Le texte ne peut pas être vide.');
      return;
    }
    setState(() {
      _envoi = true;
      _erreur = null;
    });
    try {
      final String titre = _titreController.text.trim();
      await widget.enregistrer(
        // Un titre vidé est transmis comme null EXPLICITE (le PATCH remet
        // alors le titre à null côté serveur) plutôt que comme chaîne vide.
        title: titre.isEmpty ? null : titre,
        body: texte,
      );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (erreur) {
      if (mounted) {
        setState(() {
          _envoi = false;
          _erreur = erreur.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Modifier la publication'),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _titreController,
                maxLength: 120,
                decoration: const InputDecoration(
                  labelText: 'Titre (optionnel)',
                  counterText: '',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _texteController,
                maxLength: 2000,
                minLines: 4,
                maxLines: 8,
                decoration: const InputDecoration(
                  labelText: 'Texte',
                  alignLabelWithHint: true,
                ),
              ),
              if (_erreur != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(
                    _erreur!,
                    style: const TextStyle(
                      color: Color(0xFFB3261E),
                      fontSize: 13,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed:
              _envoi ? null : () => Navigator.of(context).pop(false),
          child: const Text('Annuler'),
        ),
        TextButton(
          onPressed: _envoi ? null : _enregistrer,
          child: _envoi
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Enregistrer'),
        ),
      ],
    );
  }
}

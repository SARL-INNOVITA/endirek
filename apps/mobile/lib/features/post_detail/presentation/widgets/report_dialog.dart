import 'package:flutter/material.dart';

import '../../../../core/api/api_exception.dart';

/// Motifs de signalement du contrat (codes de la table reports) et leurs
/// libellés français.
const List<({String code, String label})> motifsSignalement = [
  (code: 'spam', label: 'Spam ou publicité'),
  (code: 'hateful', label: 'Contenu haineux ou insultant'),
  (code: 'dangerous', label: 'Contenu dangereux'),
  (code: 'false_info', label: 'Fausse information'),
  (code: 'other', label: 'Autre'),
];

/// Ouvre le dialogue de signalement : raison OBLIGATOIRE parmi les 5 codes,
/// précisions optionnelles (≤ 500). [envoyer] fait l'appel API — le 409
/// « Vous avez déjà signalé ce contenu » (et toute autre erreur) s'affiche
/// dans le dialogue. [titre] adapte le dialogue à la cible (publication par
/// défaut, annonce Dealplace — CP2.5). Renvoie true si le signalement a été
/// envoyé.
Future<bool> montrerDialogSignalement(
  BuildContext context, {
  String titre = 'Signaler cette publication',
  required Future<void> Function({
    required String reasonCode,
    String? message,
  }) envoyer,
}) async {
  final bool? envoye = await showDialog<bool>(
    context: context,
    builder: (_) => _DialogSignalement(titre: titre, envoyer: envoyer),
  );
  return envoye ?? false;
}

class _DialogSignalement extends StatefulWidget {
  const _DialogSignalement({required this.titre, required this.envoyer});

  final String titre;
  final Future<void> Function({required String reasonCode, String? message})
      envoyer;

  @override
  State<_DialogSignalement> createState() => _DialogSignalementState();
}

class _DialogSignalementState extends State<_DialogSignalement> {
  final TextEditingController _detailController = TextEditingController();
  String? _code;
  bool _envoi = false;
  String? _erreur;

  @override
  void dispose() {
    _detailController.dispose();
    super.dispose();
  }

  Future<void> _envoyer() async {
    final String? code = _code;
    if (code == null) {
      setState(() => _erreur = 'Choisissez un motif de signalement.');
      return;
    }
    setState(() {
      _envoi = true;
      _erreur = null;
    });
    try {
      final String detail = _detailController.text.trim();
      await widget.envoyer(
        reasonCode: code,
        message: detail.isEmpty ? null : detail,
      );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (erreur) {
      // 409 « Vous avez déjà signalé ce contenu » inclus : affiché tel quel.
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
      title: Text(widget.titre),
      contentPadding: const EdgeInsets.fromLTRB(8, 16, 8, 0),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              RadioGroup<String>(
                groupValue: _code,
                onChanged: (valeur) => setState(() => _code = valeur),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final motif in motifsSignalement)
                      RadioListTile<String>(
                        value: motif.code,
                        dense: true,
                        contentPadding:
                            const EdgeInsets.symmetric(horizontal: 8),
                        title: Text(
                          motif.label,
                          style: const TextStyle(fontSize: 14),
                        ),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: TextField(
                  controller: _detailController,
                  maxLength: 500,
                  maxLines: 3,
                  minLines: 2,
                  decoration: const InputDecoration(
                    hintText: 'Précisions (optionnel)',
                    counterText: '',
                  ),
                ),
              ),
              if (_erreur != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
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
          onPressed: _envoi ? null : _envoyer,
          child: _envoi
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Signaler'),
        ),
      ],
    );
  }
}

/// Petit rappel visuel utilisé après un signalement réussi.
const String messageSignalementEnvoye =
    'Signalement envoyé. Merci de contribuer à la sécurité d\'Endirek.';

/// Couleur d'accent des actions destructrices (suppression…).
const Color couleurDanger = Color(0xFFB3261E);

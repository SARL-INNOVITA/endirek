import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../application/pages_providers.dart';
import '../../data/pages_repository.dart';
import '../../domain/formatage_pages.dart';
import '../../domain/page_models.dart';

/// ÉDITEUR DES HORAIRES d'une page (/pages/:id/gerer/horaires) : pour chaque
/// jour (Lundi → Dimanche), ajout/suppression de plages « ouverture –
/// fermeture » via TimePicker. « Enregistrer » remplace TOUT (PUT
/// /pages/:id/hours).
class GererHorairesScreen extends ConsumerWidget {
  const GererHorairesScreen({super.key, required this.pageId});

  final String pageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<PageDetail> etat = ref.watch(pageDetailProvider(pageId));

    return Scaffold(
      appBar: AppBar(title: const Text('Horaires')),
      body: SafeArea(
        child: switch (etat) {
          AsyncData(:final value) => _EditeurHoraires(page: value),
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

/// Une plage horaire éditable (heures locales, minutes comprises).
typedef _Plage = ({TimeOfDay ouverture, TimeOfDay fermeture});

class _EditeurHoraires extends ConsumerStatefulWidget {
  const _EditeurHoraires({required this.page});

  final PageDetail page;

  @override
  ConsumerState<_EditeurHoraires> createState() => _EditeurHorairesState();
}

class _EditeurHorairesState extends ConsumerState<_EditeurHoraires> {
  /// Plages par jour (index 0 = lundi … 6 = dimanche), pré-remplies depuis
  /// la page chargée.
  late final List<List<_Plage>> _plagesParJour = [
    for (int jour = 0; jour < 7; jour++)
      [
        for (final PageHourView plage in widget.page.hours)
          if (plage.weekday == jour)
            (
              ouverture: _heureDepuisTexte(plage.opensAt),
              fermeture: _heureDepuisTexte(plage.closesAt),
            ),
      ],
  ];

  bool _enregistrement = false;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        const Text(
          'Définissez vos plages d\'ouverture jour par jour (midi et soir '
          'par exemple). Un jour sans plage est affiché « Fermé ».',
          style: TextStyle(
            color: EndirekColors.encreSecondaire,
            fontSize: 13,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 12),
        for (int jour = 0; jour < 7; jour++) _blocJour(jour),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _enregistrement ? null : _enregistrer,
          child: _enregistrement
              ? const SizedBox(
                  height: 22,
                  width: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white,
                  ),
                )
              : const Text('Enregistrer les horaires'),
        ),
      ],
    );
  }

  Widget _blocJour(int jour) {
    final List<_Plage> plages = _plagesParJour[jour];
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 6, 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    joursSemaine[jour],
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                TextButton.icon(
                  onPressed: () => _ajouterPlage(jour),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Ajouter une plage'),
                ),
              ],
            ),
            if (plages.isEmpty)
              const Padding(
                padding: EdgeInsets.only(bottom: 8),
                child: Text(
                  'Fermé',
                  style: TextStyle(
                    color: EndirekColors.encreSecondaire,
                    fontSize: 13.5,
                  ),
                ),
              )
            else
              for (final (int index, _Plage plage) in plages.indexed)
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        formaterPlageHoraire(
                          _texteDepuisHeure(plage.ouverture),
                          _texteDepuisHeure(plage.fermeture),
                        ),
                        style: const TextStyle(
                          color: EndirekColors.encre,
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Modifier',
                      onPressed: () => _modifierPlage(jour, index),
                      icon: const Icon(
                        Icons.edit_outlined,
                        size: 19,
                        color: EndirekColors.encreSecondaire,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Supprimer',
                      onPressed: () =>
                          setState(() => plages.removeAt(index)),
                      icon: const Icon(
                        Icons.delete_outline,
                        size: 19,
                        color: Color(0xFFB3261E),
                      ),
                    ),
                  ],
                ),
          ],
        ),
      ),
    );
  }

  /// Choisit ouverture puis fermeture via deux TimePickers (annulable).
  Future<_Plage?> _choisirPlage({_Plage? initiale}) async {
    final TimeOfDay? ouverture = await showTimePicker(
      context: context,
      initialTime:
          initiale?.ouverture ?? const TimeOfDay(hour: 11, minute: 30),
      helpText: 'Heure d\'ouverture',
    );
    if (ouverture == null || !mounted) {
      return null;
    }
    final TimeOfDay? fermeture = await showTimePicker(
      context: context,
      initialTime:
          initiale?.fermeture ?? const TimeOfDay(hour: 14, minute: 0),
      helpText: 'Heure de fermeture',
    );
    if (fermeture == null) {
      return null;
    }
    if (_enMinutes(fermeture) <= _enMinutes(ouverture)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'L\'heure de fermeture doit être après l\'heure d\'ouverture.',
            ),
          ),
        );
      }
      return null;
    }
    return (ouverture: ouverture, fermeture: fermeture);
  }

  Future<void> _ajouterPlage(int jour) async {
    final _Plage? plage = await _choisirPlage();
    if (plage != null && mounted) {
      setState(() => _plagesParJour[jour].add(plage));
    }
  }

  Future<void> _modifierPlage(int jour, int index) async {
    final _Plage? plage =
        await _choisirPlage(initiale: _plagesParJour[jour][index]);
    if (plage != null && mounted) {
      setState(() => _plagesParJour[jour][index] = plage);
    }
  }

  Future<void> _enregistrer() async {
    final List<PageHourView> horaires = [
      for (int jour = 0; jour < 7; jour++)
        for (final _Plage plage in _plagesParJour[jour])
          PageHourView(
            weekday: jour,
            opensAt: _texteDepuisHeure(plage.ouverture),
            closesAt: _texteDepuisHeure(plage.fermeture),
          ),
    ];

    setState(() => _enregistrement = true);
    try {
      await ref
          .read(pagesRepositoryProvider)
          .definirHoraires(widget.page.id, horaires);
      ref.invalidate(pageDetailProvider(widget.page.id));
      ref.invalidate(mesPagesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Horaires enregistrés')),
        );
        context.pop();
      }
    } on ApiException catch (erreur) {
      if (mounted) {
        setState(() => _enregistrement = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erreur.message)));
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Conversions 'HH:MM' ↔ TimeOfDay
  // ───────────────────────────────────────────────────────────────────────

  static TimeOfDay _heureDepuisTexte(String texte) {
    final List<String> parties = texte.split(':');
    return TimeOfDay(
      hour: int.tryParse(parties.first) ?? 0,
      minute: parties.length > 1 ? (int.tryParse(parties[1]) ?? 0) : 0,
    );
  }

  static String _texteDepuisHeure(TimeOfDay heure) {
    String deux(int n) => n.toString().padLeft(2, '0');
    return '${deux(heure.hour)}:${deux(heure.minute)}';
  }

  static int _enMinutes(TimeOfDay heure) => heure.hour * 60 + heure.minute;
}

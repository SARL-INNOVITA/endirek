import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../application/pages_providers.dart';
import '../../data/pages_repository.dart';
import '../../domain/formatage_pages.dart';
import '../../domain/page_models.dart';

/// Nombre maximal de plats d'un menu du jour (contrat serveur).
const int _maxPlatsParMenu = 12;

/// GESTION DES MENUS DE LA SEMAINE d'un restaurant (/pages/:id/gerer/menus) :
/// sélecteur des 7 jours glissants (comme l'écran public), composition
/// ORDONNÉE du menu du jour parmi les plats actifs (ajout en bottom sheet,
/// réordonnancement par glisser, retrait), enregistrement par
/// `PUT /pages/:id/menus/:date` (liste vide = suppression du menu du jour).
class GererMenusScreen extends ConsumerStatefulWidget {
  const GererMenusScreen({super.key, required this.pageId});

  final String pageId;

  @override
  ConsumerState<GererMenusScreen> createState() => _GererMenusScreenState();
}

class _GererMenusScreenState extends ConsumerState<GererMenusScreen> {
  int _jourSelectionne = 0;

  /// Éditions locales non enregistrées, par date 'YYYY-MM-DD' (absence de
  /// clé = liste du serveur). Une entrée est retirée après enregistrement.
  final Map<String, List<String>> _editions = {};

  bool _enregistrement = false;

  @override
  Widget build(BuildContext context) {
    final AsyncValue<List<MenuDay>> menus =
        ref.watch(menusDePageProvider(widget.pageId));
    final AsyncValue<List<Dish>> plats =
        ref.watch(platsDePageProvider(widget.pageId));

    return Scaffold(
      appBar: AppBar(title: const Text('Menus de la semaine')),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(menusDePageProvider(widget.pageId));
            ref.invalidate(platsDePageProvider(widget.pageId));
          },
          child: switch ((menus, plats)) {
            (AsyncData(value: final jours), AsyncData(value: final bibli)) =>
              _contenu(jours, bibli),
            (AsyncError(), _) || (_, AsyncError()) => _EtatMessage(
                icone: Icons.wifi_off_outlined,
                message: 'Impossible de charger les menus.',
                actionLibelle: 'Réessayer',
                surAction: () {
                  ref.invalidate(menusDePageProvider(widget.pageId));
                  ref.invalidate(platsDePageProvider(widget.pageId));
                },
              ),
            _ => const Center(child: CircularProgressIndicator()),
          },
        ),
      ),
    );
  }

  Widget _contenu(List<MenuDay> jours, List<Dish> bibliotheque) {
    if (jours.isEmpty) {
      return const _EtatMessage(
        icone: Icons.calendar_month_outlined,
        message: 'Le calendrier des menus est indisponible.',
      );
    }
    final int index = _jourSelectionne.clamp(0, jours.length - 1);
    final MenuDay jour = jours[index];
    final List<String> serveur =
        jour.items.map((plat) => plat.id).toList();
    final List<String> selection = _editions[jour.date] ?? serveur;
    final bool modifie = _editions.containsKey(jour.date) &&
        !_listesIdentiques(selection, serveur);
    final Map<String, Dish> platsParId = {
      for (final Dish plat in bibliotheque) plat.id: plat,
      // Les plats du menu du serveur restent affichables même si la
      // bibliothèque évolue entre deux rafraîchissements.
      for (final Dish plat in jour.items) plat.id: plat,
    };

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(0, 16, 0, 32),
      children: [
        // Sélecteur des 7 jours glissants (« Lun 14 »…), comme l'écran
        // public de la page.
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              for (final (int i, MenuDay element) in jours.indexed) ...[
                _ChipJour(
                  jour: element,
                  actif: i == index,
                  modifie: _editions.containsKey(element.date),
                  surTap: () => setState(() => _jourSelectionne = i),
                ),
                if (i < jours.length - 1) const SizedBox(width: 8),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            _libelleJour(jour),
            style: const TextStyle(
              color: EndirekColors.encre,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 10),
        if (bibliotheque.isEmpty && selection.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Ajoutez d\'abord des plats à votre carte pour composer '
                  'vos menus de la semaine.',
                  style: TextStyle(
                    color: EndirekColors.encreSecondaire,
                    fontSize: 13.5,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () =>
                      context.push('/pages/${widget.pageId}/gerer/plats'),
                  icon: const Icon(Icons.restaurant_outlined, size: 18),
                  label: const Text('Gérer les plats'),
                ),
              ],
            ),
          )
        else ...[
          if (selection.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Text(
                'Pas de menu ce jour-là. Ajoutez des plats ci-dessous.',
                style: TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 13.5,
                ),
              ),
            )
          else
            // Liste ORDONNÉE du menu du jour : glisser pour réordonner,
            // corbeille pour retirer.
            ReorderableListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              buildDefaultDragHandles: false,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: selection.length,
              onReorderItem: (ancien, nouveau) =>
                  _reordonner(jour, selection, ancien, nouveau),
              itemBuilder: (context, i) => _TuilePlatMenu(
                key: ValueKey(selection[i]),
                index: i,
                plat: platsParId[selection[i]],
                surRetirer: () => _retirer(jour, selection, selection[i]),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                OutlinedButton.icon(
                  onPressed: () =>
                      _ajouterPlat(jour, selection, bibliotheque),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Ajouter un plat au menu'),
                ),
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: (modifie && !_enregistrement)
                      ? () => _enregistrer(jour, selection, serveur)
                      : null,
                  child: _enregistrement
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Enregistrer le menu du jour'),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Édition locale
  // ─────────────────────────────────────────────────────────────────────────

  void _reordonner(
    MenuDay jour,
    List<String> selection,
    int ancien,
    int nouveau,
  ) {
    // onReorderItem fournit un nouvel index DÉJÀ ajusté du retrait.
    final List<String> copie = [...selection];
    final String deplace = copie.removeAt(ancien);
    copie.insert(nouveau, deplace);
    setState(() => _editions[jour.date] = copie);
  }

  void _retirer(MenuDay jour, List<String> selection, String dishId) {
    setState(() {
      _editions[jour.date] =
          selection.where((id) => id != dishId).toList();
    });
  }

  /// Bottom sheet de choix d'un plat ACTIF absent du menu du jour.
  Future<void> _ajouterPlat(
    MenuDay jour,
    List<String> selection,
    List<Dish> bibliotheque,
  ) async {
    if (selection.length >= _maxPlatsParMenu) {
      _snack('$_maxPlatsParMenu plats maximum par menu.');
      return;
    }
    final List<Dish> disponibles = bibliotheque
        .where((plat) => !selection.contains(plat.id))
        .toList();
    if (disponibles.isEmpty) {
      _snack(bibliotheque.isEmpty
          ? 'Ajoutez d\'abord des plats depuis « Gérer les plats ».'
          : 'Tous vos plats sont déjà dans ce menu.');
      return;
    }
    final Dish? choisi = await showModalBottomSheet<Dish>(
      context: context,
      showDragHandle: true,
      builder: (contexteFeuille) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text(
                'Ajouter un plat au menu',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: EndirekColors.encre,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final Dish plat in disponibles)
                    ListTile(
                      leading: const Icon(
                        Icons.restaurant_outlined,
                        color: EndirekColors.bleu,
                      ),
                      title: Text(
                        plat.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14.5),
                      ),
                      subtitle: switch (formaterLignePrixPlat(
                        aEmporterCents: plat.priceTakeawayCents,
                        surPlaceCents: plat.priceDineInCents,
                      )) {
                        final String ligne => Text(
                            ligne,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12),
                          ),
                        null => null,
                      },
                      onTap: () => Navigator.of(contexteFeuille).pop(plat),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (choisi == null || !mounted) {
      return;
    }
    setState(() => _editions[jour.date] = [...selection, choisi.id]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Enregistrement
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _enregistrer(
    MenuDay jour,
    List<String> selection,
    List<String> serveur,
  ) async {
    // Enregistrer une liste vide SUPPRIME le menu du jour : confirmation.
    if (selection.isEmpty && serveur.isNotEmpty) {
      final bool? confirme = await showDialog<bool>(
        context: context,
        builder: (contexteDialogue) => AlertDialog(
          title: const Text('Supprimer le menu du jour ?'),
          content: Text(
            'Le menu du ${_libelleJour(jour).toLowerCase()} sera supprimé.',
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
    }
    setState(() => _enregistrement = true);
    try {
      await ref
          .read(pagesRepositoryProvider)
          .definirMenuDuJour(widget.pageId, jour.date, selection);
      // Écran quitté pendant la requête : ref inutilisable, le provider
      // autoDispose rechargera au prochain montage.
      if (!mounted) {
        return;
      }
      // Ne lève l'édition locale QUE si elle n'a pas bougé pendant la
      // requête : une retouche faite pendant le spinner reste affichée
      // (et le jour reste marqué « modifié » face à l'état enregistré).
      final List<String> courante = _editions[jour.date] ?? selection;
      if (_listesIdentiques(courante, selection)) {
        _editions.remove(jour.date);
      }
      ref.invalidate(menusDePageProvider(widget.pageId));
      _snack(selection.isEmpty
          ? 'Menu du jour supprimé'
          : 'Menu du jour enregistré');
    } on ApiException catch (erreur) {
      if (mounted) {
        _snack(erreur.message);
      }
    } finally {
      if (mounted) {
        setState(() => _enregistrement = false);
      }
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  /// « Lundi 14 juil. » — titre du jour sélectionné.
  static String _libelleJour(MenuDay jour) {
    final DateTime date = jour.dateLocale;
    return '${joursSemaine[date.weekday - 1]} ${date.day} '
        '${moisAbreges[date.month - 1]}';
  }

  static bool _listesIdentiques(List<String> a, List<String> b) {
    if (a.length != b.length) {
      return false;
    }
    for (int i = 0; i < a.length; i++) {
      if (a[i] != b[i]) {
        return false;
      }
    }
    return true;
  }
}

/// Chip d'un jour du sélecteur (« Lun 14 »), bleu quand sélectionné, point
/// orange quand des modifications locales ne sont pas enregistrées.
class _ChipJour extends StatelessWidget {
  const _ChipJour({
    required this.jour,
    required this.actif,
    required this.modifie,
    required this.surTap,
  });

  final MenuDay jour;
  final bool actif;
  final bool modifie;
  final VoidCallback surTap;

  @override
  Widget build(BuildContext context) {
    final DateTime date = jour.dateLocale;
    return InkWell(
      onTap: surTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: actif ? EndirekColors.bleu : EndirekColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: actif ? EndirekColors.bleu : EndirekColors.bordure,
          ),
        ),
        child: Column(
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  joursAbreges[date.weekday - 1],
                  style: TextStyle(
                    color: actif ? Colors.white : EndirekColors.encre,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (modifie) ...[
                  const SizedBox(width: 4),
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF97316),
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
            Text(
              '${date.day}',
              style: TextStyle(
                color: actif ? Colors.white : EndirekColors.encreSecondaire,
                fontSize: 12.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tuile d'un plat du menu en cours de composition : position, nom, prix,
/// retrait, poignée de réordonnancement.
class _TuilePlatMenu extends StatelessWidget {
  const _TuilePlatMenu({
    super.key,
    required this.index,
    required this.plat,
    required this.surRetirer,
  });

  final int index;

  /// Null si le plat n'est plus résoluble (bibliothèque en cours de
  /// rafraîchissement) — la tuile reste retirable.
  final Dish? plat;

  final VoidCallback surRetirer;

  @override
  Widget build(BuildContext context) {
    final String? lignePrix = plat == null
        ? null
        : formaterLignePrixPlat(
            aEmporterCents: plat!.priceTakeawayCents,
            surPlaceCents: plat!.priceDineInCents,
          );
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          children: [
            Container(
              width: 26,
              height: 26,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: EndirekColors.bleu.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Text(
                '${index + 1}',
                style: const TextStyle(
                  color: EndirekColors.bleu,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    plat?.name ?? 'Plat indisponible',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (lignePrix != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      lignePrix,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            IconButton(
              tooltip: 'Retirer du menu',
              onPressed: surRetirer,
              icon: const Icon(
                Icons.delete_outline,
                size: 20,
                color: Color(0xFFB3261E),
              ),
            ),
            ReorderableDragStartListener(
              index: index,
              child: const Padding(
                padding: EdgeInsets.all(6),
                child: Icon(
                  Icons.drag_handle,
                  size: 20,
                  color: EndirekColors.encreSecondaire,
                ),
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

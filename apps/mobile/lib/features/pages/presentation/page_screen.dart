import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/config/api_config.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../feed/application/posts_liste_controller.dart';
import '../../feed/presentation/widgets/avatar_rond.dart';
import '../../feed/presentation/widgets/post_card.dart';
import '../../post_detail/presentation/widgets/report_dialog.dart';
import '../application/pages_providers.dart';
import '../data/pages_repository.dart';
import '../domain/formatage_pages.dart';
import '../domain/page_models.dart';
import 'widgets/badge_verifie.dart';
import 'widgets/carte_plat.dart';
import 'widgets/chip_statut_ouverture.dart';
import 'widgets/horaires_bottom_sheet.dart';

/// Écran PUBLIC d'une page restaurant/entreprise (/pages/:id — mockup 08) :
/// couverture + avatar chevauchant, nom + coche vérifiée, statut d'ouverture
/// dérivé (OUVERT / FERMÉ / EN CONGÉS) + horaires en bottom sheet, bio et
/// attributs, actions Suivre / Message / Itinéraire, puis les sections
/// « Menus de la semaine » et « Nos cartes » (restaurants), « Offres en
/// cours », « Événements à venir » et « Publications » (3 dernières,
/// « Voir tout » → /pages/:id/posts).
///
/// Propriétaire : bouton « Gérer la page » (→ hub /pages/:id/gerer) et FAB
/// « Publier » (bottom sheet 4 choix : libre / menu / offre / événement).
class PageScreen extends ConsumerStatefulWidget {
  const PageScreen({super.key, required this.pageId});

  final String pageId;

  @override
  ConsumerState<PageScreen> createState() => _PageScreenState();
}

class _PageScreenState extends ConsumerState<PageScreen> {
  /// Overrides OPTIMISTES du suivi (annulés à chaque rafraîchissement) :
  /// l'état affiché bascule immédiatement, l'API confirme ensuite.
  bool? _suiviLocal;
  int _deltaAbonnes = 0;
  bool _basculeSuiviEnCours = false;

  @override
  Widget build(BuildContext context) {
    final AsyncValue<PageDetail> etat =
        ref.watch(pageDetailProvider(widget.pageId));
    final PageDetail? page = etat.value;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(
          page?.name ?? 'Page',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          // Signalement (CP2.5) — réservé aux visiteurs (pas au propriétaire).
          if (page != null && !page.isOwner)
            PopupMenuButton<String>(
              tooltip: 'Plus d\'options',
              onSelected: (choix) => _surMenu(choix, page),
              itemBuilder: (context) => [
                const PopupMenuItem(
                  value: 'signaler',
                  child: Text('Signaler la page'),
                ),
              ],
            ),
        ],
      ),
      floatingActionButton: (page != null && page.isOwner)
          ? FloatingActionButton.extended(
              onPressed: () => _ouvrirPublication(page),
              icon: const Icon(Icons.add),
              label: const Text('Publier'),
            )
          : null,
      body: SafeArea(
        top: false,
        child: switch (etat) {
          AsyncData(:final value) => RefreshIndicator(
              onRefresh: _rafraichir,
              child: _contenu(value),
            ),
          AsyncError(:final error) => _Erreur(
              message: _messageErreur(error),
              surReessayer: () =>
                  ref.invalidate(pageDetailProvider(widget.pageId)),
            ),
          _ => const Center(child: CircularProgressIndicator()),
        },
      ),
    );
  }

  Future<void> _rafraichir() async {
    setState(() {
      _suiviLocal = null;
      _deltaAbonnes = 0;
    });
    ref.invalidate(menusDePageProvider(widget.pageId));
    ref.invalidate(offresDePageProvider(widget.pageId));
    ref.invalidate(evenementsDePageProvider(widget.pageId));
    ref.invalidate(apercuPostsDePageProvider(widget.pageId));
    ref.invalidate(pageDetailProvider(widget.pageId));
    // Attend la fin du rechargement principal pour l'indicateur de tirage ;
    // une erreur éventuelle est déjà rendue par le switch du build.
    try {
      await ref.read(pageDetailProvider(widget.pageId).future);
    } catch (_) {}
  }

  Widget _contenu(PageDetail page) {
    final bool suivi = _suiviLocal ?? page.myFollow;
    final int abonnes = page.followersCount + _deltaAbonnes;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 96),
      children: [
        _EnTetePage(page: page),
        Padding(
          padding: const EdgeInsets.fromLTRB(124, 10, 16, 0),
          child: _BlocIdentite(page: page, abonnes: abonnes),
        ),
        const SizedBox(height: 14),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _LigneStatut(
            page: page,
            surVoirHoraires: () => montrerHorairesPage(context, page.hours),
          ),
        ),
        if (page.bio.isNotEmpty) ...[
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              page.bio,
              style: const TextStyle(
                color: EndirekColors.encre,
                fontSize: 14.5,
                height: 1.4,
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _ChipsAttributs(page: page),
        ),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: page.isOwner
              ? _ActionsProprietaire(
                  surGerer: () =>
                      context.push('/pages/${page.id}/gerer'),
                )
              : _ActionsVisiteur(
                  suivi: suivi,
                  aItineraire: page.location != null,
                  surSuivre: () => _basculerSuivi(page),
                  surMessage: () =>
                      context.push('/pages/${page.id}/contact'),
                  surItineraire: () => _ouvrirItineraire(page),
                ),
        ),
        if (page.estRestaurant) ...[
          const SizedBox(height: 24),
          _SectionMenus(pageId: page.id),
          if (page.documents.isNotEmpty) ...[
            const SizedBox(height: 24),
            _SectionCartes(
              documents: page.documents,
              surOuvrir: _ouvrirLienExterne,
            ),
          ],
        ],
        const SizedBox(height: 24),
        _SectionOffres(pageId: page.id),
        _SectionEvenements(pageId: page.id),
        _SectionPublications(pageId: page.id),
      ],
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // Actions
  // ───────────────────────────────────────────────────────────────────────

  /// Bascule Suivre/Abonné avec mise à jour OPTIMISTE du compteur (revert +
  /// snackbar si l'API refuse).
  Future<void> _basculerSuivi(PageDetail page) async {
    if (_basculeSuiviEnCours) {
      return;
    }
    final bool avant = _suiviLocal ?? page.myFollow;
    final bool apres = !avant;
    setState(() {
      _basculeSuiviEnCours = true;
      _suiviLocal = apres;
      _deltaAbonnes += apres ? 1 : -1;
    });
    try {
      final PagesRepository repo = ref.read(pagesRepositoryProvider);
      if (apres) {
        await repo.suivrePage(page.id);
      } else {
        await repo.nePlusSuivrePage(page.id);
      }
    } on ApiException catch (erreur) {
      if (mounted) {
        setState(() {
          _suiviLocal = avant;
          _deltaAbonnes += apres ? -1 : 1;
        });
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erreur.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _basculeSuiviEnCours = false);
      }
    }
  }

  /// Itinéraire : application cartographique native (geo:) avec repli sur
  /// Google Maps web si aucune app ne gère le schéma geo.
  Future<void> _ouvrirItineraire(PageDetail page) async {
    final location = page.location;
    if (location == null) {
      return;
    }
    final String etiquette = Uri.encodeComponent(page.name);
    final Uri geo = Uri.parse(
      'geo:${location.lat},${location.lng}'
      '?q=${location.lat},${location.lng}($etiquette)',
    );
    try {
      if (await launchUrl(geo, mode: LaunchMode.externalApplication)) {
        return;
      }
    } catch (_) {
      // Schéma geo: non géré (web/desktop) : on retombe sur l'URL https.
    }
    final Uri web = Uri.parse(
      'https://www.google.com/maps/search/?api=1'
      '&query=${location.lat},${location.lng}',
    );
    try {
      await launchUrl(web, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Impossible d\'ouvrir l\'itinéraire.')),
        );
      }
    }
  }

  /// Ouvre un document (PDF « Nos cartes ») dans l'application externe.
  Future<void> _ouvrirLienExterne(String url) async {
    final Uri uri = Uri.parse(ApiConfig.resolveMediaUrl(url));
    try {
      final bool ouvert =
          await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ouvert && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Impossible d\'ouvrir le document.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Impossible d\'ouvrir le document.')),
        );
      }
    }
  }

  /// Menu ⋮ — signalement de page (réutilise le dialogue paramétré CP2.5).
  Future<void> _surMenu(String choix, PageDetail page) async {
    switch (choix) {
      case 'signaler':
        final bool envoye = await montrerDialogSignalement(
          context,
          titre: 'Signaler cette page',
          envoyer: ({required String reasonCode, String? message}) =>
              ref.read(pagesRepositoryProvider).signalerPage(
                    page.id,
                    reasonCode: reasonCode,
                    message: message,
                  ),
        );
        if (envoye && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text(messageSignalementEnvoye)),
          );
        }
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Publication au nom de la page (propriétaire)
  // ───────────────────────────────────────────────────────────────────────

  /// Bottom sheet « Publier » : publication libre, menu du jour
  /// (restaurant), offre, événement.
  Future<void> _ouvrirPublication(PageDetail page) async {
    final String? choix = await showModalBottomSheet<String>(
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
                'Publier au nom de la page',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: EndirekColors.encre,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            _ChoixPublication(
              icone: Icons.edit_outlined,
              titre: 'Publication libre',
              sousTitre: 'Texte et photos, comme une publication classique.',
              surTap: () => Navigator.of(contexteFeuille).pop('free'),
            ),
            if (page.estRestaurant)
              _ChoixPublication(
                icone: Icons.restaurant_outlined,
                titre: 'Menu du jour',
                sousTitre:
                    'Composée automatiquement à partir du menu d\'aujourd\'hui.',
                surTap: () => Navigator.of(contexteFeuille).pop('menu'),
              ),
            _ChoixPublication(
              icone: Icons.local_offer_outlined,
              titre: 'Offre',
              sousTitre: 'Mettez en avant une de vos offres en cours.',
              surTap: () => Navigator.of(contexteFeuille).pop('offer'),
            ),
            _ChoixPublication(
              icone: Icons.event_outlined,
              titre: 'Événement',
              sousTitre: 'Annoncez un événement à venir.',
              surTap: () => Navigator.of(contexteFeuille).pop('event'),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (choix == null || !mounted) {
      return;
    }
    switch (choix) {
      case 'free':
        final bool? publie =
            await context.push<bool>('/pages/${page.id}/publier');
        if (publie == true && mounted) {
          _confirmerPublication();
        }
      case 'menu':
        await _publierMenuDuJour(page);
      case 'offer':
        await _publierOffre(page);
      case 'event':
        await _publierEvenement(page);
    }
  }

  /// Publie le MENU DU JOUR (confirmation puis POST kind=menu — le 400
  /// « Aucun menu programmé pour aujourd'hui » s'affiche en snackbar).
  Future<void> _publierMenuDuJour(PageDetail page) async {
    final bool? confirme = await showDialog<bool>(
      context: context,
      builder: (contexteDialogue) => AlertDialog(
        title: const Text('Publier le menu du jour ?'),
        content: const Text(
          'La publication sera composée automatiquement à partir du menu '
          'programmé pour aujourd\'hui.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contexteDialogue).pop(false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.of(contexteDialogue).pop(true),
            child: const Text('Publier'),
          ),
        ],
      ),
    );
    if (confirme != true || !mounted) {
      return;
    }
    await _publier(page, kind: 'menu');
  }

  /// Publie une OFFRE : choix parmi les offres EN COURS puis POST kind=offer.
  Future<void> _publierOffre(PageDetail page) async {
    final List<PageOffer> offres;
    try {
      offres = await ref.read(offresDePageProvider(page.id).future);
    } catch (erreur) {
      _snack(erreur.toString());
      return;
    }
    if (!mounted) {
      return;
    }
    if (offres.isEmpty) {
      _snack('Aucune offre en cours à publier. Créez-en une depuis '
          '« Gérer la page ».');
      return;
    }
    final PageOffer? choisie = await _choisirDansListe<PageOffer>(
      titre: 'Choisir l\'offre à publier',
      elements: offres,
      icone: Icons.local_offer_outlined,
      libelle: (offre) => offre.title,
    );
    if (choisie == null || !mounted) {
      return;
    }
    await _publier(page, kind: 'offer', offerId: choisie.id);
  }

  /// Publie un ÉVÉNEMENT : choix parmi les événements à venir/en cours puis
  /// POST kind=event.
  Future<void> _publierEvenement(PageDetail page) async {
    final List<PageEvent> evenements;
    try {
      evenements = await ref.read(evenementsDePageProvider(page.id).future);
    } catch (erreur) {
      _snack(erreur.toString());
      return;
    }
    if (!mounted) {
      return;
    }
    if (evenements.isEmpty) {
      _snack('Aucun événement à venir à publier. Créez-en un depuis '
          '« Gérer la page ».');
      return;
    }
    final PageEvent? choisi = await _choisirDansListe<PageEvent>(
      titre: 'Choisir l\'événement à publier',
      elements: evenements,
      icone: Icons.event_outlined,
      libelle: (evenement) =>
          '${evenement.title} — ${formaterDateEvenement(evenement.startsAt)}',
    );
    if (choisi == null || !mounted) {
      return;
    }
    await _publier(page, kind: 'event', eventId: choisi.id);
  }

  /// Bottom sheet générique de choix dans une liste (offres/événements).
  Future<T?> _choisirDansListe<T>({
    required String titre,
    required List<T> elements,
    required IconData icone,
    required String Function(T) libelle,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      showDragHandle: true,
      builder: (contexteFeuille) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text(
                titre,
                textAlign: TextAlign.center,
                style: const TextStyle(
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
                  for (final T element in elements)
                    ListTile(
                      leading: Icon(icone, color: EndirekColors.bleu),
                      title: Text(
                        libelle(element),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14.5),
                      ),
                      onTap: () => Navigator.of(contexteFeuille).pop(element),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  /// POST /pages/:id/posts + confirmation (snackbar, sections rafraîchies).
  Future<void> _publier(
    PageDetail page, {
    required String kind,
    String? offerId,
    String? eventId,
  }) async {
    try {
      await ref.read(pagesRepositoryProvider).publierPostDePage(
            page.id,
            kind: kind,
            offerId: offerId,
            eventId: eventId,
          );
      if (mounted) {
        _confirmerPublication();
      }
    } on ApiException catch (erreur) {
      // Inclut le 400 « Aucun menu programmé pour aujourd'hui ».
      if (mounted) {
        _snack(erreur.message);
      }
    }
  }

  /// Après une publication réussie : snackbar + rafraîchit l'aperçu des
  /// publications de la page et le fil d'accueil.
  void _confirmerPublication() {
    ref.invalidate(apercuPostsDePageProvider(widget.pageId));
    ref.read(feedProvider.notifier).rafraichir();
    _snack('Votre publication est en ligne');
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  static String _messageErreur(Object error) {
    // ApiException.toString() renvoie déjà le message français affichable.
    final String message = error.toString();
    return message.isEmpty ? 'Page introuvable.' : message;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// En-tête (couverture, avatar, identité, statut, attributs, actions)
// ─────────────────────────────────────────────────────────────────────────

/// Couverture + avatar rond qui chevauche (mockup 08 : avatar à gauche).
class _EnTetePage extends StatelessWidget {
  const _EnTetePage({required this.page});

  final PageDetail page;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        SizedBox(
          height: 160,
          width: double.infinity,
          child: (page.coverUrl != null && page.coverUrl!.isNotEmpty)
              ? Image.network(
                  ApiConfig.resolveMediaUrl(page.coverUrl!),
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => const _CouvertureParDefaut(),
                )
              : const _CouvertureParDefaut(),
        ),
        Positioned(
          left: 16,
          bottom: -40,
          child: Container(
            padding: const EdgeInsets.all(4),
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            child: AvatarRond(
              initiales: page.initiales,
              avatarUrl: page.avatarUrl,
              rayon: 42,
            ),
          ),
        ),
      ],
    );
  }
}

class _CouvertureParDefaut extends StatelessWidget {
  const _CouvertureParDefaut();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [EndirekColors.bleu, Color(0xFF63A9E8)],
        ),
      ),
    );
  }
}

/// Nom + coche vérifiée, « Page · Restaurant », « N abonnés » (à droite de
/// l'avatar chevauchant).
class _BlocIdentite extends StatelessWidget {
  const _BlocIdentite({required this.page, required this.abonnes});

  final PageDetail page;
  final int abonnes;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Flexible(
              child: Text(
                page.name,
                maxLines: 2,
                style: const TextStyle(
                  color: EndirekColors.encre,
                  fontSize: 21,
                  fontWeight: FontWeight.w800,
                  height: 1.15,
                ),
              ),
            ),
            if (page.verified) ...[
              const SizedBox(width: 6),
              const BadgeVerifie(taille: 20),
            ],
          ],
        ),
        const SizedBox(height: 3),
        Text(
          'Page · ${page.libelleType}',
          style: const TextStyle(
            color: EndirekColors.encreSecondaire,
            fontSize: 13.5,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          abonnes > 1 ? '$abonnes abonnés' : '$abonnes abonné',
          style: const TextStyle(
            color: EndirekColors.encre,
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (page.status == 'hidden') ...[
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: const Color(0xFFFDECEA),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Text(
              'Masquée par la modération',
              style: TextStyle(
                color: Color(0xFFB3261E),
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Statut dérivé + « Voir les horaires », et le message de congés éventuel.
class _LigneStatut extends StatelessWidget {
  const _LigneStatut({required this.page, required this.surVoirHoraires});

  final PageDetail page;
  final VoidCallback surVoirHoraires;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Flexible(
              child: ChipStatutOuverture(
                statut: page.openStatus,
                detaille: true,
              ),
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: surVoirHoraires,
              icon: const Icon(Icons.schedule, size: 18),
              label: const Text('Voir les horaires'),
            ),
          ],
        ),
        if (page.openStatus.enConges &&
            page.openStatus.vacationMessage != null &&
            page.openStatus.vacationMessage!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              page.openStatus.vacationMessage!,
              style: const TextStyle(
                color: Color(0xFFB45309),
                fontSize: 13,
                height: 1.35,
              ),
            ),
          ),
      ],
    );
  }
}

/// Chips d'attributs (Créole, Sur place…) + chip commune (icône lieu).
class _ChipsAttributs extends StatelessWidget {
  const _ChipsAttributs({required this.page});

  final PageDetail page;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final String attribut in page.attributes)
          _Chip(libelle: attribut),
        _Chip(libelle: page.city, icone: Icons.place_outlined),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.libelle, this.icone});

  final String libelle;
  final IconData? icone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: EndirekColors.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: EndirekColors.bordure),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icone != null) ...[
            Icon(icone, size: 15, color: EndirekColors.bleu),
            const SizedBox(width: 4),
          ],
          Text(
            libelle,
            style: const TextStyle(
              color: EndirekColors.encre,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Rangée d'actions du VISITEUR : Suivre/Abonné, Message, Itinéraire.
class _ActionsVisiteur extends StatelessWidget {
  const _ActionsVisiteur({
    required this.suivi,
    required this.aItineraire,
    required this.surSuivre,
    required this.surMessage,
    required this.surItineraire,
  });

  final bool suivi;
  final bool aItineraire;
  final VoidCallback surSuivre;
  final VoidCallback surMessage;
  final VoidCallback surItineraire;

  static const TextStyle _texteBouton =
      TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600);

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: suivi
              ? OutlinedButton.icon(
                  onPressed: surSuivre,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 46),
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    textStyle: _texteBouton,
                    foregroundColor: EndirekColors.bleu,
                    side: const BorderSide(color: EndirekColors.bleu),
                  ),
                  icon: const Icon(Icons.check, size: 17),
                  label: const Text('Abonné'),
                )
              : FilledButton.icon(
                  onPressed: surSuivre,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 46),
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    textStyle: _texteBouton,
                  ),
                  icon: const Icon(Icons.add, size: 17),
                  label: const Text('Suivre'),
                ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: surMessage,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 46),
              padding: const EdgeInsets.symmetric(horizontal: 6),
              textStyle: _texteBouton,
            ),
            icon: const Icon(Icons.chat_bubble_outline, size: 17),
            label: const Text('Message'),
          ),
        ),
        if (aItineraire) ...[
          const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: surItineraire,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 46),
                padding: const EdgeInsets.symmetric(horizontal: 6),
                textStyle: _texteBouton,
              ),
              icon: const Icon(Icons.near_me_outlined, size: 17),
              label: const Text('Itinéraire'),
            ),
          ),
        ],
      ],
    );
  }
}

/// Action du PROPRIÉTAIRE : « Gérer la page » (le FAB « Publier » est porté
/// par le Scaffold).
class _ActionsProprietaire extends StatelessWidget {
  const _ActionsProprietaire({required this.surGerer});

  final VoidCallback surGerer;

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: surGerer,
      icon: const Icon(Icons.settings_outlined, size: 20),
      label: const Text('Gérer la page'),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────

/// Titre de section (18/w800, comme le détail d'annonce).
class _TitreSection extends StatelessWidget {
  const _TitreSection(this.titre, {this.action});

  final String titre;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              titre,
              style: const TextStyle(
                color: EndirekColors.encre,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          ?action,
        ],
      ),
    );
  }
}

/// Section « Menus de la semaine » (restaurant) : sélecteur horizontal des
/// 7 jours glissants (« Lun 14 »…) + plats du jour sélectionné.
class _SectionMenus extends ConsumerStatefulWidget {
  const _SectionMenus({required this.pageId});

  final String pageId;

  @override
  ConsumerState<_SectionMenus> createState() => _SectionMenusState();
}

class _SectionMenusState extends ConsumerState<_SectionMenus> {
  int _jourSelectionne = 0;

  @override
  Widget build(BuildContext context) {
    final AsyncValue<List<MenuDay>> menus =
        ref.watch(menusDePageProvider(widget.pageId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _TitreSection('Menus de la semaine'),
        switch (menus) {
          AsyncData(:final value) => _contenu(value),
          AsyncError() => _ErreurSection(
              message: 'Impossible de charger les menus.',
              surReessayer: () =>
                  ref.invalidate(menusDePageProvider(widget.pageId)),
            ),
          _ => const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: LinearProgressIndicator(minHeight: 2),
            ),
        },
      ],
    );
  }

  Widget _contenu(List<MenuDay> jours) {
    if (jours.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(horizontal: 16),
        child: Text(
          'Pas de menu programmé cette semaine.',
          style: TextStyle(
            color: EndirekColors.encreSecondaire,
            fontSize: 13.5,
          ),
        ),
      );
    }
    final int index = _jourSelectionne.clamp(0, jours.length - 1);
    final MenuDay jour = jours[index];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              for (final (int i, MenuDay element) in jours.indexed) ...[
                _ChipJour(
                  jour: element,
                  actif: i == index,
                  surTap: () => setState(() => _jourSelectionne = i),
                ),
                if (i < jours.length - 1) const SizedBox(width: 8),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: jour.estVide
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'Pas de menu ce jour-là.',
                    style: TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 13.5,
                    ),
                  ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final plat in jour.items) CartePlat(plat: plat),
                    const Text(
                      'Les prix peuvent varier selon les options et la saison.',
                      style: TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                ),
        ),
      ],
    );
  }
}

/// Chip d'un jour du sélecteur (« Lun 14 »), bleu quand sélectionné.
class _ChipJour extends StatelessWidget {
  const _ChipJour({
    required this.jour,
    required this.actif,
    required this.surTap,
  });

  final MenuDay jour;
  final bool actif;
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
            Text(
              joursAbreges[date.weekday - 1],
              style: TextStyle(
                color: actif ? Colors.white : EndirekColors.encre,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
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

/// Section « Nos cartes » : documents PDF de la page, boutons ouvrir /
/// télécharger (url_launcher, application externe).
class _SectionCartes extends StatelessWidget {
  const _SectionCartes({required this.documents, required this.surOuvrir});

  final List<PageDocumentView> documents;
  final ValueChanged<String> surOuvrir;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _TitreSection('Nos cartes'),
        for (final PageDocumentView document in documents)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: _LigneDocument(document: document, surOuvrir: surOuvrir),
          ),
      ],
    );
  }
}

/// Ligne d'un document : icône PDF, libellé, « PDF · 1,2 Mo », actions.
class _LigneDocument extends StatelessWidget {
  const _LigneDocument({required this.document, required this.surOuvrir});

  final PageDocumentView document;
  final ValueChanged<String> surOuvrir;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: EndirekColors.bordure),
      ),
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
            tooltip: 'Ouvrir',
            onPressed: () => surOuvrir(document.url),
            icon: const Icon(
              Icons.open_in_new,
              size: 20,
              color: EndirekColors.bleu,
            ),
          ),
          IconButton(
            tooltip: 'Télécharger',
            onPressed: () => surOuvrir(document.url),
            icon: const Icon(
              Icons.download_outlined,
              size: 20,
              color: EndirekColors.bleu,
            ),
          ),
        ],
      ),
    );
  }
}

/// Section « Offres en cours » (masquée si aucune offre).
class _SectionOffres extends ConsumerWidget {
  const _SectionOffres({required this.pageId});

  final String pageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<PageOffer>> offres =
        ref.watch(offresDePageProvider(pageId));
    final List<PageOffer>? valeur = offres.value;
    if (valeur == null || valeur.isEmpty) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _TitreSection('Offres en cours'),
        for (final PageOffer offre in valeur)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: _CarteOffre(offre: offre),
          ),
        const SizedBox(height: 14),
      ],
    );
  }
}

/// Carte d'une offre : badge période, titre, description, image éventuelle.
class _CarteOffre extends StatelessWidget {
  const _CarteOffre({required this.offre});

  final PageOffer offre;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: EndirekColors.bordure),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (offre.imageUrl != null && offre.imageUrl!.isNotEmpty)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(
                ApiConfig.resolveMediaUrl(offre.imageUrl!),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const ColoredBox(
                  color: EndirekColors.surface,
                  child: Icon(
                    Icons.broken_image_outlined,
                    color: EndirekColors.encreSecondaire,
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _BadgePeriode(
                  texte: libellePeriodeOffre(offre),
                  couleur: const Color(0xFFD97706),
                  fond: const Color(0xFFFEF3C7),
                ),
                const SizedBox(height: 8),
                Text(
                  offre.title,
                  style: const TextStyle(
                    color: EndirekColors.encre,
                    fontSize: 15.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (offre.description.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    offre.description,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 13.5,
                      height: 1.35,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Section « Événements à venir » (masquée si aucun événement).
class _SectionEvenements extends ConsumerWidget {
  const _SectionEvenements({required this.pageId});

  final String pageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<PageEvent>> evenements =
        ref.watch(evenementsDePageProvider(pageId));
    final List<PageEvent>? valeur = evenements.value;
    if (valeur == null || valeur.isEmpty) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _TitreSection('Événements à venir'),
        for (final PageEvent evenement in valeur)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: _CarteEvenement(evenement: evenement),
          ),
        const SizedBox(height: 14),
      ],
    );
  }
}

/// Carte d'un événement : date française, badge « En cours » si ongoing.
class _CarteEvenement extends StatelessWidget {
  const _CarteEvenement({required this.evenement});

  final PageEvent evenement;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: EndirekColors.bordure),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (evenement.imageUrl != null && evenement.imageUrl!.isNotEmpty)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(
                ApiConfig.resolveMediaUrl(evenement.imageUrl!),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const ColoredBox(
                  color: EndirekColors.surface,
                  child: Icon(
                    Icons.broken_image_outlined,
                    color: EndirekColors.encreSecondaire,
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.event_outlined,
                      size: 15,
                      color: Color(0xFFDB2777),
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        formaterDateEvenement(evenement.startsAt),
                        style: const TextStyle(
                          color: Color(0xFFDB2777),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (evenement.enCours)
                      const _BadgePeriode(
                        texte: 'En cours',
                        couleur: Color(0xFF16A34A),
                        fond: Color(0xFFE7F6EC),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  evenement.title,
                  style: const TextStyle(
                    color: EndirekColors.encre,
                    fontSize: 15.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (evenement.description.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    evenement.description,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 13.5,
                      height: 1.35,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Petit badge coloré arrondi (période d'offre, « En cours »...).
class _BadgePeriode extends StatelessWidget {
  const _BadgePeriode({
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

/// Section « Publications » : les 3 dernières publications de la page
/// (cartes du fil réutilisées) + « Voir tout » → /pages/:id/posts.
class _SectionPublications extends ConsumerWidget {
  const _SectionPublications({required this.pageId});

  final String pageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final etat = ref.watch(apercuPostsDePageProvider(pageId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TitreSection(
          'Publications',
          action: switch (etat) {
            AsyncData(:final value) when value.total > value.items.length =>
              TextButton(
                onPressed: () => context.push('/pages/$pageId/posts'),
                child: const Text('Voir tout'),
              ),
            _ => null,
          },
        ),
        switch (etat) {
          AsyncData(:final value) => value.items.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Aucune publication pour le moment.',
                    style: TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 13.5,
                    ),
                  ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final post in value.items) PostCard(post: post),
                  ],
                ),
          AsyncError() => _ErreurSection(
              message: 'Impossible de charger les publications.',
              surReessayer: () =>
                  ref.invalidate(apercuPostsDePageProvider(pageId)),
            ),
          _ => const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: LinearProgressIndicator(minHeight: 2),
            ),
        },
      ],
    );
  }
}

/// Erreur discrète d'une SECTION (la page reste utilisable).
class _ErreurSection extends StatelessWidget {
  const _ErreurSection({required this.message, required this.surReessayer});

  final String message;
  final VoidCallback surReessayer;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 13,
              ),
            ),
          ),
          TextButton(onPressed: surReessayer, child: const Text('Réessayer')),
        ],
      ),
    );
  }
}

/// Ligne de la bottom sheet « Publier » (icône ronde + titre + description).
class _ChoixPublication extends StatelessWidget {
  const _ChoixPublication({
    required this.icone,
    required this.titre,
    required this.sousTitre,
    required this.surTap,
  });

  final IconData icone;
  final String titre;
  final String sousTitre;
  final VoidCallback surTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: EndirekColors.bleu.withValues(alpha: 0.12),
          shape: BoxShape.circle,
        ),
        child: Icon(icone, size: 22, color: EndirekColors.bleu),
      ),
      title: Text(
        titre,
        style: const TextStyle(
          color: EndirekColors.encre,
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Text(
        sousTitre,
        style: const TextStyle(
          color: EndirekColors.encreSecondaire,
          fontSize: 12.5,
        ),
      ),
      onTap: surTap,
    );
  }
}

/// Écran d'erreur plein écran (404 page invisible, panne réseau).
class _Erreur extends StatelessWidget {
  const _Erreur({required this.message, required this.surReessayer});

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
            const Icon(
              Icons.storefront_outlined,
              size: 48,
              color: EndirekColors.encreSecondaire,
            ),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 14.5,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: surReessayer,
              icon: const Icon(Icons.refresh),
              label: const Text('Réessayer'),
            ),
          ],
        ),
      ),
    );
  }
}

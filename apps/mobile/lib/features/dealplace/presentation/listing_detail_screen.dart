import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/post_author.dart';
import '../../../core/api/models/post_media.dart';
import '../../../core/config/api_config.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../feed/presentation/widgets/avatar_rond.dart';
import '../application/listing_detail_provider.dart';
import '../domain/dealplace_value.dart';
import '../domain/listing.dart';
import 'widgets/badge_type_annonce.dart';

/// Écran de DÉTAIL d'une annonce (/dealplace/:id), fidèle au mockup 06
/// « Service proposé » : titre gras à gauche + auteur/date à droite, fil
/// « Catégorie > Sous-catégorie », « Valeur : X € » (ou fourchette), badge
/// bien/service, description, section « Liens externes » (puces), section
/// « Médias » (grille), bouton sticky pleine largeur bleu « Proposer un deal »
/// — PLACEHOLDER : un tap affiche « Disponible au prochain lot » (les deals
/// sont le checkpoint CP2.4).
class ListingDetailScreen extends ConsumerWidget {
  const ListingDetailScreen({super.key, required this.listingId});

  final String listingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<Listing> annonce =
        ref.watch(listingDetailProvider(listingId));

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: switch (annonce) {
          AsyncData(:final value) => Text(
              value.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          _ => const Text('Annonce'),
        },
      ),
      body: switch (annonce) {
        AsyncData(:final value) => _Contenu(annonce: value),
        AsyncError(:final error) => _Erreur(
            message: _messageErreur(error),
            surReessayer: () =>
                ref.invalidate(listingDetailProvider(listingId)),
          ),
        _ => const Center(child: CircularProgressIndicator()),
      },
    );
  }

  static String _messageErreur(Object error) {
    // ApiException.toString() renvoie déjà le message français affichable.
    final String message = error.toString();
    return message.isEmpty ? 'Annonce introuvable.' : message;
  }
}

class _Contenu extends StatelessWidget {
  const _Contenu({required this.annonce});

  final Listing annonce;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            children: [
              _EnTete(annonce: annonce),
              const SizedBox(height: 12),
              _FilAriane(annonce: annonce),
              const SizedBox(height: 10),
              _LigneValeur(annonce: annonce),
              const SizedBox(height: 20),
              const Divider(height: 1),
              const SizedBox(height: 20),
              Text(
                annonce.description,
                style: const TextStyle(
                  color: EndirekColors.encre,
                  fontSize: 15.5,
                  height: 1.5,
                ),
              ),
              if (annonce.exchangePrefs.isNotEmpty) ...[
                const SizedBox(height: 24),
                _SectionPreferences(prefs: annonce.exchangePrefs),
              ],
              if (annonce.externalLinks.isNotEmpty) ...[
                const SizedBox(height: 24),
                _SectionLiens(annonce: annonce),
              ],
              if (annonce.media.isNotEmpty) ...[
                const SizedBox(height: 24),
                _SectionMedias(media: annonce.media),
              ],
              if (annonce.tags.isNotEmpty) ...[
                const SizedBox(height: 24),
                _SectionTags(annonce: annonce),
              ],
            ],
          ),
        ),
        _BarreProposerDeal(),
      ],
    );
  }
}

/// En-tête : titre gras à gauche, auteur (avatar + nom + date) à droite,
/// comme le mockup 06.
class _EnTete extends StatelessWidget {
  const _EnTete({required this.annonce});

  final Listing annonce;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                annonce.title,
                style: const TextStyle(
                  color: EndirekColors.encre,
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  height: 1.15,
                ),
              ),
              const SizedBox(height: 10),
              BadgeTypeAnnonce(listingType: annonce.listingType),
            ],
          ),
        ),
        const SizedBox(width: 12),
        _Auteur(owner: annonce.owner, date: annonce.createdAt),
      ],
    );
  }
}

/// Bloc auteur : avatar + nom + date (dd/MM/yyyy), aligné à droite.
class _Auteur extends StatelessWidget {
  const _Auteur({required this.owner, required this.date});

  final PostAuthor owner;
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        AvatarRond(
          initiales: owner.initiales,
          avatarUrl: owner.avatarUrl,
          rayon: 24,
        ),
        const SizedBox(height: 6),
        SizedBox(
          width: 120,
          child: Text(
            owner.displayName,
            textAlign: TextAlign.end,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: EndirekColors.encre,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          _formaterDate(date),
          style: const TextStyle(
            color: EndirekColors.encreSecondaire,
            fontSize: 12.5,
          ),
        ),
      ],
    );
  }

  static String _formaterDate(DateTime date) {
    final DateTime local = date.toLocal();
    String deuxChiffres(int n) => n.toString().padLeft(2, '0');
    return '${deuxChiffres(local.day)}/${deuxChiffres(local.month)}/${local.year}';
  }
}

/// Fil d'ariane « Catégorie > Sous-catégorie » + commune.
class _FilAriane extends StatelessWidget {
  const _FilAriane({required this.annonce});

  final Listing annonce;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${annonce.category.labelFr} > ${annonce.subcategory.labelFr}',
          style: const TextStyle(
            color: EndirekColors.encreSecondaire,
            fontSize: 15,
            fontWeight: FontWeight.w500,
          ),
        ),
        if (annonce.city.isNotEmpty) ...[
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(
                Icons.place_outlined,
                size: 15,
                color: EndirekColors.encreSecondaire,
              ),
              const SizedBox(width: 3),
              Text(
                annonce.city,
                style: const TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// Ligne « Valeur : X € » en bleu (mockup 06).
class _LigneValeur extends StatelessWidget {
  const _LigneValeur({required this.annonce});

  final Listing annonce;

  @override
  Widget build(BuildContext context) {
    final String valeur = formaterValeurAnnonce(
      valueKind: annonce.valueKind,
      valueMin: annonce.valueMin,
      valueMax: annonce.valueMax,
      currency: annonce.currency,
    );
    return RichText(
      text: TextSpan(
        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
        children: [
          const TextSpan(
            text: 'Valeur : ',
            style: TextStyle(color: EndirekColors.encre),
          ),
          TextSpan(
            text: valeur,
            style: const TextStyle(color: EndirekColors.bleu),
          ),
        ],
      ),
    );
  }
}

/// En-tête de section réutilisable (titre gras).
class _TitreSection extends StatelessWidget {
  const _TitreSection(this.titre);

  final String titre;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        titre,
        style: const TextStyle(
          color: EndirekColors.encre,
          fontSize: 18,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

/// Préférences d'échange (goods/services/money/open) en puces lisibles.
class _SectionPreferences extends StatelessWidget {
  const _SectionPreferences({required this.prefs});

  final List<String> prefs;

  static const Map<String, String> _libelles = {
    'goods': 'Contre un bien',
    'services': 'Contre un service',
    'money': 'Contre de l\'argent',
    'open': 'Ouvert aux propositions',
  };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _TitreSection('Préférences d\'échange'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final p in prefs)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: EndirekColors.surface,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: EndirekColors.bordure),
                ),
                child: Text(
                  _libelles[p] ?? p,
                  style: const TextStyle(
                    color: EndirekColors.encre,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Section « Liens externes » : puces bleues avec icône de lien (mockup 06).
class _SectionLiens extends StatelessWidget {
  const _SectionLiens({required this.annonce});

  final Listing annonce;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _TitreSection('Liens externes'),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final lien in annonce.externalLinks)
              _PuceLien(label: lien.label, url: lien.url),
          ],
        ),
      ],
    );
  }
}

/// Puce d'un lien externe : icône chaîne + libellé, copie l'URL au tap (pas
/// d'ouverture de navigateur au CP2.1 — url_launcher n'est pas embarqué).
class _PuceLien extends StatelessWidget {
  const _PuceLien({required this.label, required this.url});

  final String label;
  final String url;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: EndirekColors.bleu,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: () async {
          await Clipboard.setData(ClipboardData(text: url));
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Lien copié dans le presse-papiers')),
            );
          }
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.link, size: 16, color: Colors.white),
              const SizedBox(width: 6),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 180),
                child: Text(
                  label.isEmpty ? url : label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Section « Médias » : grille d'images (mockup 06). Les images sont
/// résolues via resolveMediaUrl pour l'émulateur/appareil physique.
class _SectionMedias extends StatelessWidget {
  const _SectionMedias({required this.media});

  final List<PostMedia> media;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _TitreSection('Médias'),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.3,
          ),
          itemCount: media.length,
          itemBuilder: (context, index) {
            final PostMedia m = media[index];
            return ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                ApiConfig.resolveMediaUrl(m.thumbnailUrl ?? m.url),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const ColoredBox(
                  color: EndirekColors.surface,
                  child: Center(
                    child: Icon(
                      Icons.broken_image_outlined,
                      color: EndirekColors.bordure,
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

/// Section « Tags » : puces grises (slug → libellé).
class _SectionTags extends StatelessWidget {
  const _SectionTags({required this.annonce});

  final Listing annonce;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _TitreSection('Tags'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final t in annonce.tags)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: EndirekColors.surface,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  t.labelFr,
                  style: const TextStyle(
                    color: EndirekColors.encreSecondaire,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Barre sticky pleine largeur « Proposer un deal » (bouton bleu — mockup 06).
/// PLACEHOLDER : les deals sont le checkpoint CP2.4 → snackbar informatif.
class _BarreProposerDeal extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 8,
      shadowColor: Colors.black.withValues(alpha: 0.08),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: FilledButton.icon(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'Proposer un deal sera disponible au prochain lot.',
                  ),
                ),
              );
            },
            icon: const Icon(Icons.handshake_outlined),
            label: const Text('Proposer un deal'),
          ),
        ),
      ),
    );
  }
}

/// Écran d'erreur du détail (404 annonce introuvable, panne réseau).
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
              Icons.search_off_outlined,
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/api/models/feed_post.dart';
import '../../../../core/api/models/post_type.dart';
import '../../../../core/theme/endirek_theme.dart';
import '../../../../core/utils/temps_relatif.dart';
import '../../application/post_actions.dart';
import '../../application/referentiels_providers.dart';
import '../../domain/reactions_palette.dart';
import 'avatar_rond.dart';
import 'post_media_gallery.dart';
import 'reaction_picker.dart';
import 'type_visuel.dart';

/// Carte d'une publication dans le fil : en-tête auteur (avatar, nom, temps
/// relatif, ville) + pastille du type en haut à droite, image(s), titre
/// gras, corps, ligne des compteurs (emojis reactionsTop + total à gauche,
/// « N commentaires » à droite) et barre d'actions
/// J'aime / Commenter / Partager / Enregistrer.
class PostCard extends ConsumerWidget {
  const PostCard({super.key, required this.post});

  final FeedPost post;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final PostType? type = ref.watch(typesParSlugProvider)[post.typeSlug];

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: EndirekColors.bordure),
      ),
      child: InkWell(
        onTap: () => _ouvrirDetail(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
              child: _EnTeteAuteur(post: post, type: type),
            ),
            if (post.title != null && post.title!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
                child: Text(
                  post.title!,
                  style: const TextStyle(
                    color: EndirekColors.encre,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    height: 1.3,
                  ),
                ),
              ),
            if (post.body.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: Text(
                  post.body,
                  maxLines: 8,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: EndirekColors.encre,
                    fontSize: 14.5,
                    height: 1.35,
                  ),
                ),
              ),
            if (post.media.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: PostMediaGallery(media: post.media),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
              child: LigneCompteurs(post: post),
            ),
            const Divider(height: 1, indent: 12, endIndent: 12),
            PostActionsBar(
              post: post,
              surCommenter: () => _ouvrirDetail(context),
            ),
          ],
        ),
      ),
    );
  }

  void _ouvrirDetail(BuildContext context) {
    context.push('/post/${post.id}');
  }
}

/// En-tête : avatar + nom + « il y a X · Ville », pastille du type à droite.
class _EnTeteAuteur extends StatelessWidget {
  const _EnTeteAuteur({required this.post, required this.type});

  final FeedPost post;
  final PostType? type;

  @override
  Widget build(BuildContext context) {
    final String sousTitre = [
      tempsRelatif(post.createdAt),
      if (post.city != null && post.city!.isNotEmpty) post.city!,
    ].join(' · ');

    return Row(
      children: [
        AvatarRond(
          initiales: post.author.initiales,
          avatarUrl: post.author.avatarUrl,
          rayon: 20,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                post.author.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: EndirekColors.encre,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                sousTitre,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 12.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        // Icône colorée du type (référentiel post_types chargé une fois ;
        // repli générique tant que le référentiel n'est pas disponible).
        PastilleType(
          nomIcone: type?.icon ?? '',
          couleurHex: type?.color ?? '',
          tooltip: type?.labelFr,
        ),
      ],
    );
  }
}

/// Ligne des compteurs : emojis reactionsTop + total à gauche,
/// « N commentaires » à droite.
class LigneCompteurs extends StatelessWidget {
  const LigneCompteurs({super.key, required this.post});

  final FeedPost post;

  @override
  Widget build(BuildContext context) {
    const TextStyle style = TextStyle(
      color: EndirekColors.encreSecondaire,
      fontSize: 13,
    );
    return Row(
      children: [
        if (post.reactionCount > 0) ...[
          Text(
            post.reactionsTop.map((element) => element.emoji).join(),
            style: const TextStyle(fontSize: 14),
          ),
          const SizedBox(width: 5),
          Text('${post.reactionCount}', style: style),
        ],
        const Spacer(),
        Text(
          post.commentCount > 1
              ? '${post.commentCount} commentaires'
              : '${post.commentCount} commentaire',
          style: style,
        ),
      ],
    );
  }
}

/// Barre d'actions J'aime / Commenter / Partager / Enregistrer — partagée
/// entre la carte du fil et l'écran de détail.
///
/// - J'aime : TAP = bascule 👍 ; APPUI LONG = sélecteur des 6 emojis ;
/// - Partager : non branché au Lot 1 (compteur sharing côté API prêt) —
///   TODO(lot ultérieur) : partage natif (share_plus) + POST de comptage ;
/// - Enregistrer : bascule bookmark (collection par défaut « Général »).
class PostActionsBar extends ConsumerWidget {
  const PostActionsBar({
    super.key,
    required this.post,
    required this.surCommenter,
  });

  final FeedPost post;
  final VoidCallback surCommenter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final PostActions actions = ref.read(postActionsProvider);
    final bool aReagi = post.viewerReaction != null;

    return Row(
      children: [
        Expanded(
          child: _BoutonAction(
            libelle: aReagi ? labelReaction(post.viewerReaction!) : "J'aime",
            actif: aReagi,
            emoji: post.viewerReaction,
            icone: Icons.thumb_up_off_alt,
            surTap: () =>
                _executer(context, () => actions.basculerJaime(post)),
            surAppuiLong: () => _choisirReaction(context, actions),
          ),
        ),
        Expanded(
          child: _BoutonAction(
            libelle: 'Commenter',
            icone: Icons.mode_comment_outlined,
            surTap: surCommenter,
          ),
        ),
        Expanded(
          child: _BoutonAction(
            libelle: 'Partager',
            icone: Icons.share_outlined,
            surTap: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Partage disponible prochainement'),
              ),
            ),
          ),
        ),
        Expanded(
          child: _BoutonAction(
            libelle: post.viewerSaved ? 'Enregistré' : 'Enregistrer',
            actif: post.viewerSaved,
            icone: post.viewerSaved ? Icons.bookmark : Icons.bookmark_border,
            surTap: () => _executer(
              context,
              () => actions.basculerEnregistrement(post),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _choisirReaction(
    BuildContext context,
    PostActions actions,
  ) async {
    final String? emoji = await montrerSelecteurReaction(
      context,
      reactionActuelle: post.viewerReaction,
    );
    if (emoji == null || !context.mounted) {
      return;
    }
    await _executer(context, () => actions.reagir(post, emoji));
  }

  /// Exécute une action d'API et affiche son erreur en snackbar.
  Future<void> _executer(
    BuildContext context,
    Future<void> Function() action,
  ) async {
    try {
      await action();
    } on ApiException catch (erreur) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erreur.message)));
      }
    }
  }
}

class _BoutonAction extends StatelessWidget {
  const _BoutonAction({
    required this.libelle,
    required this.icone,
    required this.surTap,
    this.surAppuiLong,
    this.actif = false,
    this.emoji,
  });

  final String libelle;
  final IconData icone;
  final VoidCallback surTap;
  final VoidCallback? surAppuiLong;

  /// Met le bouton en évidence (réaction posée, post enregistré).
  final bool actif;

  /// Si non nul, remplace l'icône par cet emoji (réaction du viewer).
  final String? emoji;

  @override
  Widget build(BuildContext context) {
    final Color couleur =
        actif ? EndirekColors.bleu : EndirekColors.encreSecondaire;
    return InkWell(
      onTap: surTap,
      onLongPress: surAppuiLong,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (emoji != null)
              Text(emoji!, style: const TextStyle(fontSize: 16))
            else
              Icon(icone, size: 18, color: couleur),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                libelle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: couleur,
                  fontSize: 12.5,
                  fontWeight: actif ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

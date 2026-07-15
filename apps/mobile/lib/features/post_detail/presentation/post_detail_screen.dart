import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/feed_post.dart';
import '../../../core/api/models/post_comment.dart';
import '../../../core/api/models/post_page_ref.dart';
import '../../../core/api/models/post_type.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../../core/utils/temps_relatif.dart';
import '../../feed/application/referentiels_providers.dart';
import '../../pages/domain/types_posts_page.dart';
import '../../pages/presentation/widgets/badge_verifie.dart';
import '../../feed/presentation/widgets/avatar_rond.dart';
import '../../feed/presentation/widgets/post_card.dart'
    show LigneCompteurs, PostActionsBar;
import '../../feed/presentation/widgets/post_media_gallery.dart';
import '../../feed/presentation/widgets/reaction_picker.dart';
import '../../feed/presentation/widgets/type_visuel.dart';
import '../application/post_detail_controller.dart';
import 'widgets/edit_post_dialog.dart';
import 'widgets/report_dialog.dart';

/// Écran détail d'une publication (/post/:id) : média plein largeur, carte
/// type + lieu + temps + auteur, texte complet, barre réactions/compteurs,
/// commentaires paginés avec réponses indentées (niveau 1), champ « Écrire
/// un commentaire… » et menu ⋯ (Signaler ; Modifier/Supprimer si auteur).
class PostDetailScreen extends ConsumerStatefulWidget {
  const PostDetailScreen({super.key, required this.postId});

  final String postId;

  @override
  ConsumerState<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends ConsumerState<PostDetailScreen> {
  final TextEditingController _commentaireController = TextEditingController();
  final FocusNode _focusCommentaire = FocusNode();

  /// Commentaire RACINE auquel on répond (null : commentaire principal).
  PostComment? _reponseA;
  bool _envoiCommentaire = false;

  PostDetailController get _controleur =>
      ref.read(postDetailProvider(widget.postId).notifier);

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _controleur.charger());
  }

  @override
  void dispose() {
    _commentaireController.dispose();
    _focusCommentaire.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final PostDetailState etat = ref.watch(postDetailProvider(widget.postId));
    final AuthState auth = ref.watch(authControllerProvider);
    final String? monId = auth is AuthSignedIn ? auth.profile.id : null;
    final FeedPost? post = etat.post;
    final bool estAuteur = post != null && monId == post.author.id;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Publication'),
        actions: [
          if (post != null)
            PopupMenuButton<String>(
              tooltip: 'Plus d\'options',
              onSelected: (choix) => _surMenu(choix, post),
              itemBuilder: (context) => [
                if (estAuteur) ...[
                  const PopupMenuItem(
                    value: 'modifier',
                    child: Text('Modifier'),
                  ),
                  const PopupMenuItem(
                    value: 'supprimer',
                    child: Text(
                      'Supprimer',
                      style: TextStyle(color: couleurDanger),
                    ),
                  ),
                ] else
                  const PopupMenuItem(
                    value: 'signaler',
                    child: Text('Signaler'),
                  ),
              ],
            ),
        ],
      ),
      body: SafeArea(
        child: post == null
            ? _EtatSansPost(
                chargement: etat.chargementPost,
                erreur: etat.erreurPost,
                surReessayer: () => _controleur.charger(),
              )
            : Column(
                children: [
                  Expanded(
                    child: RefreshIndicator(
                      onRefresh: () => _controleur.rafraichir(),
                      child: _contenu(etat, post, monId),
                    ),
                  ),
                  _barreCommentaire(),
                ],
              ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Contenu
  // ─────────────────────────────────────────────────────────────────────────

  Widget _contenu(PostDetailState etat, FeedPost post, String? monId) {
    final PostType? type = ref.watch(typesParSlugProvider)[post.typeSlug];

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 16),
      children: [
        if (post.media.isNotEmpty) PostMediaGallery(media: post.media),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: _CarteInfos(post: post, type: type),
        ),
        if (post.title != null && post.title!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Text(
              post.title!,
              style: const TextStyle(
                color: EndirekColors.encre,
                fontSize: 19,
                fontWeight: FontWeight.w800,
                height: 1.3,
              ),
            ),
          ),
        if (post.body.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: Text(
              post.body,
              style: const TextStyle(
                color: EndirekColors.encre,
                fontSize: 15,
                height: 1.45,
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
          child: LigneCompteurs(post: post),
        ),
        const Divider(height: 1, indent: 12, endIndent: 12),
        // Barre d'actions commune avec le fil : les mises à jour sont
        // diffusées au fil ET à cet écran (PostActions).
        PostActionsBar(
          post: post,
          surCommenter: () => _focusCommentaire.requestFocus(),
        ),
        const Divider(thickness: 6, height: 6, color: EndirekColors.surface),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
          child: Text(
            post.commentCount > 0
                ? 'Commentaires (${post.commentCount})'
                : 'Commentaires',
            style: const TextStyle(
              color: EndirekColors.encre,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        ..._sectionCommentaires(etat, post, monId),
      ],
    );
  }

  List<Widget> _sectionCommentaires(
    PostDetailState etat,
    FeedPost post,
    String? monId,
  ) {
    if (etat.chargementCommentaires && !etat.commentairesInitialises) {
      return const [
        Padding(
          padding: EdgeInsets.symmetric(vertical: 24),
          child: Center(child: CircularProgressIndicator()),
        ),
      ];
    }
    if (etat.commentairesInitialises && etat.commentaires.isEmpty) {
      return const [
        Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Text(
            'Aucun commentaire pour le moment. Lancez la discussion !',
            style: TextStyle(
              color: EndirekColors.encreSecondaire,
              fontSize: 13.5,
            ),
          ),
        ),
      ];
    }
    return [
      for (final PostComment racine in etat.commentaires) ...[
        _CommentaireTuile(
          commentaire: racine,
          estReponse: false,
          peutSupprimer: !racine.isDeleted &&
              monId != null &&
              (monId == racine.author.id || monId == post.author.id),
          surRepondre: racine.isDeleted
              ? null
              : () {
                  setState(() => _reponseA = racine);
                  _focusCommentaire.requestFocus();
                },
          surJaime: () => _executer(
            () => _controleur.reagirAuCommentaire(racine),
          ),
          surChoisirReaction: () => _choisirReactionCommentaire(racine),
          surSupprimer: () => _confirmerSuppressionCommentaire(racine),
        ),
        for (final PostComment reponse in racine.replies)
          _CommentaireTuile(
            commentaire: reponse,
            estReponse: true,
            peutSupprimer: monId != null &&
                (monId == reponse.author.id || monId == post.author.id),
            // Pas de « Répondre » sur une réponse : OPTION A, un seul
            // niveau — l'API refuse le niveau 2+ (400).
            surRepondre: null,
            surJaime: () => _executer(
              () => _controleur.reagirAuCommentaire(reponse),
            ),
            surChoisirReaction: () => _choisirReactionCommentaire(reponse),
            surSupprimer: () =>
                _confirmerSuppressionCommentaire(reponse, parent: racine),
          ),
      ],
      if (etat.chargementSuiteCommentaires)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 14),
          child: Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
          ),
        )
      else if (etat.peutChargerSuiteCommentaires)
        Center(
          child: TextButton(
            onPressed: () => _controleur.chargerSuiteCommentaires(),
            child: const Text('Voir plus de commentaires'),
          ),
        ),
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Saisie de commentaire
  // ─────────────────────────────────────────────────────────────────────────

  Widget _barreCommentaire() {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: EndirekColors.bordure)),
      ),
      padding: const EdgeInsets.fromLTRB(12, 6, 6, 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_reponseA != null)
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Réponse à ${_reponseA!.author.displayName}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 12.5,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Annuler la réponse',
                  visualDensity: VisualDensity.compact,
                  onPressed: () => setState(() => _reponseA = null),
                  icon: const Icon(Icons.close, size: 16),
                ),
              ],
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: _commentaireController,
                  focusNode: _focusCommentaire,
                  maxLength: 1000,
                  minLines: 1,
                  maxLines: 4,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    hintText: 'Écrire un commentaire…',
                    counterText: '',
                    isDense: true,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Envoyer',
                onPressed: _envoiCommentaire ||
                        _commentaireController.text.trim().isEmpty
                    ? null
                    : _envoyerCommentaire,
                icon: _envoiCommentaire
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send, color: EndirekColors.bleu),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _envoyerCommentaire() async {
    final String texte = _commentaireController.text.trim();
    if (texte.isEmpty) {
      return;
    }
    setState(() => _envoiCommentaire = true);
    try {
      await _controleur.ajouterCommentaire(texte, parent: _reponseA);
      if (mounted) {
        _commentaireController.clear();
        setState(() => _reponseA = null);
      }
    } on ApiException catch (erreur) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erreur.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _envoiCommentaire = false);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions (menu ⋯, réactions et suppression de commentaires)
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _surMenu(String choix, FeedPost post) async {
    switch (choix) {
      case 'signaler':
        final bool envoye = await montrerDialogSignalement(
          context,
          envoyer: _controleur.signalerPost,
        );
        if (envoye && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text(messageSignalementEnvoye)),
          );
        }
      case 'modifier':
        final bool modifie = await montrerDialogEditionPost(
          context,
          post: post,
          enregistrer: _controleur.modifierPost,
        );
        if (modifie && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Publication modifiée')),
          );
        }
      case 'supprimer':
        await _confirmerSuppressionPost();
    }
  }

  Future<void> _confirmerSuppressionPost() async {
    final bool? confirme = await showDialog<bool>(
      context: context,
      builder: (contexteDialogue) => AlertDialog(
        title: const Text('Supprimer cette publication ?'),
        content: const Text(
          'Elle disparaîtra du fil et de la carte. Cette action est '
          'définitive.',
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
              style: TextStyle(color: couleurDanger),
            ),
          ),
        ],
      ),
    );
    if (confirme != true || !mounted) {
      return;
    }
    try {
      await _controleur.supprimerPost();
      if (mounted) {
        // Retour au fil (la carte a déjà été retirée des listes).
        context.pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Publication supprimée')),
        );
      }
    } on ApiException catch (erreur) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erreur.message)));
      }
    }
  }

  Future<void> _choisirReactionCommentaire(PostComment commentaire) async {
    final String? emoji = await montrerSelecteurReaction(
      context,
      reactionActuelle: commentaire.viewerReaction,
    );
    if (emoji == null || !mounted) {
      return;
    }
    await _executer(
      () => _controleur.reagirAuCommentaire(commentaire, emoji: emoji),
    );
  }

  Future<void> _confirmerSuppressionCommentaire(
    PostComment commentaire, {
    PostComment? parent,
  }) async {
    final String? choix = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (contexteFeuille) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.delete_outline, color: couleurDanger),
              title: const Text(
                'Supprimer le commentaire',
                style: TextStyle(color: couleurDanger),
              ),
              onTap: () => Navigator.of(contexteFeuille).pop('supprimer'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (choix != 'supprimer' || !mounted) {
      return;
    }
    await _executer(
      () => _controleur.supprimerCommentaire(commentaire, parent: parent),
    );
  }

  /// Exécute une action d'API et affiche son erreur en snackbar.
  Future<void> _executer(Future<void> Function() action) async {
    try {
      await action();
    } on ApiException catch (erreur) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(erreur.message)));
      }
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Sous-widgets
// ───────────────────────────────────────────────────────────────────────────

/// Post introuvable ou en cours de chargement.
class _EtatSansPost extends StatelessWidget {
  const _EtatSansPost({
    required this.chargement,
    required this.erreur,
    required this.surReessayer,
  });

  final bool chargement;
  final String? erreur;
  final VoidCallback surReessayer;

  @override
  Widget build(BuildContext context) {
    if (erreur == null || chargement) {
      return const Center(child: CircularProgressIndicator());
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.search_off,
              size: 40,
              color: EndirekColors.encreSecondaire,
            ),
            const SizedBox(height: 12),
            Text(
              erreur!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EndirekColors.encreSecondaire,
                fontSize: 14,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 12),
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

/// Carte d'infos du détail : type (pastille + libellé), lieu, temps, auteur.
///
/// Publication DE PAGE (Lot 3) : l'identité de la PAGE (avatar, nom, coche
/// vérifiée) remplace l'auteur humain à droite (tap → /pages/:id) et les
/// types réservés menu/offer/event, absents du référentiel `post_types`,
/// sont résolus par la table locale [typesPostsPage].
class _CarteInfos extends StatelessWidget {
  const _CarteInfos({required this.post, required this.type});

  final FeedPost post;
  final PostType? type;

  @override
  Widget build(BuildContext context) {
    final PostPageRef? page = post.page;
    final TypePostPage? typePage = typePostPageParSlug(post.typeSlug);
    final String? couleurType = type?.color ?? typePage?.couleurHex;
    final String sousTitre = [
      tempsRelatif(post.createdAt),
      if (post.city != null && post.city!.isNotEmpty) post.city!,
    ].join(' · ');

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: EndirekColors.surface,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          PastilleType(
            nomIcone: type?.icon ?? typePage?.nomIcone ?? '',
            couleurHex: couleurType ?? '',
            taille: 36,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  type?.labelFr ?? typePage?.libelle ?? post.typeSlug,
                  style: TextStyle(
                    color: couleurType != null
                        ? couleurPourType(couleurType)
                        : EndirekColors.encre,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  sousTitre,
                  style: const TextStyle(
                    color: EndirekColors.encreSecondaire,
                    fontSize: 12.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (page == null) ...[
            AvatarRond(
              initiales: post.author.initiales,
              avatarUrl: post.author.avatarUrl,
              rayon: 14,
            ),
            const SizedBox(width: 6),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 110),
              child: Text(
                post.author.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: EndirekColors.encre,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ] else
            // Identité de PAGE tappable → écran public de la page.
            InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => context.push('/pages/${page.id}'),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AvatarRond(
                    initiales: page.initiales,
                    avatarUrl: page.avatarUrl,
                    rayon: 14,
                  ),
                  const SizedBox(width: 6),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 96),
                    child: Text(
                      page.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: EndirekColors.encre,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (page.verified) ...[
                    const SizedBox(width: 3),
                    const BadgeVerifie(taille: 14),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Tuile d'un commentaire (racine ou réponse indentée d'un niveau) :
/// bulle auteur + texte, actions J'aime (tap 👍 / appui long sélecteur) et
/// « Répondre » (racines uniquement). Appui long sur la bulle : suppression
/// (si auteur du commentaire ou du post).
class _CommentaireTuile extends StatelessWidget {
  const _CommentaireTuile({
    required this.commentaire,
    required this.estReponse,
    required this.peutSupprimer,
    required this.surRepondre,
    required this.surJaime,
    required this.surChoisirReaction,
    required this.surSupprimer,
  });

  final PostComment commentaire;
  final bool estReponse;
  final bool peutSupprimer;
  final VoidCallback? surRepondre;
  final VoidCallback surJaime;
  final VoidCallback surChoisirReaction;
  final VoidCallback surSupprimer;

  @override
  Widget build(BuildContext context) {
    if (commentaire.isDeleted) {
      // Racine supprimée conservée pour ses réponses actives.
      return Padding(
        padding: EdgeInsets.fromLTRB(estReponse ? 52 : 16, 8, 16, 4),
        child: const Text(
          'Commentaire supprimé',
          style: TextStyle(
            color: EndirekColors.encreSecondaire,
            fontSize: 13.5,
            fontStyle: FontStyle.italic,
          ),
        ),
      );
    }

    final bool aReagi = commentaire.viewerReaction != null;

    return Padding(
      padding: EdgeInsets.fromLTRB(estReponse ? 52 : 16, 6, 16, 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AvatarRond(
            initiales: commentaire.author.initiales,
            avatarUrl: commentaire.author.avatarUrl,
            rayon: estReponse ? 12 : 15,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InkWell(
                  onLongPress: peutSupprimer ? surSupprimer : null,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
                    decoration: BoxDecoration(
                      color: EndirekColors.surface,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          commentaire.author.displayName,
                          style: const TextStyle(
                            color: EndirekColors.encre,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          commentaire.body,
                          style: const TextStyle(
                            color: EndirekColors.encre,
                            fontSize: 14,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 6, top: 2),
                  child: Row(
                    children: [
                      Text(
                        tempsRelatif(commentaire.createdAt),
                        style: const TextStyle(
                          color: EndirekColors.encreSecondaire,
                          fontSize: 11.5,
                        ),
                      ),
                      const SizedBox(width: 14),
                      InkWell(
                        onTap: surJaime,
                        onLongPress: surChoisirReaction,
                        borderRadius: BorderRadius.circular(8),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 3,
                          ),
                          child: Row(
                            children: [
                              if (aReagi)
                                Text(
                                  commentaire.viewerReaction!,
                                  style: const TextStyle(fontSize: 13),
                                )
                              else
                                const Text(
                                  "J'aime",
                                  style: TextStyle(
                                    color: EndirekColors.encreSecondaire,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              if (commentaire.reactionCount > 0) ...[
                                const SizedBox(width: 4),
                                Text(
                                  '${commentaire.reactionCount}',
                                  style: TextStyle(
                                    color: aReagi
                                        ? EndirekColors.bleu
                                        : EndirekColors.encreSecondaire,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      if (surRepondre != null) ...[
                        const SizedBox(width: 14),
                        InkWell(
                          onTap: surRepondre,
                          borderRadius: BorderRadius.circular(8),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 3,
                            ),
                            child: Text(
                              'Répondre',
                              style: TextStyle(
                                color: EndirekColors.encreSecondaire,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

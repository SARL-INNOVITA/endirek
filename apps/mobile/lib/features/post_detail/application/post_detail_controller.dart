import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/feed_post.dart';
import '../../../core/api/models/post_comment.dart';
import '../../../core/api/models/reaction_summary.dart';
import '../../feed/application/post_actions.dart';
import '../../feed/data/posts_repository.dart';

/// Marqueur « champ absent » pour [PostDetailState.copyWith].
const Object _champAbsent = Object();

/// État de l'écran détail : la publication, puis la liste paginée de ses
/// commentaires racine (réponses imbriquées, OPTION A).
class PostDetailState {
  const PostDetailState({
    this.post,
    this.chargementPost = false,
    this.erreurPost,
    this.commentaires = const [],
    this.totalRacines = 0,
    this.commentairesInitialises = false,
    this.chargementCommentaires = false,
    this.chargementSuiteCommentaires = false,
  });

  final FeedPost? post;
  final bool chargementPost;

  /// Message affichable si le post n'a pas pu être chargé (404 inclus).
  final String? erreurPost;

  /// Commentaires RACINE chargés (réponses imbriquées dans chaque racine).
  final List<PostComment> commentaires;

  /// Total serveur de racines (borne du « Voir plus de commentaires »).
  final int totalRacines;

  final bool commentairesInitialises;
  final bool chargementCommentaires;
  final bool chargementSuiteCommentaires;

  bool get peutChargerSuiteCommentaires =>
      commentairesInitialises &&
      !chargementCommentaires &&
      !chargementSuiteCommentaires &&
      commentaires.length < totalRacines;

  PostDetailState copyWith({
    Object? post = _champAbsent,
    bool? chargementPost,
    Object? erreurPost = _champAbsent,
    List<PostComment>? commentaires,
    int? totalRacines,
    bool? commentairesInitialises,
    bool? chargementCommentaires,
    bool? chargementSuiteCommentaires,
  }) {
    return PostDetailState(
      post: identical(post, _champAbsent) ? this.post : post as FeedPost?,
      chargementPost: chargementPost ?? this.chargementPost,
      erreurPost: identical(erreurPost, _champAbsent)
          ? this.erreurPost
          : erreurPost as String?,
      commentaires: commentaires ?? this.commentaires,
      totalRacines: totalRacines ?? this.totalRacines,
      commentairesInitialises:
          commentairesInitialises ?? this.commentairesInitialises,
      chargementCommentaires:
          chargementCommentaires ?? this.chargementCommentaires,
      chargementSuiteCommentaires:
          chargementSuiteCommentaires ?? this.chargementSuiteCommentaires,
    );
  }
}

/// Détail d'une publication + ses commentaires — un contrôleur PAR post
/// (family), libéré en quittant l'écran (autoDispose).
///
/// Toutes les mutations passent par [PostActions] ou mettent le fil à jour
/// via `diffuser` : la carte correspondante du fil (et de « Mes
/// publications ») reflète immédiatement réactions, compteurs et éditions.
final postDetailProvider = NotifierProvider.autoDispose
    .family<PostDetailController, PostDetailState, String>(
        PostDetailController.new);

class PostDetailController extends Notifier<PostDetailState> {
  PostDetailController(this.postId);

  /// Identifiant du post (argument de la family).
  final String postId;

  @override
  PostDetailState build() => const PostDetailState();

  PostsRepository get _repository => ref.read(postsRepositoryProvider);

  PostActions get _actions => ref.read(postActionsProvider);

  static const int _taillePageCommentaires = 20;

  // ─────────────────────────────────────────────────────────────────────────
  // Chargement
  // ─────────────────────────────────────────────────────────────────────────

  /// Chargement initial (post + première page de commentaires en parallèle).
  Future<void> charger() {
    return Future.wait([_chargerPost(), _chargerCommentaires()]);
  }

  /// Tirer-pour-rafraîchir : recharge tout.
  Future<void> rafraichir() => charger();

  Future<void> _chargerPost() async {
    state = state.copyWith(chargementPost: true, erreurPost: null);
    try {
      final FeedPost post = await _repository.chargerPost(postId);
      if (!ref.mounted) {
        return;
      }
      state = state.copyWith(post: post, chargementPost: false);
      // Le détail fait foi : rafraîchit la carte du fil au passage.
      _actions.diffuser(post);
    } on ApiException catch (erreur) {
      if (!ref.mounted) {
        return;
      }
      state = state.copyWith(chargementPost: false, erreurPost: erreur.message);
    }
  }

  Future<void> _chargerCommentaires() async {
    state = state.copyWith(chargementCommentaires: true);
    try {
      final CommentsPage page = await _repository.chargerCommentaires(
        postId,
        limit: _taillePageCommentaires,
        offset: 0,
      );
      if (!ref.mounted) {
        return;
      }
      state = state.copyWith(
        commentaires: page.items,
        totalRacines: page.total,
        commentairesInitialises: true,
        chargementCommentaires: false,
      );
    } on ApiException {
      if (!ref.mounted) {
        return;
      }
      // Non bloquant : le post reste lisible, un « Voir plus » relancera.
      state = state.copyWith(chargementCommentaires: false);
    }
  }

  /// Page suivante de commentaires racine (« Voir plus de commentaires »).
  Future<void> chargerSuiteCommentaires() async {
    if (!state.peutChargerSuiteCommentaires) {
      return;
    }
    state = state.copyWith(chargementSuiteCommentaires: true);
    try {
      final CommentsPage page = await _repository.chargerCommentaires(
        postId,
        limit: _taillePageCommentaires,
        offset: state.commentaires.length,
      );
      if (!ref.mounted) {
        return;
      }
      final Set<String> connus = {for (final c in state.commentaires) c.id};
      state = state.copyWith(
        commentaires: [
          ...state.commentaires,
          ...page.items.where((c) => !connus.contains(c.id)),
        ],
        totalRacines: page.total,
        chargementSuiteCommentaires: false,
      );
    } on ApiException {
      if (!ref.mounted) {
        return;
      }
      state = state.copyWith(chargementSuiteCommentaires: false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Interactions sur le POST (via PostActions — diffusées au fil)
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> basculerJaimePost() async {
    final FeedPost? post = state.post;
    if (post == null) {
      return;
    }
    _appliquerPost(await _actions.basculerJaime(post));
  }

  Future<void> reagirAuPost(String emoji) async {
    final FeedPost? post = state.post;
    if (post == null) {
      return;
    }
    _appliquerPost(await _actions.reagir(post, emoji));
  }

  Future<void> basculerEnregistrement() async {
    final FeedPost? post = state.post;
    if (post == null) {
      return;
    }
    _appliquerPost(await _actions.basculerEnregistrement(post));
  }

  /// Édition titre/texte (auteur uniquement).
  Future<void> modifierPost({String? title, String? body}) async {
    final FeedPost? post = state.post;
    if (post == null) {
      return;
    }
    _appliquerPost(await _actions.modifier(post, title: title, body: body));
  }

  /// Suppression douce (auteur uniquement) — l'écran appelant fait le pop.
  Future<void> supprimerPost() async {
    final FeedPost? post = state.post;
    if (post == null) {
      return;
    }
    await _actions.supprimer(post);
  }

  /// Signalement du post (409 « déjà signalé » remonte en ApiException).
  Future<void> signalerPost({
    required String reasonCode,
    String? message,
  }) {
    return _repository.signalerPost(
      postId,
      reasonCode: reasonCode,
      message: message,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Commentaires
  // ─────────────────────────────────────────────────────────────────────────

  /// Ajoute un commentaire racine, ou une réponse si [parent] est fourni
  /// (parent obligatoirement RACINE — l'UI n'offre « Répondre » que là,
  /// l'API refuse le niveau 2+ de toute façon).
  Future<void> ajouterCommentaire(String body, {PostComment? parent}) async {
    final PostComment cree = await _repository.ajouterCommentaire(
      postId,
      body: body,
      parentCommentId: parent?.id,
    );
    if (!ref.mounted) {
      return;
    }
    if (parent == null) {
      // Racines triées created ASC : le nouveau va en fin de liste.
      state = state.copyWith(
        commentaires: [...state.commentaires, cree],
        totalRacines: state.totalRacines + 1,
      );
    } else {
      _patchCommentaire(
        parent.id,
        (racine) => racine.copyWith(replies: [...racine.replies, cree]),
      );
    }
    _incrementerCompteurCommentaires(1);
  }

  /// Suppression douce d'un commentaire (auteur du commentaire OU auteur du
  /// post — l'API vérifie). [parent] est la racine si c'est une réponse.
  Future<void> supprimerCommentaire(
    PostComment commentaire, {
    PostComment? parent,
  }) async {
    await _repository.supprimerCommentaire(commentaire.id);
    if (!ref.mounted) {
      return;
    }
    if (parent != null) {
      // Réponse : disparaît simplement de sa racine.
      _patchCommentaire(
        parent.id,
        (racine) => racine.copyWith(
          replies:
              racine.replies.where((r) => r.id != commentaire.id).toList(),
        ),
      );
    } else if (commentaire.replies.isNotEmpty) {
      // Racine avec réponses actives : placeholder « Commentaire supprimé »
      // (même règle que l'API au rechargement).
      _patchCommentaire(
        commentaire.id,
        (racine) => racine.copyWith(isDeleted: true, body: ''),
      );
    } else {
      // Racine sans réponse : retirée de la liste.
      state = state.copyWith(
        commentaires:
            state.commentaires.where((c) => c.id != commentaire.id).toList(),
        totalRacines:
            state.totalRacines > 0 ? state.totalRacines - 1 : 0,
      );
    }
    _incrementerCompteurCommentaires(-1);
  }

  /// TAP « J'aime » sur un commentaire : 👍 si pas de réaction, retrait
  /// sinon. [emoji] force un emoji précis (sélecteur d'appui long).
  Future<void> reagirAuCommentaire(
    PostComment commentaire, {
    String? emoji,
  }) async {
    final CommentReactionsSummary resume;
    if (emoji != null) {
      resume = await _repository.reagirAuCommentaire(commentaire.id, emoji);
    } else if (commentaire.viewerReaction == null) {
      resume = await _repository.reagirAuCommentaire(commentaire.id, '👍');
    } else {
      resume = await _repository.retirerReactionCommentaire(commentaire.id);
    }
    if (!ref.mounted) {
      return;
    }
    _patchCommentaire(
      commentaire.id,
      (c) => c.copyWith(
        reactionCount: resume.reactionCount,
        viewerReaction: resume.viewerReaction,
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  /// Reçoit la version à jour du post diffusée par [PostActions] (réaction
  /// ou enregistrement déclenché depuis la barre d'actions partagée).
  /// No-op tant que le détail n'est pas chargé.
  void appliquerDiffusion(FeedPost post) {
    if (state.post != null && post.id == postId) {
      state = state.copyWith(post: post);
    }
  }

  void _appliquerPost(FeedPost post) {
    if (ref.mounted) {
      state = state.copyWith(post: post);
    }
  }

  void _incrementerCompteurCommentaires(int delta) {
    final FeedPost? post = state.post;
    if (post == null) {
      return;
    }
    final int nouveau = post.commentCount + delta;
    final FeedPost aJour =
        post.copyWith(commentCount: nouveau < 0 ? 0 : nouveau);
    state = state.copyWith(post: aJour);
    _actions.diffuser(aJour);
  }

  /// Applique [transformer] au commentaire [id], qu'il soit racine ou
  /// réponse (recherche dans l'arbre à deux niveaux).
  void _patchCommentaire(
    String id,
    PostComment Function(PostComment) transformer,
  ) {
    state = state.copyWith(
      commentaires: [
        for (final PostComment racine in state.commentaires)
          if (racine.id == id)
            transformer(racine)
          else if (racine.replies.any((r) => r.id == id))
            racine.copyWith(
              replies: [
                for (final PostComment reponse in racine.replies)
                  reponse.id == id ? transformer(reponse) : reponse,
              ],
            )
          else
            racine,
      ],
    );
  }
}

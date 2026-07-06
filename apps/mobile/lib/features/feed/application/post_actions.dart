import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/feed_post.dart';
import '../../../core/api/models/reaction_summary.dart';
import '../../post_detail/application/post_detail_controller.dart';
import '../data/posts_repository.dart';
import '../domain/reactions_palette.dart';
import 'posts_liste_controller.dart';

/// Actions de MUTATION sur une publication, mutualisées entre le fil, le
/// détail et le profil.
///
/// Chaque action appelle l'API, construit le FEED_POST à jour puis le
/// DIFFUSE aux listes vivantes (fil + « Mes publications ») — la carte
/// concernée est mise à jour SANS recharger la liste. L'appelant reçoit
/// aussi le post à jour pour rafraîchir son propre état local (détail).
///
/// Les [ApiException] remontent à l'appelant, qui les affiche (snackbar).
final postActionsProvider = Provider<PostActions>((ref) {
  return PostActions(ref);
});

class PostActions {
  const PostActions(this._ref);

  final Ref _ref;

  PostsRepository get _repository => _ref.read(postsRepositoryProvider);

  /// Diffuse la version à jour d'un post à toutes les listes (no-op pour
  /// celles qui ne le contiennent pas) ET à l'écran détail s'il est ouvert
  /// sur ce post — la carte du fil et le détail restent toujours cohérents
  /// sans rechargement complet.
  void diffuser(FeedPost post) {
    _ref.read(feedProvider.notifier).remplacerPost(post);
    _ref.read(mesPublicationsProvider.notifier).remplacerPost(post);
    _ref.read(postDetailProvider(post.id).notifier).appliquerDiffusion(post);
  }

  /// Retire un post de toutes les listes (après suppression).
  void retirerPartout(String id) {
    _ref.read(feedProvider.notifier).retirerPost(id);
    _ref.read(mesPublicationsProvider.notifier).retirerPost(id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Réactions
  // ─────────────────────────────────────────────────────────────────────────

  /// TAP sur « J'aime » : 👍 si le viewer n'a pas réagi, retrait sinon
  /// (quel que soit l'emoji posé — un tap éteint la réaction en cours).
  Future<FeedPost> basculerJaime(FeedPost post) {
    return post.viewerReaction == null
        ? reagir(post, emojiJaimeParDefaut)
        : retirerReaction(post);
  }

  /// Pose [emoji] sur le post (upsert : changer d'emoji remplace).
  Future<FeedPost> reagir(FeedPost post, String emoji) async {
    final PostReactionsSummary resume =
        await _repository.reagirAuPost(post.id, emoji);
    return _appliquerResume(post, resume);
  }

  /// Retire la réaction du viewer (idempotent).
  Future<FeedPost> retirerReaction(FeedPost post) async {
    final PostReactionsSummary resume =
        await _repository.retirerReactionPost(post.id);
    return _appliquerResume(post, resume);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Enregistrements
  // ─────────────────────────────────────────────────────────────────────────

  /// Bascule l'enregistrement (bookmark). L'API répond 204 sans compteurs :
  /// viewerSaved/saveCount sont ajustés localement (le serveur reste la
  /// source de vérité au prochain chargement).
  Future<FeedPost> basculerEnregistrement(FeedPost post) async {
    final FeedPost aJour;
    if (post.viewerSaved) {
      await _repository.retirerEnregistrement(post.id);
      aJour = post.copyWith(
        viewerSaved: false,
        saveCount: post.saveCount > 0 ? post.saveCount - 1 : 0,
      );
    } else {
      await _repository.enregistrerPost(post.id);
      aJour = post.copyWith(viewerSaved: true, saveCount: post.saveCount + 1);
    }
    diffuser(aJour);
    return aJour;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Édition / suppression (auteur uniquement — 403 sinon côté API)
  // ─────────────────────────────────────────────────────────────────────────

  /// Modifie titre/texte, diffuse et renvoie le FEED_POST serveur.
  Future<FeedPost> modifier(
    FeedPost post, {
    String? title,
    String? body,
  }) async {
    final FeedPost aJour =
        await _repository.modifierPost(post.id, title: title, body: body);
    diffuser(aJour);
    return aJour;
  }

  /// Soft-delete puis retrait de toutes les listes.
  Future<void> supprimer(FeedPost post) async {
    await _repository.supprimerPost(post.id);
    retirerPartout(post.id);
  }

  // ─────────────────────────────────────────────────────────────────────────

  FeedPost _appliquerResume(FeedPost post, PostReactionsSummary resume) {
    final FeedPost aJour = post.copyWith(
      reactionCount: resume.reactionCount,
      reactionsTop: resume.reactionsTop,
      viewerReaction: resume.viewerReaction,
    );
    diffuser(aJour);
    return aJour;
  }
}

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/models/commune.dart';
import '../../../core/auth/auth_controller.dart' show apiClientProvider;
import '../../../core/api/models/feed_post.dart';
import '../../../core/api/models/geo_point.dart';
import '../../../core/api/models/post_comment.dart';
import '../../../core/api/models/post_media.dart';
import '../../../core/api/models/post_type.dart';
import '../../../core/api/models/reaction_summary.dart';

/// Marqueur « champ absent » pour le paramètre nullable de
/// [PostsRepository.modifierPost] (même pattern que profile_repository) :
/// `title` étant NULLABLE côté contrat, un `null` EXPLICITE est transmis au
/// PATCH (remet le titre à null) tandis que le sentinel retire la clé du
/// corps (titre inchangé). Un simple `String?` ne peut pas distinguer les
/// deux cas.
const Object _champAbsent = Object();

/// Page de publications `{ items, total }` renvoyée par les listes.
typedef PostsPage = ({List<FeedPost> items, int total});

/// Page de commentaires racine `{ items, total }` (total = racines).
typedef CommentsPage = ({List<PostComment> items, int total});

/// Accès aux endpoints publications / interactions du contrat étape 4 —
/// partagé par les features feed, post_composer, post_detail et profil.
final postsRepositoryProvider = Provider<PostsRepository>((ref) {
  return PostsRepository(ref.watch(apiClientProvider));
});

class PostsRepository {
  const PostsRepository(this._api);

  final ApiClient _api;

  // ─────────────────────────────────────────────────────────────────────────
  // Référentiels
  // ─────────────────────────────────────────────────────────────────────────

  /// Types de publication actifs, triés par position (GET /posts/types).
  Future<List<PostType>> listerTypes() async {
    final reponse = await _api.get('/posts/types');
    return (reponse.data as List)
        .whereType<Map<String, dynamic>>()
        .map(PostType.fromJson)
        .toList();
  }

  /// Les 12 communes du référentiel seed (GET /map/communes).
  Future<List<Commune>> listerCommunes() async {
    final reponse = await _api.get('/map/communes');
    return (reponse.data as List)
        .whereType<Map<String, dynamic>>()
        .map(Commune.fromJson)
        .toList();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Feed et lecture
  // ─────────────────────────────────────────────────────────────────────────

  /// Fil d'actualité scoré (GET /posts/feed). [lat]/[lng] (ensemble)
  /// activent le bonus de proximité — non branchés au Lot 1 étape 4
  /// (la position GPS du viewer arrive avec la carte, étapes 5/7).
  Future<PostsPage> chargerFeed({
    int limit = 20,
    int offset = 0,
    double? lat,
    double? lng,
  }) async {
    final reponse = await _api.get('/posts/feed', queryParameters: {
      'limit': limit,
      'offset': offset,
      if (lat != null && lng != null) ...{'lat': lat, 'lng': lng},
    });
    return _pagePosts(reponse.data as Map<String, dynamic>);
  }

  /// Détail d'une publication (GET /posts/:id).
  Future<FeedPost> chargerPost(String id) async {
    final reponse = await _api.get('/posts/$id');
    return FeedPost.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Publications 'active' + 'hidden' du user courant (GET /users/me/posts).
  Future<PostsPage> chargerMesPublications({
    int limit = 20,
    int offset = 0,
  }) async {
    final reponse = await _api.get('/users/me/posts', queryParameters: {
      'limit': limit,
      'offset': offset,
    });
    return _pagePosts(reponse.data as Map<String, dynamic>);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Création / édition / suppression
  // ─────────────────────────────────────────────────────────────────────────

  /// Crée une publication (POST /posts). Les règles carte (mapExpiresAt,
  /// city déduite, urlSlug) sont appliquées côté serveur.
  Future<FeedPost> creerPost({
    required String typeSlug,
    String? title,
    required String body,
    GeoPoint? location,
    String? city,
    List<PostMedia> media = const [],
  }) async {
    final reponse = await _api.post('/posts', data: {
      'typeSlug': typeSlug,
      'title': ?title,
      'body': body,
      'location': ?location?.toJson(),
      'city': ?city,
      if (media.isNotEmpty)
        'media': media.map((element) => element.toJson()).toList(),
    });
    return FeedPost.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Modifie titre/texte (PATCH /posts/:id — auteur uniquement ; type et
  /// location non modifiables au MVP, décision produit côté API).
  ///
  /// [title] est NULLABLE côté contrat : passer explicitement `null` envoie
  /// `'title': null` au serveur pour EFFACER le titre ; ne pas passer le
  /// paramètre laisse le titre inchangé (sentinel [_champAbsent]).
  Future<FeedPost> modifierPost(
    String id, {
    Object? title = _champAbsent,
    String? body,
  }) async {
    final Map<String, dynamic> donnees = {'body': ?body};
    // Titre NULLABLE : un null EXPLICITE est transmis (remet le titre à
    // null) ; seul le sentinel « absent » retire la clé du corps.
    if (!identical(title, _champAbsent)) {
      donnees['title'] = title;
    }
    final reponse = await _api.patch('/posts/$id', data: donnees);
    return FeedPost.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Soft-delete (DELETE /posts/:id → 204, auteur uniquement).
  Future<void> supprimerPost(String id) async {
    await _api.delete('/posts/$id');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Réactions
  // ─────────────────────────────────────────────────────────────────────────

  /// Réagit à un post (upsert : changer d'emoji remplace la réaction).
  Future<PostReactionsSummary> reagirAuPost(String id, String emoji) async {
    final reponse = await _api.post('/posts/$id/reactions', data: {
      'emoji': emoji,
    });
    return PostReactionsSummary.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Retire la réaction du viewer sur un post (idempotent).
  Future<PostReactionsSummary> retirerReactionPost(String id) async {
    final reponse = await _api.delete('/posts/$id/reactions');
    return PostReactionsSummary.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Réagit à un commentaire (upsert).
  Future<CommentReactionsSummary> reagirAuCommentaire(
    String id,
    String emoji,
  ) async {
    final reponse = await _api.post('/comments/$id/reactions', data: {
      'emoji': emoji,
    });
    return CommentReactionsSummary.fromJson(
      reponse.data as Map<String, dynamic>,
    );
  }

  /// Retire la réaction du viewer sur un commentaire (idempotent).
  Future<CommentReactionsSummary> retirerReactionCommentaire(String id) async {
    final reponse = await _api.delete('/comments/$id/reactions');
    return CommentReactionsSummary.fromJson(
      reponse.data as Map<String, dynamic>,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Enregistrements (collection par défaut « Général »)
  // ─────────────────────────────────────────────────────────────────────────

  /// Enregistre un post (POST /posts/:id/save → 204, idempotent).
  Future<void> enregistrerPost(String id) async {
    await _api.post('/posts/$id/save');
  }

  /// Retire un post des enregistrements (DELETE → 204, idempotent).
  Future<void> retirerEnregistrement(String id) async {
    await _api.delete('/posts/$id/save');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Commentaires (OPTION A : racines + réponses niveau 1)
  // ─────────────────────────────────────────────────────────────────────────

  /// Commentaires racine paginés d'un post, réponses imbriquées
  /// (GET /posts/:id/comments — racines et réponses triées created ASC).
  Future<CommentsPage> chargerCommentaires(
    String postId, {
    int limit = 20,
    int offset = 0,
  }) async {
    final reponse = await _api.get('/posts/$postId/comments',
        queryParameters: {'limit': limit, 'offset': offset});
    final data = reponse.data as Map<String, dynamic>;
    return (
      items: ((data['items'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PostComment.fromJson)
          .toList(),
      total: (data['total'] as num?)?.toInt() ?? 0,
    );
  }

  /// Ajoute un commentaire ou une réponse (POST /posts/:id/comments).
  /// [parentCommentId] doit désigner un commentaire RACINE du même post —
  /// le niveau 2+ est refusé par l'API (400).
  Future<PostComment> ajouterCommentaire(
    String postId, {
    required String body,
    String? parentCommentId,
  }) async {
    final reponse = await _api.post('/posts/$postId/comments', data: {
      'body': body,
      'parentCommentId': ?parentCommentId,
    });
    return PostComment.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Soft-delete d'un commentaire (DELETE /comments/:id → 204 — auteur du
  /// commentaire OU auteur du post).
  Future<void> supprimerCommentaire(String id) async {
    await _api.delete('/comments/$id');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Signalements
  // ─────────────────────────────────────────────────────────────────────────

  /// Signale un post (POST /posts/:id/report → 201 { id, status: 'open' }).
  /// Un même utilisateur ne peut signaler la même cible qu'une fois — le
  /// 409 « Vous avez déjà signalé ce contenu » remonte en ApiException.
  Future<void> signalerPost(
    String postId, {
    required String reasonCode,
    String? message,
  }) async {
    await _api.post('/posts/$postId/report', data: {
      'reasonCode': reasonCode,
      'message': ?message,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────

  static PostsPage _pagePosts(Map<String, dynamic> data) {
    return (
      items: ((data['items'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(FeedPost.fromJson)
          .toList(),
      total: (data['total'] as num?)?.toInt() ?? 0,
    );
  }
}

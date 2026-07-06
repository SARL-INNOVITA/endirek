import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/feed_post.dart';
import '../data/posts_repository.dart';

/// Marqueur « champ absent » pour [PostsListeState.copyWith] (erreur
/// nullable : distinguer « inchangée » de « effacée »).
const Object _champAbsent = Object();

/// État d'une LISTE PAGINÉE de publications (fil d'actualité, « Mes
/// publications »...) : items chargés, total serveur, drapeaux de
/// chargement et erreur affichable.
class PostsListeState {
  const PostsListeState({
    this.posts = const [],
    this.total = 0,
    this.initialise = false,
    this.chargement = false,
    this.chargementSuite = false,
    this.erreur,
  });

  final List<FeedPost> posts;

  /// Total serveur ({ items, total }) — borne de l'infinite scroll.
  final int total;

  /// Un premier chargement a-t-il déjà abouti ? (distingue « liste vide »
  /// de « pas encore chargé »).
  final bool initialise;

  /// Chargement initial ou rafraîchissement complet en cours.
  final bool chargement;

  /// Chargement de la page suivante en cours (infinite scroll).
  final bool chargementSuite;

  /// Message d'erreur affichable du DERNIER chargement (null si succès).
  final String? erreur;

  bool get peutChargerSuite =>
      initialise && !chargement && !chargementSuite && posts.length < total;

  PostsListeState copyWith({
    List<FeedPost>? posts,
    int? total,
    bool? initialise,
    bool? chargement,
    bool? chargementSuite,
    Object? erreur = _champAbsent,
  }) {
    return PostsListeState(
      posts: posts ?? this.posts,
      total: total ?? this.total,
      initialise: initialise ?? this.initialise,
      chargement: chargement ?? this.chargement,
      chargementSuite: chargementSuite ?? this.chargementSuite,
      erreur: identical(erreur, _champAbsent) ? this.erreur : erreur as String?,
    );
  }
}

/// Socle commun des listes paginées de publications : pagination
/// offset/limit, pull-to-refresh, et MISE À JOUR CIBLÉE d'une carte après
/// une interaction (réaction, enregistrement, édition...) sans tout
/// recharger — voir [remplacerPost] / [retirerPost].
abstract class PostsListeController extends Notifier<PostsListeState> {
  /// Taille de page des listes (limit ≤ 100 côté API).
  static const int taillePage = 20;

  @override
  PostsListeState build() => const PostsListeState();

  PostsRepository get repository => ref.read(postsRepositoryProvider);

  /// Charge UNE page — spécialisé par liste (feed scoré, mes publications).
  Future<PostsPage> chargerPage({required int limit, required int offset});

  /// Premier chargement — sans effet si la liste est déjà initialisée ou en
  /// cours de chargement (les écrans l'appellent librement à l'ouverture).
  Future<void> charger() async {
    if (state.initialise || state.chargement) {
      return;
    }
    await _rechargerDepuisZero();
  }

  /// Recharge complète (tirer-pour-rafraîchir, retour du composer).
  Future<void> rafraichir() async {
    if (state.chargement) {
      return;
    }
    await _rechargerDepuisZero();
  }

  /// Page suivante (infinite scroll) — silencieux en cas d'erreur réseau :
  /// l'utilisateur re-déclenchera en scrollant, sans casser la liste.
  Future<void> chargerSuite() async {
    if (!state.peutChargerSuite) {
      return;
    }
    state = state.copyWith(chargementSuite: true);
    try {
      final PostsPage page = await chargerPage(
        limit: taillePage,
        offset: state.posts.length,
      );
      // Dédoublonnage défensif : le feed est scoré, un post peut glisser
      // d'une page à l'autre entre deux requêtes.
      final Set<String> connus = {for (final p in state.posts) p.id};
      state = state.copyWith(
        posts: [
          ...state.posts,
          ...page.items.where((p) => !connus.contains(p.id)),
        ],
        total: page.total,
        chargementSuite: false,
      );
    } on ApiException {
      state = state.copyWith(chargementSuite: false);
    }
  }

  /// Remplace la version d'un post dans la liste (après une interaction) —
  /// no-op si le post n'y figure pas.
  void remplacerPost(FeedPost post) {
    if (!state.posts.any((p) => p.id == post.id)) {
      return;
    }
    state = state.copyWith(
      posts: [for (final p in state.posts) p.id == post.id ? post : p],
    );
  }

  /// Retire un post de la liste (après une suppression).
  void retirerPost(String id) {
    if (!state.posts.any((p) => p.id == id)) {
      return;
    }
    state = state.copyWith(
      posts: state.posts.where((p) => p.id != id).toList(),
      total: state.total > 0 ? state.total - 1 : 0,
    );
  }

  Future<void> _rechargerDepuisZero() async {
    state = state.copyWith(chargement: true, erreur: null);
    try {
      final PostsPage page =
          await chargerPage(limit: taillePage, offset: 0);
      state = state.copyWith(
        posts: page.items,
        total: page.total,
        initialise: true,
        chargement: false,
        erreur: null,
      );
    } on ApiException catch (erreur) {
      state = state.copyWith(chargement: false, erreur: erreur.message);
    }
  }
}

/// Fil d'actualité (GET /posts/feed — scoring serveur).
///
/// TODO(étape 5/7) : transmettre lat/lng du viewer (GPS) pour activer le
/// bonus de proximité du scoring.
class FeedController extends PostsListeController {
  @override
  Future<PostsPage> chargerPage({required int limit, required int offset}) {
    return repository.chargerFeed(limit: limit, offset: offset);
  }
}

/// Le fil vit aussi longtemps que l'app (pas d'autoDispose : l'IndexedStack
/// du shell garde l'onglet Accueil monté, et les autres écrans y diffusent
/// leurs mises à jour de posts).
final feedProvider =
    NotifierProvider<FeedController, PostsListeState>(FeedController.new);

/// « Mes publications » du profil (GET /users/me/posts —
/// posts 'active' + 'hidden' de l'utilisateur courant).
class MesPublicationsController extends PostsListeController {
  @override
  Future<PostsPage> chargerPage({required int limit, required int offset}) {
    return repository.chargerMesPublications(limit: limit, offset: offset);
  }
}

final mesPublicationsProvider =
    NotifierProvider<MesPublicationsController, PostsListeState>(
        MesPublicationsController.new);

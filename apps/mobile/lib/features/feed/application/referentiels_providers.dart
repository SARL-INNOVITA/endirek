import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/commune.dart';
import '../../../core/api/models/post_type.dart';
import '../data/posts_repository.dart';

/// Types de publication actifs (GET /posts/types) — chargés UNE fois puis
/// conservés en mémoire pour toute la session (table de référence stable ;
/// `ref.invalidate(postTypesProvider)` pour re-tenter après une erreur).
final postTypesProvider = FutureProvider<List<PostType>>((ref) {
  return ref.watch(postsRepositoryProvider).listerTypes();
});

/// Index slug → type, vide tant que le référentiel n'est pas chargé (les
/// cartes de post affichent alors l'icône de repli — jamais bloquant).
final typesParSlugProvider = Provider<Map<String, PostType>>((ref) {
  final AsyncValue<List<PostType>> types = ref.watch(postTypesProvider);
  return switch (types) {
    AsyncData(:final value) => {
        for (final PostType type in value) type.slug: type,
      },
    _ => const {},
  };
});

/// Les 12 communes du référentiel (GET /map/communes) — sélecteur de
/// position du composer, chargées une fois par session.
final communesProvider = FutureProvider<List<Commune>>((ref) {
  return ref.watch(postsRepositoryProvider).listerCommunes();
});

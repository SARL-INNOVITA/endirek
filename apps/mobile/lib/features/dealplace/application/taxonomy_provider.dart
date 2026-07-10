import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/dealplace_repository.dart';
import '../domain/dealplace_taxonomy.dart';

/// Taxonomie Dealplace (GET /dealplace/taxonomy) — chargée UNE fois puis
/// conservée pour la session (table de référence stable pilotée par le
/// backoffice). `ref.invalidate(taxonomyProvider)` pour re-tenter après erreur.
final taxonomyProvider = FutureProvider<DealplaceTaxonomy>((ref) {
  return ref.watch(dealplaceRepositoryProvider).chargerTaxonomie();
});

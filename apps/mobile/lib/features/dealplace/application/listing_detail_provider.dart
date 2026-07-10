import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/dealplace_repository.dart';
import '../domain/listing.dart';

/// Détail d'une annonce par identifiant (GET /dealplace/listings/:id).
///
/// `autoDispose` : le détail est éphémère (poussé plein écran), on ne le garde
/// pas en mémoire après fermeture. `ref.invalidate(listingDetailProvider(id))`
/// pour re-tenter après une erreur réseau.
final listingDetailProvider =
    FutureProvider.autoDispose.family<Listing, String>((ref, id) {
  return ref.watch(dealplaceRepositoryProvider).chargerAnnonce(id);
});

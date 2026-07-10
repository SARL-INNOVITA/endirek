import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/auth/auth_controller.dart' show apiClientProvider;
import '../domain/create_listing_input.dart';
import '../domain/dealplace_taxonomy.dart';
import '../domain/listing.dart';
import '../domain/listing_card.dart';
import '../domain/listing_filters.dart';

/// Marqueur « champ absent » pour le PATCH partiel : seul un champ EXPLICITE
/// est transmis au serveur (les autres restent inchangés).
const Object _champAbsent = Object();

/// Page de cartes d'annonce `{ items, total }`.
typedef ListingsPage = ({List<ListingCard> items, int total});

/// Accès aux endpoints Dealplace du contrat CP2.1 (taxonomie + annonces).
final dealplaceRepositoryProvider = Provider<DealplaceRepository>((ref) {
  return DealplaceRepository(ref.watch(apiClientProvider));
});

class DealplaceRepository {
  const DealplaceRepository(this._api);

  final ApiClient _api;

  // ─────────────────────────────────────────────────────────────────────────
  // Taxonomie
  // ─────────────────────────────────────────────────────────────────────────

  /// Taxonomie active (GET /dealplace/taxonomy) : catégories + sous-catégories
  /// + tags, triées côté serveur.
  Future<DealplaceTaxonomy> chargerTaxonomie() async {
    final reponse = await _api.get('/dealplace/taxonomy');
    return DealplaceTaxonomy.fromJson(reponse.data as Map<String, dynamic>);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Annuaire public + listes de profil
  // ─────────────────────────────────────────────────────────────────────────

  /// Annuaire public filtré et paginé (GET /dealplace/listings) — annonces
  /// 'active', antéchronologiques.
  Future<ListingsPage> listerAnnonces({
    ListingFilters filtres = const ListingFilters(),
    int limit = 20,
    int offset = 0,
  }) async {
    final reponse = await _api.get('/dealplace/listings', queryParameters: {
      ...filtres.toQueryParameters(),
      'limit': limit,
      'offset': offset,
    });
    return _pageCartes(reponse.data as Map<String, dynamic>);
  }

  /// Mes annonces ('active' + 'hidden') — GET /users/me/listings.
  Future<ListingsPage> chargerMesAnnonces({
    int limit = 20,
    int offset = 0,
  }) async {
    final reponse = await _api.get('/users/me/listings', queryParameters: {
      'limit': limit,
      'offset': offset,
    });
    return _pageCartes(reponse.data as Map<String, dynamic>);
  }

  /// Annonces 'active' d'un profil (GET /users/:id/listings).
  Future<ListingsPage> chargerAnnoncesDeProfil(
    String userId, {
    int limit = 20,
    int offset = 0,
  }) async {
    final reponse =
        await _api.get('/users/$userId/listings', queryParameters: {
      'limit': limit,
      'offset': offset,
    });
    return _pageCartes(reponse.data as Map<String, dynamic>);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Détail
  // ─────────────────────────────────────────────────────────────────────────

  /// Détail d'une annonce par identifiant (GET /dealplace/listings/:id).
  Future<Listing> chargerAnnonce(String id) async {
    final reponse = await _api.get('/dealplace/listings/$id');
    return Listing.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Détail d'une annonce par urlSlug (GET /dealplace/listings/slug/:slug).
  Future<Listing> chargerAnnonceParSlug(String slug) async {
    final reponse = await _api.get('/dealplace/listings/slug/$slug');
    return Listing.fromJson(reponse.data as Map<String, dynamic>);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Création / édition / suppression
  // ─────────────────────────────────────────────────────────────────────────

  /// Crée une annonce (POST /dealplace/listings → 201 LISTING).
  Future<Listing> creerAnnonce(CreateListingInput input) async {
    final reponse = await _api.post('/dealplace/listings', data: input.toJson());
    return Listing.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Modifie une annonce (PATCH /dealplace/listings/:id — propriétaire).
  /// Seuls les champs EXPLICITEMENT fournis sont transmis (patch partiel).
  Future<Listing> modifierAnnonce(
    String id, {
    Object? title = _champAbsent,
    Object? description = _champAbsent,
    Object? valueKind = _champAbsent,
    Object? valueMin = _champAbsent,
    Object? valueMax = _champAbsent,
    Object? categorySlug = _champAbsent,
    Object? subcategorySlug = _champAbsent,
    Object? exchangePrefs = _champAbsent,
    Object? externalLinks = _champAbsent,
    Object? tags = _champAbsent,
  }) async {
    final Map<String, dynamic> donnees = {};
    if (!identical(title, _champAbsent)) donnees['title'] = title;
    if (!identical(description, _champAbsent)) {
      donnees['description'] = description;
    }
    if (!identical(valueKind, _champAbsent)) donnees['valueKind'] = valueKind;
    if (!identical(valueMin, _champAbsent)) donnees['valueMin'] = valueMin;
    if (!identical(valueMax, _champAbsent)) donnees['valueMax'] = valueMax;
    if (!identical(categorySlug, _champAbsent)) {
      donnees['categorySlug'] = categorySlug;
    }
    if (!identical(subcategorySlug, _champAbsent)) {
      donnees['subcategorySlug'] = subcategorySlug;
    }
    if (!identical(exchangePrefs, _champAbsent)) {
      donnees['exchangePrefs'] = exchangePrefs;
    }
    if (!identical(externalLinks, _champAbsent)) {
      donnees['externalLinks'] = externalLinks;
    }
    if (!identical(tags, _champAbsent)) donnees['tags'] = tags;
    final reponse = await _api.patch('/dealplace/listings/$id', data: donnees);
    return Listing.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Soft-delete (DELETE /dealplace/listings/:id → 204, propriétaire).
  Future<void> supprimerAnnonce(String id) async {
    await _api.delete('/dealplace/listings/$id');
  }

  // ─────────────────────────────────────────────────────────────────────────

  static ListingsPage _pageCartes(Map<String, dynamic> data) {
    return (
      items: ((data['items'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ListingCard.fromJson)
          .toList(),
      total: (data['total'] as num?)?.toInt() ?? 0,
    );
  }
}

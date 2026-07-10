import '../../../core/api/models/post_author.dart';
import '../../../core/api/models/post_media.dart';
import 'dealplace_taxonomy.dart';

/// Catégorie ALLÉGÉE des cartes (LISTING_CARD) : `{ slug, labelFr, family }`
/// (sans moderationLevel).
class ListingCardCategoryRef {
  const ListingCardCategoryRef({
    required this.slug,
    required this.labelFr,
    required this.family,
  });

  final String slug;
  final String labelFr;

  /// 'good' | 'service'.
  final String family;

  bool get estBien => family == 'good';

  factory ListingCardCategoryRef.fromJson(Map<String, dynamic> json) {
    return ListingCardCategoryRef(
      slug: json['slug'] as String,
      labelFr: (json['labelFr'] as String?) ?? '',
      family: (json['family'] as String?) ?? 'service',
    );
  }
}

/// Forme LISTING_CARD du contrat — sous-ensemble d'une annonce servi dans les
/// listes (annuaire public, annonces de profil, mes annonces, backoffice).
class ListingCard {
  const ListingCard({
    required this.id,
    required this.ownerId,
    required this.owner,
    required this.listingType,
    required this.title,
    required this.category,
    required this.subcategory,
    required this.valueKind,
    required this.valueMin,
    required this.valueMax,
    required this.currency,
    required this.city,
    required this.coverMedia,
    required this.tags,
    required this.urlSlug,
    required this.createdAt,
    required this.status,
  });

  final String id;
  final String ownerId;
  final PostAuthor owner;

  /// 'good' | 'service'.
  final String listingType;
  final String title;
  final ListingCardCategoryRef category;
  final ListingSubcategory subcategory;

  /// 'fixed' | 'range'.
  final String valueKind;
  final int valueMin;
  final int? valueMax;
  final String currency;
  final String city;

  /// Premier média (position la plus basse) ou null.
  final PostMedia? coverMedia;
  final List<ListingTag> tags;
  final String urlSlug;
  final DateTime createdAt;

  /// Statut de l'annonce — présent uniquement sur « mes annonces » et le
  /// backoffice (l'annuaire public ne sert que des annonces 'active').
  final String? status;

  bool get estBien => listingType == 'good';

  factory ListingCard.fromJson(Map<String, dynamic> json) {
    return ListingCard(
      id: json['id'] as String,
      ownerId: json['ownerId'] as String,
      owner: PostAuthor.fromJson(json['owner'] as Map<String, dynamic>),
      listingType: (json['listingType'] as String?) ?? 'service',
      title: (json['title'] as String?) ?? '',
      category: ListingCardCategoryRef.fromJson(
        json['category'] as Map<String, dynamic>,
      ),
      subcategory: ListingSubcategory.fromJson(
        json['subcategory'] as Map<String, dynamic>,
      ),
      valueKind: (json['valueKind'] as String?) ?? 'fixed',
      valueMin: (json['valueMin'] as num?)?.toInt() ?? 0,
      valueMax: (json['valueMax'] as num?)?.toInt(),
      currency: (json['currency'] as String?) ?? 'EUR',
      city: (json['city'] as String?) ?? '',
      coverMedia: json['coverMedia'] == null
          ? null
          : PostMedia.fromJson(json['coverMedia'] as Map<String, dynamic>),
      tags: ((json['tags'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ListingTag.fromJson)
          .toList(),
      urlSlug: (json['urlSlug'] as String?) ?? '',
      createdAt: DateTime.parse(json['createdAt'] as String),
      status: json['status'] as String?,
    );
  }
}

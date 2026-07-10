import '../../../core/api/models/geo_point.dart';
import '../../../core/api/models/post_author.dart';
import '../../../core/api/models/post_media.dart';
import 'dealplace_taxonomy.dart';

/// Catégorie IMBRIQUÉE dans une annonce (détail LISTING) :
/// `{ slug, labelFr, family, moderationLevel }`.
class ListingCategoryRef {
  const ListingCategoryRef({
    required this.slug,
    required this.labelFr,
    required this.family,
    required this.moderationLevel,
  });

  final String slug;
  final String labelFr;

  /// 'good' | 'service'.
  final String family;

  /// 'standard' | 'sensitive' | 'forbidden'.
  final String moderationLevel;

  bool get estBien => family == 'good';

  factory ListingCategoryRef.fromJson(Map<String, dynamic> json) {
    return ListingCategoryRef(
      slug: json['slug'] as String,
      labelFr: (json['labelFr'] as String?) ?? '',
      family: (json['family'] as String?) ?? 'service',
      moderationLevel: (json['moderationLevel'] as String?) ?? 'standard',
    );
  }
}

/// Lien externe d'une annonce (`{ label, url }`).
class ListingExternalLink {
  const ListingExternalLink({required this.label, required this.url});

  final String label;
  final String url;

  factory ListingExternalLink.fromJson(Map<String, dynamic> json) {
    return ListingExternalLink(
      label: (json['label'] as String?) ?? '',
      url: (json['url'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toJson() => {'label': label, 'url': url};
}

/// Forme LISTING du contrat Dealplace (détail d'une annonce) — projection
/// COMPLÈTE renvoyée par POST/GET/PATCH sur /dealplace/listings/:id|slug.
class Listing {
  const Listing({
    required this.id,
    required this.ownerId,
    required this.owner,
    required this.listingType,
    required this.title,
    required this.description,
    required this.category,
    required this.subcategory,
    required this.valueKind,
    required this.valueMin,
    required this.valueMax,
    required this.currency,
    required this.city,
    required this.location,
    required this.exchangePrefs,
    required this.externalLinks,
    required this.media,
    required this.tags,
    required this.urlSlug,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String ownerId;
  final PostAuthor owner;

  /// 'good' | 'service'.
  final String listingType;
  final String title;
  final String description;
  final ListingCategoryRef category;
  final ListingSubcategory subcategory;

  /// 'fixed' | 'range'.
  final String valueKind;
  final int valueMin;
  final int? valueMax;
  final String currency;
  final String city;
  final GeoPoint? location;

  /// Sous-ensemble non vide de goods/services/money/open.
  final List<String> exchangePrefs;
  final List<ListingExternalLink> externalLinks;

  /// Médias triés par position croissante (même forme MEDIA que les posts).
  final List<PostMedia> media;
  final List<ListingTag> tags;
  final String urlSlug;

  /// 'active' | 'hidden' | 'deleted'.
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get estBien => listingType == 'good';

  factory Listing.fromJson(Map<String, dynamic> json) {
    return Listing(
      id: json['id'] as String,
      ownerId: json['ownerId'] as String,
      owner: PostAuthor.fromJson(json['owner'] as Map<String, dynamic>),
      listingType: (json['listingType'] as String?) ?? 'service',
      title: (json['title'] as String?) ?? '',
      description: (json['description'] as String?) ?? '',
      category: ListingCategoryRef.fromJson(
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
      location: json['location'] == null
          ? null
          : GeoPoint.fromJson(json['location'] as Map<String, dynamic>),
      exchangePrefs: ((json['exchangePrefs'] as List?) ?? const [])
          .whereType<String>()
          .toList(),
      externalLinks: ((json['externalLinks'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ListingExternalLink.fromJson)
          .toList(),
      media: ((json['media'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PostMedia.fromJson)
          .toList(),
      tags: ((json['tags'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ListingTag.fromJson)
          .toList(),
      urlSlug: (json['urlSlug'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'active',
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}

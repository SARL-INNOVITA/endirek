/// Modèles de la TAXONOMIE Dealplace (GET /dealplace/taxonomy) : catégories
/// actives (chacune avec famille, niveau de modération et sous-catégories) et
/// tags transversaux. Table de référence pilotée par le backoffice — le
/// formulaire de dépôt et les filtres de l'annuaire se construisent avec.
library;

/// Sous-catégorie d'une catégorie (`{ slug, labelFr }`).
class ListingSubcategory {
  const ListingSubcategory({required this.slug, required this.labelFr});

  final String slug;
  final String labelFr;

  factory ListingSubcategory.fromJson(Map<String, dynamic> json) {
    return ListingSubcategory(
      slug: json['slug'] as String,
      labelFr: (json['labelFr'] as String?) ?? '',
    );
  }
}

/// Catégorie de la taxonomie : `{ slug, family, labelFr, moderationLevel,
/// subcategories[] }`. `family` vaut 'good' (bien) ou 'service'.
class ListingCategory {
  const ListingCategory({
    required this.slug,
    required this.family,
    required this.labelFr,
    required this.moderationLevel,
    required this.subcategories,
  });

  final String slug;

  /// 'good' | 'service'.
  final String family;
  final String labelFr;

  /// 'standard' | 'sensitive' | 'forbidden' — les catégories 'forbidden'
  /// n'apparaissent pas dans la taxonomie ACTIVE, mais le champ est conservé.
  final String moderationLevel;
  final List<ListingSubcategory> subcategories;

  bool get estBien => family == 'good';

  factory ListingCategory.fromJson(Map<String, dynamic> json) {
    return ListingCategory(
      slug: json['slug'] as String,
      family: (json['family'] as String?) ?? 'service',
      labelFr: (json['labelFr'] as String?) ?? '',
      moderationLevel: (json['moderationLevel'] as String?) ?? 'standard',
      subcategories: ((json['subcategories'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ListingSubcategory.fromJson)
          .toList(),
    );
  }
}

/// Tag transversal (`{ slug, labelFr }`).
class ListingTag {
  const ListingTag({required this.slug, required this.labelFr});

  final String slug;
  final String labelFr;

  factory ListingTag.fromJson(Map<String, dynamic> json) {
    return ListingTag(
      slug: json['slug'] as String,
      labelFr: (json['labelFr'] as String?) ?? '',
    );
  }
}

/// Réponse complète de GET /dealplace/taxonomy : `{ categories[], tags[] }`.
class DealplaceTaxonomy {
  const DealplaceTaxonomy({required this.categories, required this.tags});

  final List<ListingCategory> categories;
  final List<ListingTag> tags;

  /// Catégories d'une famille donnée ('good' / 'service').
  List<ListingCategory> categoriesDeFamille(String family) {
    return categories.where((c) => c.family == family).toList();
  }

  factory DealplaceTaxonomy.fromJson(Map<String, dynamic> json) {
    return DealplaceTaxonomy(
      categories: ((json['categories'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ListingCategory.fromJson)
          .toList(),
      tags: ((json['tags'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ListingTag.fromJson)
          .toList(),
    );
  }
}

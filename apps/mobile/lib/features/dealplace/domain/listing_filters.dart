/// Filtres de l'annuaire public Dealplace (GET /dealplace/listings) — tous
/// facultatifs. Objet immuable transporté du bottom sheet de filtres jusqu'au
/// contrôleur de liste ; [copyWith] avec sentinels pour EFFACER un filtre.
library;

/// Marqueur « champ absent » : distingue « ne pas toucher » de « effacer ».
const Object _champAbsent = Object();

class ListingFilters {
  const ListingFilters({
    this.search,
    this.family,
    this.category,
    this.subcategory,
    this.city,
    this.valueMin,
    this.valueMax,
    this.tags = const [],
  });

  /// Recherche plein texte (titre + description).
  final String? search;

  /// 'good' | 'service'.
  final String? family;

  /// Slug de catégorie.
  final String? category;

  /// Slug de sous-catégorie.
  final String? subcategory;

  /// Commune (correspondance exacte insensible à la casse).
  final String? city;
  final int? valueMin;
  final int? valueMax;

  /// Slugs de tags requis (TOUS présents).
  final List<String> tags;

  /// Vrai si au moins un filtre STRUCTUREL (hors recherche texte) est actif —
  /// pilote l'indicateur visuel du bouton « Filtres ».
  bool get aFiltresActifs =>
      family != null ||
      category != null ||
      subcategory != null ||
      city != null ||
      valueMin != null ||
      valueMax != null ||
      tags.isNotEmpty;

  /// Nombre de filtres structurels actifs (badge du bouton « Filtres »).
  int get nombreFiltresActifs {
    int n = 0;
    if (family != null) n++;
    if (category != null) n++;
    if (subcategory != null) n++;
    if (city != null) n++;
    if (valueMin != null || valueMax != null) n++;
    if (tags.isNotEmpty) n++;
    return n;
  }

  /// Paramètres de requête pour GET /dealplace/listings (clés absentes si
  /// nulles ; `tags` en liste répétée gérée par Dio).
  Map<String, dynamic> toQueryParameters() {
    return {
      if (search != null && search!.trim().isNotEmpty) 'search': search!.trim(),
      if (family != null) 'family': family,
      if (category != null) 'category': category,
      if (subcategory != null) 'subcategory': subcategory,
      if (city != null) 'city': city,
      if (valueMin != null) 'valueMin': valueMin,
      if (valueMax != null) 'valueMax': valueMax,
      if (tags.isNotEmpty) 'tags': tags,
    };
  }

  ListingFilters copyWith({
    Object? search = _champAbsent,
    Object? family = _champAbsent,
    Object? category = _champAbsent,
    Object? subcategory = _champAbsent,
    Object? city = _champAbsent,
    Object? valueMin = _champAbsent,
    Object? valueMax = _champAbsent,
    List<String>? tags,
  }) {
    return ListingFilters(
      search: identical(search, _champAbsent) ? this.search : search as String?,
      family: identical(family, _champAbsent) ? this.family : family as String?,
      category: identical(category, _champAbsent)
          ? this.category
          : category as String?,
      subcategory: identical(subcategory, _champAbsent)
          ? this.subcategory
          : subcategory as String?,
      city: identical(city, _champAbsent) ? this.city : city as String?,
      valueMin:
          identical(valueMin, _champAbsent) ? this.valueMin : valueMin as int?,
      valueMax:
          identical(valueMax, _champAbsent) ? this.valueMax : valueMax as int?,
      tags: tags ?? this.tags,
    );
  }
}

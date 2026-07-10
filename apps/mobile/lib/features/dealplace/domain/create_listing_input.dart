import '../../../core/api/models/post_media.dart';
import 'listing.dart';

/// Corps de POST /dealplace/listings assemblé par l'écran de création.
///
/// Miroir de CreateListingDto côté API : le service revérifie toutes les
/// règles (valeur cohérente, photo obligatoire pour un bien, catégorie non
/// interdite, exchangePrefs non vide, médias issus de l'upload Endirek).
class CreateListingInput {
  const CreateListingInput({
    required this.listingType,
    required this.title,
    required this.description,
    required this.categorySlug,
    required this.subcategorySlug,
    required this.valueKind,
    required this.valueMin,
    this.valueMax,
    this.currency = 'EUR',
    required this.city,
    required this.exchangePrefs,
    this.externalLinks = const [],
    this.media = const [],
    this.tags = const [],
  });

  /// 'good' | 'service'.
  final String listingType;
  final String title;
  final String description;
  final String categorySlug;
  final String subcategorySlug;

  /// 'fixed' | 'range'.
  final String valueKind;
  final int valueMin;
  final int? valueMax;
  final String currency;
  final String city;
  final List<String> exchangePrefs;
  final List<ListingExternalLink> externalLinks;
  final List<PostMedia> media;
  final List<String> tags;

  Map<String, dynamic> toJson() {
    return {
      'listingType': listingType,
      'title': title,
      'description': description,
      'categorySlug': categorySlug,
      'subcategorySlug': subcategorySlug,
      'valueKind': valueKind,
      'valueMin': valueMin,
      if (valueKind == 'range' && valueMax != null) 'valueMax': valueMax,
      'currency': currency,
      'city': city,
      'exchangePrefs': exchangePrefs,
      if (externalLinks.isNotEmpty)
        'externalLinks':
            externalLinks.map((lien) => lien.toJson()).toList(),
      if (media.isNotEmpty)
        'media': media.map((element) => element.toJson()).toList(),
      if (tags.isNotEmpty) 'tags': tags,
    };
  }
}

/// Types de publication RÉSERVÉS AUX PAGES (Lot 3) : menu / offer / event.
///
/// Ces slugs sont ABSENTS de GET /posts/types (le composer utilisateur ne
/// doit pas les proposer) — le mobile les mappe donc LOCALEMENT : libellé
/// français, couleur et nom d'icône (résolu par iconePourType, comme le
/// référentiel). Table partagée entre la carte de post du fil, le détail de
/// post et la carte (marqueurs / filtres / preview).
library;

/// Visuel local d'un type de post de page.
class TypePostPage {
  const TypePostPage({
    required this.slug,
    required this.libelle,
    required this.couleurHex,
    required this.nomIcone,
  });

  final String slug;

  /// Libellé français (« Menu du jour », « Offre du jour », « Événement »).
  final String libelle;

  /// Couleur « #RRGGBB » (mêmes valeurs que le seed serveur).
  final String couleurHex;

  /// Nom d'icône symbolique, résolu par iconePourType (type_visuel.dart).
  final String nomIcone;
}

/// Table locale des trois types de page (slug → visuel), alignée sur le
/// contrat : menu #0EA5A4, offer #D97706, event #DB2777.
const List<TypePostPage> typesPostsPage = [
  TypePostPage(
    slug: 'menu',
    libelle: 'Menu du jour',
    couleurHex: '#0EA5A4',
    nomIcone: 'restaurant',
  ),
  TypePostPage(
    slug: 'offer',
    libelle: 'Offre du jour',
    couleurHex: '#D97706',
    nomIcone: 'sale',
  ),
  TypePostPage(
    slug: 'event',
    libelle: 'Événement',
    couleurHex: '#DB2777',
    nomIcone: 'event',
  ),
];

/// Visuel d'un slug de type de page, ou null si le slug n'en est pas un
/// (les posts « free » d'une page utilisent le référentiel normal).
TypePostPage? typePostPageParSlug(String slug) {
  for (final TypePostPage type in typesPostsPage) {
    if (type.slug == slug) {
      return type;
    }
  }
  return null;
}

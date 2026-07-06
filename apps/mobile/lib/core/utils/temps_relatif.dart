/// Mois français abrégés pour les dates au-delà d'une semaine.
const List<String> _mois = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

/// Formate une date en « temps relatif » français pour le fil :
/// « à l'instant », « il y a 37 min », « il y a 2 h », « il y a 3 j »,
/// puis la date courte « 12 mai » (« 12 mai 2025 » si l'année diffère).
///
/// Helper maison volontairement simple — pas de dépendance `intl` au Lot 1.
/// [reference] permet de figer « maintenant » dans les tests.
String tempsRelatif(DateTime date, {DateTime? reference}) {
  final DateTime maintenant = reference ?? DateTime.now();
  final Duration ecart = maintenant.difference(date);

  // Écart négatif (horloges désynchronisées) ou < 1 min : « à l'instant ».
  if (ecart.inMinutes < 1) {
    return "à l'instant";
  }
  if (ecart.inMinutes < 60) {
    return 'il y a ${ecart.inMinutes} min';
  }
  if (ecart.inHours < 24) {
    return 'il y a ${ecart.inHours} h';
  }
  if (ecart.inDays < 7) {
    return 'il y a ${ecart.inDays} j';
  }

  final DateTime locale = date.toLocal();
  final String jourMois = '${locale.day} ${_mois[locale.month - 1]}';
  if (locale.year == maintenant.toLocal().year) {
    return 'le $jourMois';
  }
  return 'le $jourMois ${locale.year}';
}

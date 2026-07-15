/// Formatage français propre aux PAGES (Lot 3) : prix en CENTIMES,
/// taille de fichier, jours de la semaine — testé isolément
/// (voir test/pages_formatage_test.dart).
///
/// Réutilise les constantes typographiques de dealplace_value.dart
/// (espaces insécables) pour ne jamais couper « 12,50 € » en fin de ligne.
library;

import '../../dealplace/domain/dealplace_value.dart'
    show espaceFineInsecable, espaceInsecable;
import 'page_models.dart' show PageOffer;

/// Jours de la semaine en français, indexés comme le contrat
/// (weekday 0 = lundi … 6 = dimanche).
const List<String> joursSemaine = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

/// Abréviations des jours (sélecteur « Lun 14 », « Mar 15 »...).
const List<String> joursAbreges = [
  'Lun',
  'Mar',
  'Mer',
  'Jeu',
  'Ven',
  'Sam',
  'Dim',
];

/// Mois abrégés français (« 12 mai », « 3 janv. »...).
const List<String> moisAbreges = [
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

/// Formate un PRIX en centimes à la française : 1250 → « 12,50 € »,
/// 700 → « 7,00 € », 123456 → « 1 234,56 € » (milliers en espace fine
/// insécable, virgule décimale, espace insécable avant le symbole).
String formaterPrixCentimes(int centimes) {
  final bool negatif = centimes < 0;
  final int absolu = centimes.abs();
  final int euros = absolu ~/ 100;
  final int reste = absolu % 100;

  // Séparateur de milliers insécable sur la partie entière.
  final String chiffres = euros.toString();
  final StringBuffer tampon = StringBuffer(negatif ? '-' : '');
  final int premier = chiffres.length % 3;
  for (int i = 0; i < chiffres.length; i++) {
    if (i != 0 && (i - premier) % 3 == 0) {
      tampon.write(espaceFineInsecable);
    }
    tampon.write(chiffres[i]);
  }
  tampon
    ..write(',')
    ..write(reste.toString().padLeft(2, '0'))
    ..write(espaceInsecable)
    ..write('€');
  return tampon.toString();
}

/// Ligne des prix d'un PLAT : « À emporter 7,00 € | Sur place 12,00 € »,
/// avec un seul segment si un seul prix est renseigné, ou null si aucun.
String? formaterLignePrixPlat({
  required int? aEmporterCents,
  required int? surPlaceCents,
}) {
  final List<String> segments = [
    if (aEmporterCents != null)
      'À emporter ${formaterPrixCentimes(aEmporterCents)}',
    if (surPlaceCents != null)
      'Sur place ${formaterPrixCentimes(surPlaceCents)}',
  ];
  if (segments.isEmpty) {
    return null;
  }
  return segments.join(' | ');
}

/// Convertit une saisie en euros (« 12,50 », « 12.50 », « 12 ») en CENTIMES.
/// Renvoie null si la saisie est vide ou invalide (plus de 2 décimales,
/// caractères inattendus, montant négatif).
int? centimesDepuisSaisie(String saisie) {
  final String nettoyee = saisie.trim().replaceAll(',', '.');
  if (nettoyee.isEmpty) {
    return null;
  }
  if (!RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(nettoyee)) {
    return null;
  }
  final List<String> parties = nettoyee.split('.');
  final int euros = int.parse(parties.first);
  final int centimes = parties.length == 1
      ? 0
      : int.parse(parties[1].padRight(2, '0'));
  return euros * 100 + centimes;
}

/// Saisie « en euros » depuis un prix en centimes (pré-remplissage des
/// champs d'édition d'un plat) : 1250 → « 12,50 ».
String saisieDepuisCentimes(int centimes) {
  final int euros = centimes ~/ 100;
  final int reste = centimes % 100;
  return '$euros,${reste.toString().padLeft(2, '0')}';
}

/// Taille de fichier lisible à la française : « 850 Ko », « 1,2 Mo ».
String formaterTailleFichier(int octets) {
  const int ko = 1024;
  const int mo = ko * 1024;
  if (octets >= mo) {
    final double taille = octets / mo;
    final String texte = taille >= 10
        ? taille.round().toString()
        : taille.toStringAsFixed(1).replaceAll('.', ',');
    return '$texte${espaceInsecable}Mo';
  }
  final int taille = (octets / ko).round();
  return '${taille < 1 ? 1 : taille}${espaceInsecable}Ko';
}

/// « HH:MM – HH:MM » (tiret demi-cadratin) pour une plage horaire.
String formaterPlageHoraire(String opensAt, String closesAt) {
  return '$opensAt – $closesAt';
}

/// Date courte « dd/MM » ou « dd/MM/yyyy » selon l'année courante.
String formaterDateCourte(DateTime date, {DateTime? reference}) {
  final DateTime locale = date.toLocal();
  final DateTime ref = reference ?? DateTime.now();
  String deux(int n) => n.toString().padLeft(2, '0');
  final String base = '${deux(locale.day)}/${deux(locale.month)}';
  return locale.year == ref.year ? base : '$base/${locale.year}';
}

/// Libellé français de la période d'une offre (période optionnelle) :
/// « Du 12/05 au 30/06 », « Jusqu'au 30/06 », « Depuis le 12/05 » ou
/// « Offre permanente ». [reference] fige « l'année courante » des dates
/// courtes (tests) — aujourd'hui par défaut.
String libellePeriodeOffre(PageOffer offre, {DateTime? reference}) {
  final DateTime? debut = offre.startsAt;
  final DateTime? fin = offre.endsAt;
  if (debut != null && fin != null) {
    return 'Du ${formaterDateCourte(debut, reference: reference)} '
        'au ${formaterDateCourte(fin, reference: reference)}';
  }
  if (fin != null) {
    return 'Jusqu\'au ${formaterDateCourte(fin, reference: reference)}';
  }
  if (debut != null) {
    return 'Depuis le ${formaterDateCourte(debut, reference: reference)}';
  }
  return 'Offre permanente';
}

/// Date d'événement lisible : « sam. 17 mai à 19:00 » (année ajoutée si
/// différente de l'année courante).
String formaterDateEvenement(DateTime date, {DateTime? reference}) {
  final DateTime locale = date.toLocal();
  final DateTime ref = reference ?? DateTime.now();
  String deux(int n) => n.toString().padLeft(2, '0');
  // DateTime.weekday : 1 = lundi … 7 = dimanche → index 0..6.
  final String jour = joursAbreges[locale.weekday - 1].toLowerCase();
  final String annee = locale.year == ref.year ? '' : ' ${locale.year}';
  return '$jour. ${locale.day} ${moisAbreges[locale.month - 1]}$annee '
      'à ${deux(locale.hour)}:${deux(locale.minute)}';
}

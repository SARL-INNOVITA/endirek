/// Formatage de la VALEUR d'une annonce Dealplace (`valueKind` +
/// `valueMin`/`valueMax` + `currency`) en une chaîne affichable, testée
/// isolément (voir test/dealplace_value_test.dart).
///
/// Les montants sont des ENTIERS d'euros côté contrat : on n'affiche pas de
/// décimales. Le symbole dérive de la devise (EUR donne le symbole euro,
/// sinon le code brut). Une fourchette « range » s'affiche « min – max » avec
/// le symbole accolé à chaque borne.
///
/// Typographie française : une espace INSÉCABLE fine sépare les milliers et
/// une espace insécable précède le symbole monétaire — pour ne jamais couper
/// « 1 500 € » en fin de ligne. Ces caractères sont déclarés en constantes
/// nommées (échappées) pour rester lisibles et stables dans les tests.
library;

/// Espace insécable fine (U+202F) — séparateur de milliers à la française.
const String espaceFineInsecable = ' ';

/// Espace insécable (U+00A0) — devant le symbole monétaire.
const String espaceInsecable = ' ';

/// Tiret demi-cadratin (U+2013) encadré d'espaces — séparateur de fourchette.
const String separateurFourchette = ' – ';

/// Symbole d'affichage d'un code devise ISO 4217 (repli : le code brut).
String symboleDevise(String currency) {
  return switch (currency.toUpperCase()) {
    'EUR' => '€',
    'USD' => r'$',
    _ => currency.toUpperCase(),
  };
}

/// Formate un montant entier avec séparateur de milliers insécable à la
/// française : 1500 → « 1 500 », 1234567 → « 1 234 567 ».
String _formaterMontant(int montant) {
  final String chiffres = montant.abs().toString();
  final StringBuffer tampon = StringBuffer(montant < 0 ? '-' : '');
  final int premier = chiffres.length % 3;
  for (int i = 0; i < chiffres.length; i++) {
    if (i != 0 && (i - premier) % 3 == 0) {
      tampon.write(espaceFineInsecable);
    }
    tampon.write(chiffres[i]);
  }
  return tampon.toString();
}

/// Rend la VALEUR d'une annonce en une chaîne affichable :
/// - `fixed`  → « 500 € » ;
/// - `range`  → « 500 € – 1 000 € » (borne haute manquante → repli sur fixe) ;
/// - le symbole suit le montant, séparé par une espace insécable.
///
/// [valueKind] vaut 'fixed' ou 'range' ; [valueMax] n'est utilisé qu'en
/// « range » (ignoré/inutile en « fixed »).
String formaterValeurAnnonce({
  required String valueKind,
  required int valueMin,
  int? valueMax,
  String currency = 'EUR',
}) {
  final String symbole = symboleDevise(currency);
  final String min = '${_formaterMontant(valueMin)}$espaceInsecable$symbole';
  if (valueKind == 'range' && valueMax != null) {
    final String max = '${_formaterMontant(valueMax)}$espaceInsecable$symbole';
    return '$min$separateurFourchette$max';
  }
  return min;
}

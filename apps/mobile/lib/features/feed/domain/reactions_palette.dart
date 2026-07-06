/// Palette du SÉLECTEUR de réactions (appui long sur « J'aime »).
///
/// Reflet des 6 lignes de référence de la table `reaction_types`
/// (migration 0002 / mock API). La table est pilotable par le backoffice,
/// mais l'étape 4 n'expose pas encore d'endpoint de LECTURE de cette table.
///
/// TODO(étape 5/6) : exposer un GET côté API (ex. /reactions/types) et
/// charger cette palette dynamiquement comme les types de posts. Cette
/// constante ne sert QU'À l'affichage du sélecteur — la validation des
/// emojis reste faite par l'API contre la table (400 + liste si inconnu).
class ReactionChoix {
  const ReactionChoix({required this.emoji, required this.labelFr});

  final String emoji;
  final String labelFr;
}

/// Les 6 réactions de référence, dans l'ordre de la table.
const List<ReactionChoix> paletteReactions = [
  ReactionChoix(emoji: '👍', labelFr: "J'aime"),
  ReactionChoix(emoji: '❤️', labelFr: "J'adore"),
  ReactionChoix(emoji: '😂', labelFr: 'Haha'),
  ReactionChoix(emoji: '😮', labelFr: 'Wouah'),
  ReactionChoix(emoji: '😢', labelFr: 'Triste'),
  ReactionChoix(emoji: '😡', labelFr: 'Grr'),
];

/// Emoji envoyé par un TAP simple sur « J'aime » (l'appui long ouvre le
/// sélecteur complet).
const String emojiJaimeParDefaut = '👍';

/// Libellé français d'un emoji de la palette (repli : l'emoji lui-même,
/// au cas où la table serveur contiendrait un emoji inconnu du mobile).
String labelReaction(String emoji) {
  for (final ReactionChoix choix in paletteReactions) {
    if (choix.emoji == emoji) {
      return choix.labelFr;
    }
  }
  return emoji;
}

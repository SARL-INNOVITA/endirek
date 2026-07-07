import 'package:flutter/material.dart';

import '../../../core/api/models/notification.dart';
import '../../../core/theme/endirek_theme.dart';

/// Présentation d'une notification à l'écran : libellé français construit
/// depuis `type` + `payload`, icône et couleur d'accent.
///
/// Fonctions PURES (aucun accès réseau, aucun contexte) → directement
/// testables. Tout type inconnu retombe sur un libellé et une icône
/// génériques : la table des types est pilotée par le backend, le mobile ne
/// doit jamais planter sur une valeur qu'il ne connaît pas.
class NotificationPresentation {
  const NotificationPresentation({
    required this.libelle,
    required this.icone,
    required this.couleur,
  });

  final String libelle;
  final IconData icone;
  final Color couleur;
}

/// Construit le libellé français d'une notification (une seule ligne, prêt à
/// afficher).
///
/// - comment        → « X a commenté votre publication »
/// - reply          → « X a répondu à votre commentaire »
/// - reaction       → « X a réagi à votre publication » (+ emoji si présent)
/// - report_handled → « Votre signalement a été traité »
/// - system / autre → « Notification système »
String libelleNotification(AppNotification notif) {
  final String auteur = _auteur(notif);
  return switch (notif.type) {
    'comment' => '$auteur a commenté votre publication',
    'reply' => '$auteur a répondu à votre commentaire',
    'reaction' => _libelleReaction(notif, auteur),
    'report_handled' => 'Votre signalement a été traité',
    _ => 'Notification système',
  };
}

/// Icône + couleur d'accent par type (repli générique inclus).
NotificationPresentation presentationNotification(AppNotification notif) {
  final (IconData icone, Color couleur) = switch (notif.type) {
    'comment' => (Icons.chat_bubble_outline, EndirekColors.bleu),
    'reply' => (Icons.reply_outlined, EndirekColors.bleu),
    'reaction' => (Icons.favorite_border, const Color(0xFFE0245E)),
    'report_handled' => (Icons.gavel_outlined, const Color(0xFF16A34A)),
    _ => (Icons.notifications_none, EndirekColors.encreSecondaire),
  };
  return NotificationPresentation(
    libelle: libelleNotification(notif),
    icone: icone,
    couleur: couleur,
  );
}

/// « X a réagi à votre publication », suffixé de l'emoji si le payload en
/// porte un.
String _libelleReaction(AppNotification notif, String auteur) {
  final dynamic emoji = notif.payload['emoji'];
  final String base = '$auteur a réagi à votre publication';
  if (emoji is String && emoji.isNotEmpty) {
    return '$base $emoji';
  }
  return base;
}

/// Nom de l'auteur de l'action, avec repli « Quelqu'un » quand le payload ne
/// porte pas de `fromDisplayName` exploitable.
String _auteur(AppNotification notif) {
  final dynamic valeur = notif.payload['fromDisplayName'];
  if (valeur is String && valeur.trim().isNotEmpty) {
    return valeur.trim();
  }
  return 'Quelqu\'un';
}

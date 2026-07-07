# feature: notifications — Cloche + écran (Lot 1, checkpoint 5)

Notifications in-app de l'utilisateur courant (les MIENNES uniquement — ownership
garanti côté API).

## Contenu

- `data/notifications_repository.dart` : `GET /notifications`,
  `GET /notifications/unread-count`, `PATCH /notifications/:id/read`,
  `PATCH /notifications/read-all`.
- `domain/notification_presentation.dart` : libellés français **purs** construits
  depuis `type` + `payload` (testés dans `test/notification_presentation_test.dart`) :
  - `comment` → « X a commenté votre publication »
  - `reply` → « X a répondu à votre commentaire »
  - `reaction` → « X a réagi à votre publication » (+ emoji si présent)
  - `report_handled` → « Votre signalement a été traité »
  - `system` / type inconnu → `payload.title`, sinon `payload.message`,
    sinon « Notification système » (jamais d'erreur)
- `application/notifications_controller.dart` : état de l'écran, marquage lu
  **optimiste** (UI + badge mis à jour immédiatement, resynchro si l'appel échoue),
  insertion en tête d'une notification reçue en temps réel.
- `application/unread_count_controller.dart` : compteur GLOBAL de non-lues (badge de
  la cloche du header). Alimenté par (a) l'écran notifs, (b) le socket
  `notification.created`, (c) le POLLING de repli.
- `presentation/notifications_screen.dart` : liste antéchronologique (icône par type,
  libellé, temps relatif, surbrillance des non-lues), tap → marque lue + navigue vers
  `/post/:postId` si le payload en porte un, « Tout marquer comme lu »,
  pull-to-refresh, états chargement / vide / erreur.

## Temps réel & fallback

La cloche (`core/shell/app_shell.dart`) affiche le badge `unreadCountProvider`. Il se
met à jour via :

1. le **socket** `notification.created` (voir `core/realtime/`) → le serveur envoie
   `{ notification, unreadCount }`, appliqué tel quel ;
2. le **polling de repli** : quand le socket n'est pas connecté, un timer rafraîchit
   `GET /notifications/unread-count` toutes les ~45 s en avant-plan.

Le temps réel est un CONFORT, jamais une source de vérité : le REST reste l'autorité.
Push FCM/APNs prévu plus tard (adapter mocké côté API).

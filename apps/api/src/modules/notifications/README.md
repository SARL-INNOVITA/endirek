# Module `notifications` — Notifications in-app

Notifications utilisateur **in-app** du Lot 1 (le push Firebase/APNs viendra
plus tard, variables `FIREBASE_*` / `FCM_SERVER_KEY` déjà prévues côté config,
rien à brancher au Lot 1). La diffusion temps réel passe par le module
`realtime` (socket.io).

## Point d'entrée UNIQUE : `NotificationsService.create`

Tous les producteurs de notifications passent par `NotificationsService.create`
(jamais par le repository en direct). Cette méthode **persiste** la notification
via `NotificationsRepository.create` **puis émet** l'événement temps réel
`notification.created` vers la room privée du destinataire
(`RealtimeGateway.emitNotification`) avec le `unreadCount` à jour. Une seule
source pour la persistance ET la diffusion.

Point d'extension : la diffusion est un simple appel à `RealtimeGateway` après
persistance ; brancher le push mobile (PUSH_DRIVER) se fera au même endroit,
sans toucher aux appelants.

La règle **« jamais à soi-même »** reste de la responsabilité de l'appelant
(lui seul connaît l'émetteur de l'événement) :
- réaction : l'auteur du post qui réagit à son propre post n'est pas notifié ;
- report_handled : l'admin qui traite son propre signalement n'est pas notifié ;
- comment/reply : l'auteur d'un commentaire sur son propre post/commentaire
  n'est pas notifié.

## Événements notifiés au Lot 1

| Type            | Émis quand                                              | Destinataire            | Payload                                                                 |
| --------------- | ------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| `comment`       | un commentaire est posté sur un post                    | auteur du post          | `{ postId, commentId, fromUserId, fromDisplayName, excerpt }`          |
| `reply`         | une réponse est postée à un commentaire principal       | auteur du commentaire   | `{ ...comment, parentCommentId }`                                      |
| `reaction`      | une réaction est **ajoutée** à un **post** (pas retrait)| auteur du post          | `{ postId, fromUserId, fromDisplayName, emoji }`                       |
| `report_handled`| un admin traite un signalement (reviewed/action/dismiss)| auteur du signalement   | `{ reportId, status, targetType }`                                     |
| `system`        | réservé (alertes système)                               | —                       | libre                                                                  |

Les réactions **sur commentaire** et les **retraits** de réaction ne notifient
personne au Lot 1 (hors périmètre). Les producteurs vivent dans leurs modules
respectifs (`comments`, `reactions`, `admin` / admin-reports), qui importent
`NotificationsModule` pour appeler `NotificationsService.create`.

## Endpoints (authentifié — mes notifications uniquement)

Toutes les routes sont protégées par le guard JWT global et ne servent QUE les
notifications de l'utilisateur courant.

- `GET /api/v1/notifications?limit&offset`
  → `{ items: NOTIFICATION[], total, unreadCount }`, antéchronologique.
- `GET /api/v1/notifications/unread-count` → `{ unreadCount }`
  (compteur léger — cible du **polling de repli** quand le socket est indispo).
- `PATCH /api/v1/notifications/:id/read` → `204` (idempotent).
  **Ownership** : `404 « Notification introuvable »` si la notification
  n'appartient pas au user courant (on ne révèle jamais l'existence d'une
  notification d'autrui). Contrôle via `NotificationsRepository.findById`.
- `PATCH /api/v1/notifications/read-all` → `204`.

Forme `NOTIFICATION` : `{ id, type, payload, readAt, createdAt }`.

L'ordre des routes du contrôleur est important : `/unread-count` et `/read-all`
(segments littéraux) sont déclarées AVANT `:id/read` pour ne jamais être
captées comme un `:id`.

## Temps réel & repli

- Event `notification.created` → room `user:<userId>`, payload
  `{ notification: NOTIFICATION, unreadCount }` (émis après persistance).
- **Fallback** : si le socket est indisponible (réseau, proxy), le client
  retombe sur du polling de `GET /notifications/unread-count`. Le temps réel
  est un confort, jamais une source de vérité — la base reste l'autorité.

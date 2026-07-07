# Module `reactions` — Réactions emoji

**Statut : LIVRÉ (étape 4 du Lot 1).**

Rôle : réactions emoji sur les posts ET les commentaires.

Endpoints :
- `POST /api/v1/posts/:id/reactions { emoji }` → 200
  `{ reactionCount, reactionsTop, viewerReaction }` (upsert : changer
  d'emoji remplace la réaction) ;
- `DELETE /api/v1/posts/:id/reactions` → 200 idem (retrait idempotent,
  `viewerReaction: null`) ;
- `POST /api/v1/comments/:id/reactions { emoji }` et
  `DELETE /api/v1/comments/:id/reactions` → 200
  `{ reactionCount, viewerReaction }`.

Règles métier appliquées :
- la palette (6 emojis au seed : 👍 ❤️ 😂 😮 😢 😡) vit dans la table
  `reaction_types`, **pilotable par le backoffice — jamais hardcodée** : la
  validation interroge `ReactionsRepository.listActiveTypes()` et répond
  `400` avec la liste des emojis valides sinon ;
- une seule réaction par utilisateur et par cible (UNIQUE côté SQL,
  upsert côté repository) ;
- compteurs dénormalisés (`posts.reaction_count`,
  `comments.reaction_count`) recalculés à chaque mutation ;
- la popularité issue des réactions alimente le scoring du feed
  (voir `modules/posts/feed.service.ts`).

Depuis le checkpoint 5, les réactions sur une publication créent aussi une
notification in-app `reaction` pour l'auteur du post (jamais à soi-même),
via `NotificationsService.create` : persistance, compteur de non-lues et
émission socket `notification.created` sont centralisés au même endroit.
Les réactions sur commentaires mettent à jour le compteur mais ne notifient
pas encore au Lot 1.

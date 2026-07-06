# Module `saved-posts` — Enregistrements

**Statut : LIVRÉ (étape 4 du Lot 1).**

Rôle : permettre à l'utilisateur d'enregistrer des posts pour les retrouver
plus tard, organisés par collections.

Endpoints :
- `POST /api/v1/posts/:id/save` → 204 (idempotent) ;
- `DELETE /api/v1/posts/:id/save` → 204 (idempotent) ;
- `GET /api/v1/users/me/saved-posts?limit=&offset=` →
  `{ items: FEED_POST[], total }`, du plus récemment enregistré au plus
  ancien — les posts devenus `hidden`/`deleted` sont exclus.

Choix de route documenté : `GET /users/me/saved-posts` est déclaré ICI
(`user-saved-posts.controller.ts`) et non dans le module `users`, car la
forme servie est FEED_POST (couche posts) — aucune collision possible :
« me/saved-posts » a deux segments, jamais capturé par « :id » de
`UsersController` (même schéma que `modules/posts/user-posts.controller.ts`).

Règles métier appliquées :
- collection par défaut **« Général »** créée au besoin
  (`SavedRepository.getOrCreateDefaultCollection`) — l'utilisateur
  enregistre dans cette collection au Lot 1 (collections personnalisées
  envisagées plus tard — TODO Lot 2+) ;
- l'enregistrement est privé (invisible pour l'auteur du post) ;
- `saveCount` du post recalculé à chaque save/unsave.

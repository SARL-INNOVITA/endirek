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

TODO (étape 5) : notification in-app `reaction` pour l'auteur du post —
les endpoints notifications n'existant pas encore, l'écriture est différée
avec eux.

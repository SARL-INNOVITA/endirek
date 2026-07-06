# Module `comments` — Commentaires

**Statut : LIVRÉ (étape 4 du Lot 1).**

Rôle : commentaires sous les posts et réponses aux commentaires.

Endpoints :
- `GET /api/v1/posts/:id/comments` — racines paginées (`?limit=&offset=`,
  triées created ASC), réponses actives imbriquées created ASC ;
- `POST /api/v1/posts/:id/comments` — commentaire principal ou réponse
  (`parentCommentId`) ;
- `DELETE /api/v1/comments/:id` — soft-delete par l'auteur du commentaire
  OU l'auteur du post.

Règles métier appliquées :
- **Option A (décision produit validée)** — deux niveaux :
  - depth 0 : commentaire principal ;
  - depth 1 : réponse à un commentaire principal ;
  - **niveau 2+ REFUSÉ** : `400 « Les réponses aux réponses ne sont pas
    disponibles »` (le parent doit aussi appartenir au même post). Le schéma
    reste évolutif (`parent_comment_id` auto-référent + CHECK `depth IN (0,1)`
    à élargir si un lot futur l'exige) ;
- une racine supprimée qui garde **au moins une réponse active** est servie
  comme emplacement : `isDeleted: true`, `body: ''` (le fil ne casse pas) ;
  sans réponse active elle est exclue, et les réponses supprimées sont
  toujours exclues ;
- `commentCount` du post recalculé à chaque création/suppression (compte les
  commentaires `active` uniquement) ;
- notifications in-app à la création (via `NotificationsRepository`, lecture
  à l'étape 5) : type `comment` pour l'auteur du post, type `reply` pour
  l'auteur du commentaire parent — jamais à soi-même, jamais deux
  notifications à la même personne pour le même événement. Payload :
  `{ postId, commentId, fromUserId, fromDisplayName, excerpt }`
  (+ `parentCommentId` pour un `reply`) ;
- les commentaires sont signalables et masquables via le backoffice
  (voir `moderation` et `admin` — étape 6).

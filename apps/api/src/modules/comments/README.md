# Module `comments` — Commentaires

**Statut : TODO — implémentation prévue à l'étape 4 du Lot 1.**

Rôle : commentaires sous les posts et réponses aux commentaires.

Règles métier clés :
- **Décision produit validée (option A, MVP)** — deux niveaux d'affichage :
  - niveau 0 : commentaire principal ;
  - niveau 1 : réponse à un commentaire principal ;
  - **pas de réponse à une réponse au Lot 1**. Le service/API/UI refusent
    (ou normalisent vers le niveau 1) toute tentative de niveau 2+.
  Le schéma reste évolutif (`parent_comment_id` auto-référent + CHECK
  `depth IN (0,1)` à élargir si un lot futur l'exige) ;
- compteur de commentaires maintenu sur chaque post ;
- un nouveau commentaire ou une réponse déclenche une notification in-app
  (voir module `notifications`) ;
- les commentaires sont signalables et masquables via le backoffice
  (voir `moderation` et `admin`).

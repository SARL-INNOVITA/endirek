# Module `moderation` — Signalements et modération

**Statut : PARTIELLEMENT LIVRÉ — signalement côté utilisateur ET traitement
backoffice livrés à l'étape 4 ; le signalement des commentaires et la
notification « signalement traité » restent pour l'étape 6 du Lot 1.**

Rôle : signalement des contenus par les utilisateurs et traitement
par les modérateurs.

Livré (étape 4) :
- `POST /api/v1/posts/:id/report { reasonCode, message? }` → 201
  `{ id, status: 'open' }` :
  - `reasonCode` ∈ `spam | hateful | dangerous | false_info | other` ;
  - le post signalé **reste actif** tant qu'un admin n'a pas statué
    (l'état de signalement vit dans la table `reports`) ;
  - **auto-signalement refusé** (décision produit) : signaler sa propre
    publication → 400 « Vous ne pouvez pas signaler votre propre
    publication » — cela ne produirait que du bruit backoffice, l'auteur
    dispose déjà de la suppression de son propre post ;
  - anti-doublon : un même utilisateur ne signale la même cible qu'une
    fois → 409 « Vous avez déjà signalé ce contenu » (contrainte UNIQUE
    `reports_reporter_target_unique`, reproduite par le mock) — y compris
    sous concurrence : la violation d'unicité levée par la couche
    repository (`UniqueViolationError`) est rattrapée et traduite en 409,
    jamais en 500 ;
  - équivalence documentée : le statut `'open'` correspond au « pending »
    de la spécification produit.

Livré (étape 4, côté backoffice — voir module `admin`) :
- file de signalements consultable et filtrable
  (`GET /api/v1/admin/reports?status=&targetType=` — avec auteur du
  signalement et extrait de la cible) ;
- traitement d'un signalement
  (`PATCH /api/v1/admin/reports/:id { status, resolutionNote? }` —
  `reviewed | action_taken | dismissed`, `handledBy`/`handledAt` posés) ;
- masquage/republication d'une publication signalée
  (`PATCH /api/v1/admin/posts/:id/status { status: active|hidden }` —
  `deleted` refusé : la suppression appartient à l'auteur ou au flux RGPD).

Périmètre restant (étape 6) :
- signaler un commentaire côté utilisateur (le schéma ET la file backoffice
  le supportent déjà : cible polymorphe) ;
- notification « post signalé traité » envoyée à l'auteur du signalement
  (via le module `notifications`).

Anticipation : la modération s'étendra aux pages, deals et News IA
supervisées (TODO Lot 2+).

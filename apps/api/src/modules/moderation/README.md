# Module `moderation` — Signalements et modération

**Statut : LIVRÉ pour le périmètre Lot 1 — signalement de publications,
traitement backoffice, notification `report_handled` et modération des
commentaires signalés.**

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

Livré (checkpoint 6, côté backoffice) :
- `GET /api/v1/admin/reports?targetType=comment` permet de filtrer les
  commentaires signalés déjà présents en base (la cible polymorphe existait
  depuis l'étape 4) ;
- `PATCH /api/v1/admin/comments/:id/status { status }` permet de masquer,
  réactiver ou soft-delete un commentaire. Un commentaire `deleted` n'est pas
  restauré par le backoffice ; une racine masquée/supprimée qui a encore des
  réponses actives reste servie au public comme emplacement vide ;
- quand un signalement est traité, `AdminReportsService` crée une
  notification `report_handled` pour l'auteur du signalement (sauf si c'est
  l'admin qui traite son propre signalement), via `NotificationsService.create`.

Limite restante : l'endpoint utilisateur pour signaler directement un
commentaire n'est pas exposé au Lot 1 ; le schéma et la file admin le
supportent, mais l'UI mobile ne propose pas encore cette action.

Anticipation : la modération s'étendra aux pages, deals et News IA
supervisées (TODO Lot 2+).

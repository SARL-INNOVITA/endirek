# Module `moderation` — Signalements et modération

**Statut : TODO — implémentation prévue à l'étape 6 du Lot 1.**

Rôle : signalement des contenus par les utilisateurs et traitement
par les modérateurs.

Périmètre Lot 1 :
- signaler un post ou un commentaire (motif + commentaire libre) ;
- file de signalements consultable dans le backoffice (module `admin`) ;
- traitement d'un signalement : masquer le contenu ou rejeter le signalement ;
- notification « post signalé traité » envoyée à l'auteur du signalement
  (via le module `notifications`).

Anticipation : la modération s'étendra aux pages, deals et News IA
supervisées (TODO Lot 2+).

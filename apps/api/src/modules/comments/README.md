# Module `comments` — Commentaires

**Statut : TODO — implémentation prévue à l'étape 4 du Lot 1.**

Rôle : commentaires sous les posts et réponses aux commentaires.

Règles métier clés :
- réponses aux commentaires limitées à **2 niveaux maximum**.
  ⚠️ Ambiguïté à trancher avant l'étape 4 (question posée au product owner) :
  le prompt Lot 1 dit « réponses aux commentaires sur 2 niveaux », ce qui
  peut se lire (a) commentaire → réponse (1 niveau de réponses) ou
  (b) commentaire → réponse → réponse-à-réponse (2 niveaux de réponses,
  modèle Facebook). **Interprétation provisoire retenue : (b)**, le mockup
  `09 Post Météo` n'étant pas discriminant. Le schéma DB (parent_comment_id
  + contrainte de profondeur en service) supporte les deux sans migration ;
- compteur de commentaires maintenu sur chaque post ;
- un nouveau commentaire ou une réponse déclenche une notification in-app
  (voir module `notifications`) ;
- les commentaires sont signalables et masquables via le backoffice
  (voir `moderation` et `admin`).

# Module `posts` — Publications

**Statut : TODO — implémentation prévue à l'étape 4 du Lot 1.**

Rôle : création et gestion des posts, cœur de l'expérience « Live Local ».

Types de posts du Lot 1 : publication libre, point météo, point trafic,
accident/danger, question/besoin d'aide (chacun avec icône et formulaire adaptés).

Règles métier clés :
- publication libre et question/aide : **feed uniquement** ;
- météo/trafic/danger : **feed + carte si géolocalisés** ; localisation
  obligatoire pour apparaître sur la carte (message clair sinon, choix d'un
  emplacement sur la carte ou via coordonnées) ;
- expiration **carte** après **2 h par défaut (paramétrable)** — le post reste
  visible dans le feed après expiration ;
- chaque post public porte un **`url_slug`** pour une URL web partageable future ;
- champ **`page_id` nullable** prévu pour les posts de pages (TODO Lot 2+).

# feature: post_composer

**Statut : livré au Lot 1.**

Flux de création d'une publication depuis le composer compact du feed :

1. bottom sheet de choix du type via `GET /posts/types` ;
2. formulaire adapté au type ;
3. texte obligatoire, titre optionnel ;
4. jusqu'à 4 images sélectionnées depuis la galerie et uploadées via
   `POST /media/upload` ;
5. pour les types carte, bascule "Publier sur la carte" et sélection d'une
   commune via `GET /map/communes`.

Règles Lot 1 :

- météo/trafic/danger peuvent apparaître sur la carte si une commune est choisie ;
- sans localisation, ils restent feed-only ;
- publication libre et question/aide restent feed-only ;
- la position publiée est le centre de la commune choisie, pas encore le GPS réel.

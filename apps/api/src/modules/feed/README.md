# Module `feed` — Fil d'actualité

**Statut : TODO — implémentation prévue à l'étape 4 du Lot 1.**

Rôle : composition du fil d'actualité de l'onglet Accueil.

Algorithme MVP (simple, sans machine learning) combinant :
- **récence** du post ;
- **proximité** géographique (La Réunion) ;
- **type de post** (les alertes météo/trafic/danger peuvent être priorisées) ;
- **popularité** (réactions, commentaires, partages) ;
- **abonnements** (posts des comptes suivis).

Règle : les posts météo/trafic/danger expirés de la carte restent visibles
dans le feed. Pagination par curseur prévue pour le scroll infini mobile.

# Module `feed` — Fil d'actualité

**Statut : IMPLÉMENTÉ dans le module `posts`** (`../posts/feed.service.ts`) —
ce dossier ne contient pas de code : le scoring partage les repositories et
l'assembleur FEED_POST du module posts, un module séparé n'aurait fait que du
câblage (décision étape 4, documentée ici).

Endpoint : `GET /api/v1/posts/feed?limit=&offset=&lat=&lng=` →
`{ items: FEED_POST[], total }`.

## Algorithme MVP (sans machine learning)

Poids centralisés dans la constante **`FEED_WEIGHTS`** (feed.service.ts —
aucune valeur magique dispersée) :

- **récence** : décroissance exponentielle, demi-vie ~6 h ;
- **proximité** : si `lat`/`lng` fournis, bonus décroissant avec la distance
  haversine au post (divisé par 2 tous les 10 km) ;
- **type** : bonus des alertes (`showsOnMap`, piloté par `post_types`)
  encore visibles carte ;
- **popularité** : `log(1 + réactions + commentaires)` ;
- **abonnements** : bonus si l'auteur est suivi par le viewer.

Implémentation mock : fenêtre des 200 posts `active` les plus récents scorée
en mémoire, tri score DESC avec tie-break (createdAt DESC, id) pour un ordre
**stable**, pagination offset/limit. Le driver postgres portera ce scoring en
SQL (fenêtre en sous-requête, score en expression) avec les mêmes poids.

Règle : les posts météo/trafic/danger expirés de la carte restent visibles
dans le feed. Pagination par curseur envisagée plus tard pour le scroll
infini mobile (offset/limit au MVP).

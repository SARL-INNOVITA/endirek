# `common` — Code partagé de l'API

Rôle : éléments transverses réutilisés par tous les modules métier —
**DTO communs, décorateurs, guards, intercepteurs et helpers**.

Contenu prévu (rempli à partir de l'étape 3 du Lot 1) :
- DTO génériques (pagination par curseur, réponses d'erreur normalisées) ;
- décorateurs (`@CurrentUser()`, rôles admin…) ;
- guards (JWT, rôles) et intercepteurs (sérialisation, logging) ;
- helpers partagés (slugs `url_slug`, coordonnées géographiques, dates).

Règle : ce dossier ne contient aucune logique métier — uniquement du code
technique réutilisable. Vide (hors ce README) à l'étape 1.

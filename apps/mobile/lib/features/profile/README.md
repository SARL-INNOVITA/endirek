# feature: profile

Implémenté à l'étape 3 (profil du user COURANT uniquement) :

- `presentation/profile_screen.dart` — couverture (si présente), avatar avec
  initiales en repli, nom, ville, bio, stats abonnés/abonnements/publications,
  boutons « Modifier le profil » et « Se déconnecter », tirer-pour-rafraîchir ;
- `presentation/edit_profile_screen.dart` — édition displayName / bio / ville
  → `PATCH /users/me/profile`, retour avec le profil rafraîchi ;
- `data/profile_repository.dart` — accès aux endpoints `users` via le client
  Dio de `core/api`.

## Limites restantes

L'API expose déjà `POST/DELETE /users/:id/follow` et les listes
`GET /users/:id/followers|following`, mais **aucune UI n'est branchée à cette
étape** : le Lot 1 ne comporte pas encore de surface de découverte
d'utilisateurs ni de profil public d'autrui. À prévoir dans un lot ultérieur :

- profil PUBLIC d'un autre utilisateur (`GET /users/:id`) avec bouton
  Suivre / Ne plus suivre ;
- listes d'abonnés / abonnements paginées (`?limit=&offset=`).

Restent aussi hors Lot 1 : activité récente détaillée, avatar/couverture
éditables via upload médias et profil Dealplace.

# feature: profile

Implémenté à l'étape 3 (profil du user COURANT uniquement) :

- `presentation/profile_screen.dart` — couverture (si présente), avatar avec
  initiales en repli, nom, ville, bio, stats abonnés/abonnements/publications,
  boutons « Modifier le profil » et « Se déconnecter », tirer-pour-rafraîchir ;
- `presentation/edit_profile_screen.dart` — édition displayName / bio / ville
  → `PATCH /users/me/profile`, retour avec le profil rafraîchi ;
- `data/profile_repository.dart` — accès aux endpoints `users` via le client
  Dio de `core/api`.

## TODO étape 7 — follow / unfollow

L'API expose déjà `POST/DELETE /users/:id/follow` et les listes
`GET /users/:id/followers|following`, mais **aucune UI n'est branchée à cette
étape** : il n'existe encore aucune surface de découverte d'utilisateurs
(feed, recherche, profil public d'autrui) avant l'étape 7. À prévoir alors :

- profil PUBLIC d'un autre utilisateur (`GET /users/:id`) avec bouton
  Suivre / Ne plus suivre ;
- listes d'abonnés / abonnements paginées (`?limit=&offset=`).

Restent aussi pour l'étape 7 (mockup `04 Profil - Mes infos`) : activité
récente, publications récentes, avatar/couverture éditables (upload médias),
onglet « Profil Dealplace » placeholder (Lot 2).

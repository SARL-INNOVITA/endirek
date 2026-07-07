# Module `users` - Utilisateurs et profils

**Statut : livré au Lot 1.**

Rôle : profils utilisateurs, relation de suivi, export/suppression RGPD et
lecture publique minimale.

Routes principales :

- `GET /users/me/profile` et `PATCH /users/me/profile` ;
- `GET /users/me/export` et `DELETE /users/me` ;
- `GET /users/:id` ;
- `POST /users/:id/follow` et `DELETE /users/:id/follow` ;
- `GET /users/:id/followers` et `GET /users/:id/following`.

Règles importantes :

- un compte `suspended` ou `deleted` ne peut plus utiliser ses jetons ;
- les emails ne sont jamais exposés dans les profils publics ;
- `DELETE /users/me` anonymise le compte et soft-delete ses contenus ;
- les abonnements alimentent le scoring du feed.

Limite Lot 1 : le mobile n'a pas encore de profil public d'autrui ni de surface
de découverte utilisateur ; les endpoints follow sont prêts pour un lot
ultérieur.

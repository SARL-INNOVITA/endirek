# Module `auth` — Authentification

**Statut : TODO — implémentation prévue à l'étape 3 du Lot 1.**

Rôle : authentification des utilisateurs et émission des jetons d'accès.

Périmètre Lot 1 :
- inscription et connexion **email / mot de passe** (priorité) ;
- JWT access token (`JWT_EXPIRES_IN=15m`) + refresh token (`JWT_REFRESH_EXPIRES_IN=30d`) ;
- structure **prête pour Google / Apple** : les variables `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET` et `APPLE_CLIENT_ID` existent déjà dans la config —
  si les clés manquent, on ne bloque pas : endpoints placeholders documentés.

Règles : aucun secret hardcodé ; hachage des mots de passe côté serveur ;
guards et décorateurs partagés placés dans `src/common`.

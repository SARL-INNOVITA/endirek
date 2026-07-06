# core/

Socle transverse de l'application mobile Endirek (démarré à l'étape 3 pour
l'auth et les profils, complété à l'étape 7) :

- `config/` — configuration d'environnement : `ApiConfig` (API_BASE_URL via
  `--dart-define`, sinon défaut intelligent web/émulateur Android).
- `theme/` — thème clair provisoire (bleu #1173D4, fond blanc, surfaces
  #F6F7F8, cartes arrondies 16) ; sera raffiné à l'étape 7 sur les mockups
  (typographie type Sora, ombres légères).
- `router/` — navigation `go_router` pilotée par l'état d'authentification
  (étape 3 : /login, /register, /profile, /profile/edit) ; le shell 4 onglets
  (Accueil, Carte, News, Dealplace) arrive à l'étape 7.
- `api/` — client HTTP (dio) : Bearer automatique, rafraîchissement unique du
  jeton sur 401, erreurs mappées en `ApiException` (messages français
  affichables), modèles partagés (`models/user_profile.dart`).
- `auth/` — stockage sécurisé des jetons (`flutter_secure_storage`) et
  `AuthController` Riverpod (login, register, logout, restauration de session).

Règle : `core/` ne dépend d'aucune feature, SAUF `router/` qui référence les
écrans des features pour construire les routes ; les features dépendent de
`core/` (jamais d'une autre feature).

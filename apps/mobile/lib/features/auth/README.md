# feature: auth

Implémenté à l'étape 3 :

- `presentation/login_screen.dart` — connexion email + mot de passe
  (validation locale, erreurs API en français, état de chargement), lien
  « Créer un compte », boutons Google / Apple présents mais **désactivés**
  avec la mention « bientôt disponible » (le backend répond 501, voir
  docs/MOCKED_SERVICES.md) ;
- `presentation/register_screen.dart` — inscription : nom affiché (2-50),
  email, mot de passe ≥ 8 caractères + confirmation.

L'état d'authentification (jetons JWT access + refresh en stockage sécurisé,
restauration de session via `GET /auth/me`, rafraîchissement automatique sur
401) vit dans `core/auth` — voir `AuthController`.

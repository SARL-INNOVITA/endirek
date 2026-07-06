# Module `auth` — Authentification

**Statut : IMPLÉMENTÉ (Lot 1 étape 3).**

Rôle : authentification des utilisateurs et émission des jetons d'accès.

## Routes (préfixe global `/api/v1`)

| Route | Accès | Réponse |
| --- | --- | --- |
| `POST /auth/register` | public | 201 `{ user: PROFIL COMPLET, accessToken, refreshToken }` — 409 si email déjà pris |
| `POST /auth/login` | public | 200 même forme — 401 « Identifiants invalides » (message identique quelle que soit la cause), 403 « Compte suspendu » |
| `POST /auth/refresh` | public | 200 `{ accessToken, refreshToken }` — 401 si jeton invalide/expiré ou compte inactif |
| `POST /auth/logout` | authentifié | 204 — stateless : rien n'est révoqué côté serveur (limite documentée), le client jette ses jetons |
| `GET /auth/me` | authentifié | 200 PROFIL COMPLET du compte courant |
| `POST /auth/oauth/google` | public | 501 « Connexion Google non disponible pour le moment » (placeholder) |
| `POST /auth/oauth/apple` | public | 501 « Connexion Apple non disponible pour le moment » (placeholder) |

## Jetons (config `auth` — aucun secret hardcodé)

- **access** : payload `{ sub: userId, role }`, signé `auth.jwtSecret`,
  durée `auth.jwtExpiresIn` (défaut 15m) ;
- **refresh** : payload `{ sub, tokenType: 'refresh' }`, signé
  `auth.refreshSecret`, durée `auth.refreshExpiresIn` (défaut 30d).

Mots de passe hachés **bcryptjs, coût 10**. Email normalisé (trim +
minuscules) à l'inscription et à la connexion.

## Sécurité transverse

Ce module enregistre `JwtAuthGuard` (voir `src/common/guards`) comme guard
GLOBAL (`APP_GUARD`) : toute route non `@Public()` exige un Bearer token, et
le guard recharge l'utilisateur à chaque requête — les jetons d'un compte
supprimé (RGPD) ou suspendu cessent immédiatement de fonctionner.

## OAuth Google / Apple

Structure prête : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et
`APPLE_CLIENT_ID` existent dans la configuration (`.env.example`). Tant que
les clés ne sont pas fournies, les endpoints répondent 501 proprement.

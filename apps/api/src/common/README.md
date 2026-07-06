# `common` — Code partagé de l'API

Rôle : éléments transverses réutilisés par tous les modules métier —
**décorateurs et guards** (étape 3), étendus au fil des étapes (helpers,
intercepteurs…). Ce dossier ne contient **aucune logique métier** :
uniquement du code technique réutilisable.

## Contenu actuel (étape 3 — auth)

### `decorators/`

| Décorateur | Fichier | Usage |
| --- | --- | --- |
| `@Public()` | `public.decorator.ts` | Marque une route/un contrôleur comme public : le guard JWT global le laisse passer sans jeton (health, register, login, refresh, OAuth placeholders). Clé de métadonnée exportée : `IS_PUBLIC_KEY`. |
| `@CurrentUser()` | `current-user.decorator.ts` | Injecte l'identité `{ userId, role }` (`AuthenticatedUser`) posée sur la requête par `JwtAuthGuard`. |
| `@Roles(...rôles)` | `roles.decorator.ts` | Restreint une route aux rôles listés (`'moderator'`, `'super_admin'`…) — lu par `RolesGuard`. Clé exportée : `ROLES_KEY`. Prévu pour le module admin. |

### `guards/`

- `jwt-auth.guard.ts` — **guard GLOBAL** (enregistré via `APP_GUARD` dans
  `AuthModule`) : toute route non `@Public()` exige `Authorization: Bearer
  <accessToken>`. Le guard vérifie la signature (`auth.jwtSecret`), puis
  **recharge l'utilisateur** via `USERS_REPOSITORY` et revérifie son statut à
  CHAQUE requête : compte inexistant/`deleted` → 401, `suspended` → 403
  « Compte suspendu ». C'est ce rechargement qui invalide les jetons après
  une suppression RGPD ou une suspension, sans liste de révocation.
- `roles.guard.ts` — compare le rôle de la requête à `@Roles(...)` ; neutre
  sans métadonnée ; 403 sinon. S'utilise avec `@UseGuards(RolesGuard)`.

## Règles

- Textes destinés aux utilisateurs et commentaires en **français** ; messages
  d'erreur sobres, sans détail technique.
- Pas de secret hardcodé : les secrets JWT viennent de la configuration typée
  (`src/config/configuration.ts`, groupe `auth`).
- Le code de `common` ne dépend que de `config/` et des contrats de
  `database/` (tokens + interfaces) — jamais d'un module métier.

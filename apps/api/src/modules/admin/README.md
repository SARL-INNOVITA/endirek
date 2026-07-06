# Module `admin` — Endpoints du backoffice minimal

**Statut : PARTIEL — gestion des utilisateurs livrée à l'étape 3 ; le reste
du backoffice arrive à l'étape 6 du Lot 1.**

Rôle : API consommée par le backoffice web (`apps/admin`), réservée aux
comptes administrateurs (rôles `moderator` et `super_admin`).

## Fait à l'étape 3 — gestion des utilisateurs

Toutes les routes sont protégées par le guard JWT global (401 sans jeton)
**et** `RolesGuard` + `@Roles('moderator', 'super_admin')` (403 pour un
utilisateur simple). Elles renvoient le **PROFIL COMPLET** (email, role,
status, settings inclus — forme réservée aux administrateurs, mutualisée
via `src/common/mappers/profile.mapper.ts`).

- `GET /api/v1/admin/users?search=&status=&limit=&offset=` — liste paginée
  `{ items, total }` ; `search` filtre sur nom affiché et email (insensible
  à la casse), `status` filtre par statut (`active`, `suspended`,
  `deleted` — les comptes supprimés restent visibles pour l'audit).
- `GET /api/v1/admin/users/:id` — profil complet quel que soit le statut ;
  404 uniquement si l'identifiant n'existe pas.
- `PATCH /api/v1/admin/users/:id/status` `{status}` — suspension /
  réactivation d'un compte. Règles :
  - statuts posables : `active` et `suspended` **uniquement** — la
    suppression d'un compte passe exclusivement par le flux RGPD
    (`DELETE /users/me`, soft-delete + anonymisation), jamais par le
    backoffice ;
  - 403 « Impossible de modifier le statut d'un super administrateur » si
    la cible est un `super_admin` (compte racine intouchable) ;
  - 409 si la cible est un compte `deleted` (anonymisé par le flux RGPD,
    il n'est plus réactivable) ;
  - un compte suspendu ne peut plus se connecter (`403 Compte suspendu`)
    et ses jetons encore valides cessent de fonctionner immédiatement :
    le guard JWT recharge l'utilisateur et revérifie son statut à chaque
    requête.

## À venir à l'étape 6 (backoffice minimal complet)

- gérer les **posts** et **commentaires** (voir les données de base,
  masquer un post) ;
- traiter les **signalements** (via le module `moderation`) ;
- gérer les **caméras météo/trafic** : créer, modifier, supprimer,
  activer/désactiver (numéro auto type `#23`, ville déduite par géocodage
  mocké et ajustable — voir module `cameras`) ;
- gérer les catégories/types de posts si pertinent.

Anticipation : backoffice avancé et analytics (TODO Lot 2+).

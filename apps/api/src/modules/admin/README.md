# Module `admin` — Endpoints du backoffice minimal

**Statut : PARTIEL — gestion des utilisateurs livrée à l'étape 3, modération
des publications et file des signalements livrées à l'étape 4 ; le reste du
backoffice (caméras + paramétrage des types de posts) arrive à l'étape 6 du
Lot 1.**

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

## Fait à l'étape 4 — modération des publications et des signalements

Mêmes protections que les routes utilisateurs (guard JWT global + `RolesGuard`
+ `@Roles('moderator', 'super_admin')` → 401/403). La forme publication
servie est le **FEED_POST** du contrat (assemblé par `FeedPostAssembler` du
module `posts` — source unique avec le feed public), enrichi de
`openReportsCount` (nombre de signalements `open` visant le post).

### Publications — `admin-posts`

- `GET /api/v1/admin/posts?typeSlug=&status=&search=&limit=&offset=` —
  liste paginée `{ items, total }`, **tous statuts** (`active`, `hidden`,
  `deleted` — audit), antéchronologique ; `search` cherche dans le titre,
  le corps et le nom affiché de l'auteur (insensible à la casse).
- `GET /api/v1/admin/posts/:id` — FEED_POST quel que soit le statut +
  `reports` liés `[{ id, reasonCode, message, status, createdAt,
  reporter: AUTEUR }]` ; 404 uniquement si l'identifiant n'existe pas.
- `PATCH /api/v1/admin/posts/:id/status` `{status}` — masquer (`hidden`)
  ou republier (`active`) une publication. Règles :
  - `deleted` est **refusé** → 400 « La suppression appartient à l'auteur
    ou au flux RGPD » (la suppression passe par `DELETE /posts/:id` côté
    auteur ou par le flux RGPD, jamais par le backoffice) ;
  - une publication déjà `deleted` n'est pas restaurable → 409 ;
  - un post masqué disparaît du feed, de la carte et du détail public
    (404 pour tous sauf l'auteur et les modérateurs) mais reste en base.

### Signalements — `admin-reports` (file de modération)

- `GET /api/v1/admin/reports?status=&targetType=&limit=&offset=` — file
  paginée antéchronologique ; chaque signalement embarque `reporter`
  (forme AUTEUR) et `target`, un **extrait de la cible** (corps ≤ 140
  caractères) : pour un post `{id, title, body, typeSlug, status,
  urlSlug}`, pour un commentaire `{id, body, status, postId}`, `null` si
  la cible est introuvable (ou de type `user` — Lot 2+).
- `PATCH /api/v1/admin/reports/:id` `{status, resolutionNote?}` — pose la
  décision (`reviewed`, `action_taken` ou `dismissed`) avec `handledBy` =
  admin courant et `handledAt` = now. Le contenu visé n'est **pas**
  modifié : le masquer est une action séparée (PATCH statut du post).
- Équivalence documentée : le statut `open` correspond au « pending » de
  la spécification produit.

## À venir à l'étape 6 (backoffice minimal complet)

- gérer les **caméras météo/trafic** : créer, modifier, supprimer,
  activer/désactiver (numéro auto type `#23`, ville déduite par géocodage
  mocké et ajustable — voir module `cameras`) ;
- **paramétrer les types de posts** (table `post_types` pilotable :
  libellés, couleurs, durées carte, activation) ;
- modération des **commentaires** côté backoffice si nécessaire (le
  signalement d'un commentaire existe déjà dans la file).

Anticipation : backoffice avancé et analytics (TODO Lot 2+).

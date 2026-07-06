# Endirek — Backoffice web (`apps/admin`)

Backoffice d'administration d'**Endirek**, le réseau social mobile local temps
réel de La Réunion.

**Stack** : React 19 + Vite 7 + TypeScript — CSS pur, sans framework UI,
sans routeur (un simple état de vue suffit à ce stade).

## Fonctionnalités (Lot 1, étapes 3 et 4)

Backoffice de gestion des **utilisateurs** (étape 3), des **publications**
et des **signalements** (étape 4), avec une navigation par onglets simples
dans l'en-tête connecté — l'onglet « Signalements » porte le nombre de
signalements ouverts.

### Connexion et session

- **Connexion administrateur** (`POST /api/v1/auth/login`) — l'entrée est
  réservée aux rôles `moderator` et `super_admin` ; un compte classique
  reçoit « Accès réservé aux administrateurs ». La session est restaurée au
  chargement via `GET /api/v1/auth/me`, avec bouton « Se déconnecter ».
  Le jeton d'accès est conservé en `localStorage` (choix de développement
  documenté dans `src/api.ts` — TODO : cookie httpOnly/session plus tard).
- La carte **« État de l'API »** (`GET /health`) de l'étape 1 est conservée,
  en version compacte dans le pied de page.

### Utilisateurs (étape 3)

- **Vue Utilisateurs** (`GET /api/v1/admin/users`) : tableau paginé
  (20 par page, précédent/suivant, total) avec avatar/initiales, nom, email,
  ville, rôle (badge bleu), statut (badge vert actif / orange suspendu /
  gris supprimé), abonnés, publications et date d'inscription. Recherche
  nom/email avec debounce et filtre par statut (tous/actifs/suspendus/
  supprimés).
- **Panneau détail** au clic (`GET /api/v1/admin/users/:id`) : profil
  complet + action « Suspendre » / « Réactiver »
  (`PATCH /api/v1/admin/users/:id/status`) avec confirmation. Le statut d'un
  super administrateur est intouchable (403 API) et un compte supprimé
  (flux RGPD) n'est jamais réactivable (409 API) — messages clairs à l'écran.

### Publications (étape 4)

- **Vue Publications** (`GET /api/v1/admin/posts`) : tableau paginé
  (20 par page) de TOUTES les publications, tous statuts confondus
  (`active` / `hidden` / `deleted` — audit). Colonnes : type (badge coloré —
  libellé `labelFr` et couleur issus du référentiel `GET /api/v1/posts/types`,
  chargé une fois, jamais hardcodés), extrait titre/corps tronqué, auteur,
  statut (badge Active / Masquée / Supprimée), réactions, commentaires,
  signalements ouverts (badge rouge si > 0) et date de création. Filtres
  type + statut et recherche titre/corps/nom d'auteur avec debounce.
- **Panneau détail** au clic (`GET /api/v1/admin/posts/:id`) : contenu
  complet, vignettes des médias (cliquables : l'original s'ouvre dans un
  nouvel onglet), commune, localisation, expiration carte, compteurs, et la
  liste des **signalements liés** (motif, statut, auteur, message).
- Actions **« Masquer » / « Réactiver »** (`PATCH /api/v1/admin/posts/:id/status`)
  avec confirmation, puis rafraîchissement de la liste. La suppression reste
  réservée à l'auteur ou au flux RGPD (400 API) et une publication supprimée
  n'est jamais restaurée par le backoffice (409 API).

### Signalements (étape 4)

- **Vue Signalements** (`GET /api/v1/admin/reports`) : file de modération
  antéchronologique, paginée (20 par page). Colonnes : cible (type
  Publication/Commentaire + extrait ≤ 140 caractères fourni par l'API),
  motif en français (Spam / Contenu haineux / Contenu dangereux / Fausse
  information / Autre), signaleur, statut (badge Ouvert / Examiné / Action
  prise / Rejeté) et date. Filtre par statut, **« Ouverts » par défaut**
  (rappel : `open` = « pending » de la spécification produit).
- **Panneau détail** au clic : message complet du signaleur, extrait de la
  cible avec son statut, décisions **« Marquer examiné »** (`reviewed`),
  **« Action prise »** (`action_taken`) et **« Rejeter »** (`dismissed`)
  via `PATCH /api/v1/admin/reports/:id`, avec **note de résolution**
  facultative (textarea, ≤ 500 caractères) et confirmation. L'API renseigne
  `handledBy` (admin courant) et `handledAt`.
- Si la cible est une publication : bouton **« Voir la publication »** qui
  ouvre le panneau publication (le même que la vue Publications), depuis
  lequel on peut la **masquer** — le flux complet « signalement ouvert →
  voir la publication → masquer → action prise » se fait sans quitter la vue.
- L'onglet « Signalements » de l'en-tête porte le **nombre de signalements
  ouverts** (un fetch minimal du total, rechargé après chaque décision).

### Découpage (`src/`)

| Fichier               | Rôle                                                          |
| --------------------- | ------------------------------------------------------------- |
| `api.ts`              | Client HTTP typé (auth + admin users/posts/reports) et jeton  |
| `App.tsx`             | État de session + onglets (badge signalements ouverts)        |
| `LoginView.tsx`       | Formulaire de connexion + garde-fou de rôle                   |
| `UsersView.tsx`       | Tableau utilisateurs, recherche, filtre statut, pagination    |
| `UserDetail.tsx`      | Panneau détail compte + suspension/réactivation               |
| `PostsView.tsx`       | Tableau publications, filtres type/statut, recherche          |
| `PostDetailAdmin.tsx` | Panneau détail publication + Masquer/Réactiver                |
| `ReportsView.tsx`     | File de modération + décisions et note de résolution          |
| `HealthCard.tsx`      | Bandeau compact « État de l'API » (pied de page)              |
| `ui.tsx`              | Badges (rôles, statuts, types), avatar, dates, hook types     |

## Compte de test (seed de développement)

Avec l'API lancée sur le mock (`DB_DRIVER=mock`), connectez-vous avec le
**super administrateur du seed « Équipe Endirek »** :

- **Email** : voir l'entrée « Équipe Endirek » dans
  [`apps/api/src/database/seed/users.seed.ts`](../api/src/database/seed/users.seed.ts)
  (source de vérité de l'email exact) ;
- **Mot de passe** : `endirek974` — mot de passe de **développement** commun
  à tous les comptes du seed (jamais utilisé en production).

Le compte « Marie Hoarau » (`moderator`) du même seed permet de tester le
second rôle admis ; n'importe quel autre compte du seed permet de vérifier
le refus « Accès réservé aux administrateurs ».

## Lancement

Depuis la **racine du monorepo** :

```bash
npm install          # une seule fois — installe tous les workspaces
npm run api:dev      # l'API (obligatoire pour se connecter)
npm run admin:dev    # démarre le serveur de développement Vite
```

Le backoffice est alors disponible sur **http://localhost:5173**.

## Configuration

Copiez `.env.example` en `.env` puis ajustez si besoin :

| Variable       | Description                                    | Défaut                  |
| -------------- | ---------------------------------------------- | ----------------------- |
| `VITE_API_URL` | URL de base de l'API Endirek (sans slash final) | `http://localhost:3001` |

Aucun secret ne doit être commité : `.env` est ignoré par git, et les
variables `VITE_*` sont exposées au navigateur (n'y mettre que des valeurs
publiques).

## Build de production

```bash
npm run admin:build   # tsc -b && vite build → apps/admin/dist
```

## Périmètre prévu à l'étape 6

- **Publications** : mise en avant (la modération masquer/réactiver est
  livrée à l'étape 4) ;
- **Commentaires** : modération dédiée (aujourd'hui : signalements de
  commentaires visibles dans la file, extrait inclus) ;
- **Caméras météo/trafic** : gestion des flux affichés dans l'app mobile ;
- **Paramètres des types de posts** : configuration des catégories de
  publications (la table `post_types` est déjà pilotable côté API).

<!-- TODO Lot 2+ : statistiques d'usage, gestion fine des rôles,
     notifications push administrées, exports. -->

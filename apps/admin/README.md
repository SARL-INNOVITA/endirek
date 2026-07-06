# Endirek — Backoffice web (`apps/admin`)

Backoffice d'administration d'**Endirek**, le réseau social mobile local temps
réel de La Réunion.

**Stack** : React 19 + Vite 7 + TypeScript — CSS pur, sans framework UI,
sans routeur (un simple état de vue suffit à ce stade).

## Fonctionnalités (Lot 1, étape 3)

Backoffice **minimal de gestion des utilisateurs** :

- **Connexion administrateur** (`POST /api/v1/auth/login`) — l'entrée est
  réservée aux rôles `moderator` et `super_admin` ; un compte classique
  reçoit « Accès réservé aux administrateurs ». La session est restaurée au
  chargement via `GET /api/v1/auth/me`, avec bouton « Se déconnecter ».
  Le jeton d'accès est conservé en `localStorage` (choix de développement
  documenté dans `src/api.ts` — TODO : cookie httpOnly/session plus tard).
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
- La carte **« État de l'API »** (`GET /health`) de l'étape 1 est conservée,
  en version compacte dans le pied de page.

### Découpage (`src/`)

| Fichier          | Rôle                                                    |
| ---------------- | ------------------------------------------------------- |
| `api.ts`         | Client HTTP typé (auth + admin) et gestion du jeton     |
| `App.tsx`        | État de session (restauration, login, déconnexion)      |
| `LoginView.tsx`  | Formulaire de connexion + garde-fou de rôle             |
| `UsersView.tsx`  | Tableau, recherche (debounce), filtre statut, pagination |
| `UserDetail.tsx` | Panneau détail + suspension/réactivation                |
| `HealthCard.tsx` | Bandeau compact « État de l'API » (pied de page)        |
| `ui.tsx`         | Badges rôle/statut, avatar (initiales), formats de date |

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

- **Publications** : modération, mise en avant, suppression ;
- **Commentaires** : modération ;
- **Signalements** : file de traitement des contenus signalés ;
- **Caméras météo/trafic** : gestion des flux affichés dans l'app mobile ;
- **Paramètres des types de posts** : configuration des catégories de
  publications.

<!-- TODO Lot 2+ : statistiques d'usage, gestion fine des rôles,
     notifications push administrées, exports. -->

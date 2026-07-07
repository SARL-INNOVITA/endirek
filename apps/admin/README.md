# Endirek — Backoffice web (`apps/admin`)

Backoffice d'administration d'**Endirek**, le réseau social mobile local temps
réel de La Réunion.

**Stack** : React 19 + Vite 7 + TypeScript — CSS pur, sans framework UI,
sans routeur (un simple état de vue suffit à ce stade).

## Fonctionnalités (Lot 1, étapes 3 à 6)

Backoffice de gestion des **utilisateurs** (étape 3), des **publications**
et des **signalements** (étape 4), des **caméras** météo / trafic
(checkpoint 5), puis des **paramètres Lot 1** (types de posts, commentaires
signalés, notification système dev/mock) au checkpoint 6. Navigation par
onglets simples dans l'en-tête connecté — l'onglet « Signalements » porte le
nombre de signalements ouverts.

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
  nom/email avec debounce et filtres par statut (tous/actifs/suspendus/
  supprimés) et rôle (`user`/`moderator`/`super_admin`).
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
  type + statut + visibilité carte (`mapVisible`) et recherche
  titre/corps/nom d'auteur avec debounce.
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
  prise / Rejeté) et date. Filtres par statut et type de cible, **« Ouverts »
  par défaut** (rappel : `open` = « pending » de la spécification produit ;
  l'API accepte aussi `status=pending` comme alias).
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
- Si la cible est un commentaire : actions **Masquer**, **Réactiver** ou
  **Soft-delete** (`PATCH /api/v1/admin/comments/:id/status`). Un commentaire
  `deleted` n'est pas restauré par le backoffice.

### Caméras (checkpoint 5)

Gestion des **caméras météo / trafic** affichées sur la carte de l'app mobile.
Réservée, comme les autres sections, aux rôles `moderator` et `super_admin`
(guard JWT global + `RolesGuard` côté API — 403 pour un compte simple).

- **Vue Caméras** (`GET /api/v1/admin/cameras`) : tableau paginé (20 par page)
  de TOUTES les caméras, tous statuts confondus (`active` / `inactive` /
  `error` / `hidden`). Colonnes : **numéro** (`cameraNumber`, attribué
  automatiquement par l'API), **nom**, **catégorie** (badge Météo / Trafic),
  **statut** (badge Active vert / Inactive gris / En erreur rouge / Masquée
  sombre), **ville**, **coordonnées** courtes (lat, lng à 4 décimales) et un
  lien **« Ouvrir ↗ »** vers le flux (nouvel onglet). Filtres **catégorie** +
  **statut** et **recherche** nom / ville / description avec debounce.
- **Bouton « + Nouvelle caméra »** : ouvre le formulaire de création
  (`CameraForm`) en panneau latéral (`POST /api/v1/admin/cameras`, `201`).
- **Formulaire création / édition** (`CameraForm.tsx`) : nom, catégorie
  (Météo / Trafic), type de flux (Image / Vidéo / Iframe), URL, description,
  latitude, longitude, ville et quartier.
  - **Ville laissée vide** → **déduite automatiquement côté serveur** à partir
    des coordonnées (géocodage inverse) — indiqué sous le champ.
  - **Validation côté client** avant l'appel : nom (1–120 caractères), URL
    `http`/`https` (protocole obligatoire), et coordonnées dans l'**emprise
    approximative de La Réunion** (latitude −21.6…−20.7, longitude 55.0…56.0,
    mêmes bornes que l'API). Un point hors emprise est refusé avec un message
    clair, sans aller-retour ; l'API reste l'autorité et renvoie sinon un
    `400 « La caméra doit être située à La Réunion »`, affiché tel quel.
- **Panneau détail** au clic sur une ligne : description, type de flux, lien
  vers le flux, ville, quartier, coordonnées et dates, avec :
  - **Modifier** (`PATCH /api/v1/admin/cameras/:id`, champs partiels) ;
  - **Changement de statut** (`PATCH /api/v1/admin/cameras/:id/status`) :
    **Activer** / **Désactiver** / **Marquer en erreur** ;
  - **Masquer** (`DELETE /api/v1/admin/cameras/:id`) = **suppression douce**
    avec confirmation (`window.confirm`) : la caméra passe en statut `hidden`,
    **aucune suppression dure**, le `cameraNumber` est préservé.
- **Sécurité (rappel du contrat)** : la carte publique ne sert **jamais** que
  les caméras `active`. Masquer (ou passer en `inactive` / `error`) une caméra
  la **retire immédiatement de la carte** et de son détail public
  (`GET /api/v1/cameras/:id` → `404 « Caméra introuvable »`, sans divulguer
  son existence). Toute action recharge la liste.

### Paramètres (checkpoint 6)

- **Types de posts** (`GET /api/v1/admin/post-types`,
  `PATCH /api/v1/admin/post-types/:slug`) : liste tous types actifs/inactifs,
  édition du libellé, icône, couleur, activation, `showsOnMap`, localisation
  requise, durée carte par défaut et ordre. Le slug est immuable ; seuls
  `weather`, `traffic`, `danger` sont éligibles carte au Lot 1. Les changements
  de durée ne recalculent pas les posts existants.
- **Notification système dev/mock** (`POST /api/v1/admin/notifications/system`) :
  envoi à un utilisateur actif ou à tous les comptes actifs, via le service
  notifications in-app + WebSocket. Aucun push FCM/APNs réel.

### Découpage (`src/`)

| Fichier               | Rôle                                                          |
| --------------------- | ------------------------------------------------------------- |
| `api.ts`              | Client HTTP typé (auth + admin users/posts/reports/caméras/types/notifs) et jeton |
| `App.tsx`             | État de session + onglets (badge signalements ouverts)        |
| `LoginView.tsx`       | Formulaire de connexion + garde-fou de rôle                   |
| `UsersView.tsx`       | Tableau utilisateurs, recherche, filtre statut, pagination    |
| `UserDetail.tsx`      | Panneau détail compte + suspension/réactivation               |
| `PostsView.tsx`       | Tableau publications, filtres type/statut, recherche          |
| `PostDetailAdmin.tsx` | Panneau détail publication + Masquer/Réactiver                |
| `ReportsView.tsx`     | File de modération + décisions et note de résolution          |
| `CamerasView.tsx`     | Tableau caméras, filtres, actions de statut, masquage doux    |
| `CameraForm.tsx`      | Formulaire création / édition d'une caméra (validation client) |
| `SettingsView.tsx`    | Types de posts pilotables + notification système dev/mock     |
| `HealthCard.tsx`      | Bandeau compact « État de l'API » (pied de page)              |
| `ui.tsx`              | Badges (rôles, statuts, types, caméras), avatar, dates, hook types |

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

## Limites restantes

- Les notifications système sont un outil dev/mock in-app ; pas de push distant.
- Les types de posts ne sont ni créés ni supprimés au checkpoint 6 ; les slugs
  Lot 1 restent les clés métier.
- Les changements de durée carte des types ne recalculent pas les posts
  existants.

<!-- TODO Lot 2+ : statistiques d'usage, gestion fine des rôles,
     notifications push administrées, exports. -->

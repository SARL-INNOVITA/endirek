# Endirek Mobile

Application mobile Flutter d'Endirek (Android / iOS, cible web pour le dev rapide).

## Lancement

```bash
cd apps/mobile
flutter pub get
flutter run                 # appareil/émulateur Android connecté
flutter run -d chrome       # aperçu web rapide sans émulateur
```

Émulateur disponible sur la machine de dev : `Pixel_3a_API_34`.

## Écrans disponibles (Lot 1 checkpoint 7)

- **Connexion** (`/login`) — email + mot de passe, boutons Google/Apple
  présents mais désactivés (« bientôt disponible », le backend répond 501) ;
- **Inscription** (`/register`) — nom affiché, email, mot de passe ≥ 8
  caractères + confirmation ;
- **Shell à 4 onglets** (Accueil, Carte, News, Dealplace) — Accueil et Carte
  sont réels ; News et Dealplace restent des placeholders propres ;
- **Fil d'actualité** (`/home`) — feed scoré de l'API, infinite scroll
  (offset/limit) + tirer-pour-rafraîchir, cartes de post (type, médias,
  compteurs) avec actions J'aime / Commenter / Partager / Enregistrer et
  palette de réactions (appui long) ;
- **Création de post** (`/compose`) — bottom sheet de choix du type
  (référentiel `GET /posts/types`), formulaire adapté, jusqu'à 4 images
  choisies dans la galerie (`image_picker`) et uploadées via
  `POST /media/upload`, sélecteur de commune pour les types carte ;
- **Détail d'un post** (`/post/:id`) — médias, réactions, commentaires
  deux niveaux (répondre seulement à un commentaire principal — option A),
  menu ⋯ Signaler / Modifier / Supprimer (si auteur) ;
- **Profil** (`/profile`) — couverture, avatar, bio, stats, section « Mes
  publications », déconnexion, tirer-pour-rafraîchir ;
- **Édition du profil** (`/profile/edit`) — nom affiché, bio, ville.
- **Carte** (`/map`) — carte météo/trafic réelle, tuiles OSM dev, clustering,
  filtres, preview cards, caméras actives et détail caméra ;
- **Notifications** (`/notifications`) — liste in-app, badge de cloche,
  lecture unitaire/tout lire, libellés `comment`/`reply`/`reaction`/
  `report_handled`/`system`.

## Limites connues (Lot 1)

- **Partage non fonctionnel** : le bouton « Partager » affiche « Partage
  disponible prochainement » — aucun endpoint de partage côté API, le
  compteur `shareCount` reste à 0. **TODO** (lot ultérieur) : partage natif
  (`share_plus`) + comptage.
- **Pas de GPS réel** : la position d'un post carte est le **centre-ville
  de la commune choisie** (sélecteur alimenté par `GET /map/communes`).
  **TODO Lot 2+** : position GPS de l'appareil (`geolocator`) et choix sur
  carte interactive.
- La palette de réactions du mobile est locale (miroir du seed
  `reaction_types`) — un GET dédié côté API reste à prévoir.
- Les onglets **News** et **Dealplace** restent des placeholders Lot 1.

Principales dépendances : Riverpod, go_router, Dio, `flutter_secure_storage`,
`image_picker`, `flutter_map`, `socket_io_client` et `flutter_localizations`.

> Les textes rédigés par l'app et les libellés système Material sont localisés
> en français via `flutter_localizations`.

## Comptes de test

Avec l'API en mode mock seedé (défaut), n'importe quel compte du seed
La Réunion se connecte avec le **mot de passe de dev `endirek974`** —
ex. `marie.hoarau@endirek.invalid` (liste complète :
`apps/api/src/database/seed/users.seed.ts`). L'inscription d'un nouveau
compte fonctionne aussi (données perdues au redémarrage de l'API).

## Configuration

L'URL de base de l'API est déduite automatiquement (`lib/core/config/api_config.dart`) :
web/desktop → `http://localhost:3001`, émulateur Android → `http://10.0.2.2:3001`
(alias du localhost de la machine hôte). Pour un **appareil physique** ou une
API distante, la forcer à la compilation :

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:3001
```

## Stockage des jetons

Les jetons JWT (access + refresh) sont conservés via `flutter_secure_storage` :

- **Android** : Android Keystore ; **iOS/macOS** : Keychain — stockage
  sécurisé réel ;
- **Web** : repli sur le `localStorage` du navigateur, qui n'est **pas un
  stockage sécurisé** (lisible par tout script de la page — XSS). Documenté
  et accepté pour le développement uniquement ; avant une production web,
  migrer vers des cookies httpOnly posés par le backend (voir
  `lib/core/auth/token_storage.dart` et
  [docs/KNOWN_LIMITS.md](../../docs/KNOWN_LIMITS.md)).

Le client API (Dio) pose le Bearer token sur chaque requête et tente **une**
fois `POST /auth/refresh` sur 401 avant de déconnecter proprement.

## Structure

- `lib/core/` — thème, navigation, client API, auth, config (voir `lib/core/README.md`).
- `lib/features/` — architecture feature-first (voir `lib/features/README.md`).

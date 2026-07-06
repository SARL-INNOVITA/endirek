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

## Écrans disponibles (étape 3)

- **Connexion** (`/login`) — email + mot de passe, boutons Google/Apple
  présents mais désactivés (« bientôt disponible », le backend répond 501) ;
- **Inscription** (`/register`) — nom affiché, email, mot de passe ≥ 8
  caractères + confirmation ;
- **Profil** (`/profile`) — couverture, avatar, bio, stats
  abonnés/abonnements/publications, déconnexion, tirer-pour-rafraîchir ;
- **Édition du profil** (`/profile/edit`) — nom affiché, bio, ville.

Le shell complet à 4 onglets (Accueil, Carte, News, Dealplace) arrive à
l'étape 7, fidèle aux mockups de `02_MOCKUPS/`.

> Tous les textes rédigés par l'app sont en français, mais les libellés
> **système de Material** (boutons par défaut des dialogues, tooltips internes,
> sélecteurs de date…) restent en **anglais** tant que `flutter_localizations`
> n'est pas branché — prévu à l'étape 7 (TODO déjà posé dans `lib/main.dart`).

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

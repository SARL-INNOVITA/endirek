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

## Configuration

L'URL de l'API se passera via `--dart-define` (mise en place à l'étape 7) :

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001
```

> `10.0.2.2` = localhost de la machine hôte vu depuis l'émulateur Android.

## Structure

- `lib/core/` — thème, navigation, client API, config (voir `lib/core/README.md`).
- `lib/features/` — architecture feature-first (voir `lib/features/README.md`).

L'UI sera développée à l'**étape 7** du Lot 1, fidèle aux mockups de `02_MOCKUPS/`.
Pour l'instant, `lib/main.dart` est le squelette généré par `flutter create`.

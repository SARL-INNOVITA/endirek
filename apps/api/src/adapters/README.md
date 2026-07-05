# adapters/

Intégrations externes **remplaçables** de l'API Endirek. Chaque adapter =
une interface stable + des implémentations sélectionnées par variable
d'environnement ; le code métier ne connaît que l'interface (bascule
mock → service réel sans changement de code métier).

| Adapter | Variable de sélection | Dev (mock) | Prod (cible) | Posé à |
|---|---|---|---|---|
| Stockage médias | `MEDIA_STORAGE_DRIVER` | `local` (disque `uploads/`) | `s3` (S3/Hetzner) | étape 4 |
| Géocodage inverse | `GEOCODING_PROVIDER` | `mock` (communes de La Réunion) | API réelle | étape 5 |
| Push | `PUSH_DRIVER` | `mock` (persistance en base seule) | `fcm` (Firebase/APNs) | étape 5 |
| Email | `EMAIL_DRIVER` | `mock` (log console) | `brevo` | étape 3 |

> La persistance suit le même pattern mais vit dans `src/database/`
> (`DB_DRIVER=mock|postgres`, étape 2).

Détail des comportements : `docs/MOCKED_SERVICES.md`.

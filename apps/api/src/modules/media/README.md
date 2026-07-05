# Module `media` — Médias

**Statut : TODO — implémentation prévue à l'étape 4 du Lot 1.**

Rôle : upload, stockage et diffusion des médias attachés aux posts
(images, vidéos optionnelles).

Périmètre Lot 1 :
- upload de médias optionnels lors de la création de post ;
- **adapter remplaçable** sélectionné par `MEDIA_STORAGE_DRIVER` :
  - `local` : fichiers écrits dans `UPLOAD_DIR` (développement) ;
  - `s3` : stockage compatible S3/Hetzner (production) — variables `S3_*`.

Règle : la même interface de stockage sert les deux drivers ; aucun code
métier ne doit dépendre du driver actif.

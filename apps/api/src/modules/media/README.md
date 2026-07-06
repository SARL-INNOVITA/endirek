# Module `media` — Médias

**Statut : implémenté (étape 4 du Lot 1) — images uniquement.**

Rôle : upload, stockage et diffusion des médias attachés aux posts.

## Endpoint

- `POST /api/v1/media/upload` (authentifié, multipart champ `file`)
  → `201 { url, thumbnailUrl, width, height, mediaType: 'image' }`.

## Règles Lot 1

- **Images uniquement** : JPEG, PNG ou WebP, validées par **décodage réel**
  (`sharp.metadata()`) — le mimetype déclaré par le client ne prouve rien.
  Sinon : `400 « Fichier invalide : seules les images JPEG, PNG ou WebP
  sont acceptées »`.
- Taille max : `MEDIA_MAX_FILE_SIZE_MB` (défaut 8 Mo) → `413` au-delà
  (limite multer, stockage en **mémoire**, aucun fichier temporaire disque).
- Orientation EXIF corrigée (`rotate()`) ; miniature 400 px de large
  (ratio conservé, format webp, jamais agrandie).
- Noms de fichiers **aléatoires** (crypto) + extension dérivée du format
  détecté — jamais le nom envoyé par le client.
- **Adapter remplaçable** (`src/adapters/media-storage/`), sélectionné par
  `MEDIA_STORAGE_DRIVER` :
  - `local` : fichiers écrits sous `UPLOAD_DIR` (sous-dossiers `AAAA/MM`),
    servis statiquement sur `/uploads/` (public, hors guard — voir
    `main.ts`) ;
  - `s3` : **non implémenté au Lot 1** — le démarrage échoue avec une
    erreur explicite.

Règle : la même interface de stockage sert tous les drivers ; aucun code
métier ne dépend du driver actif.

**TODO (lot ultérieur)** : upload de vidéos (transcodage/poster frame).

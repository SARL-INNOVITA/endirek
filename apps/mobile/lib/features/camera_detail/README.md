# feature: camera_detail — Détail caméra (Lot 1, checkpoint 5)

Écran `/camera/:id` (`GET /cameras/:id` → CAMERA_PUBLIC, caméras `active` uniquement).

## Contenu

- `data/cameras_repository.dart` : `GET /cameras/:id`. Un 404 « Caméra introuvable »
  (inexistante OU non `active`) remonte en `ApiException`.
- `application/camera_detail_controller.dart` : `FutureProvider.family<Camera, String>`.
- `presentation/camera_detail_screen.dart` :
  - `streamType == 'image'` → `Image.network(resolveMediaUrl(url))` + badge LIVE ;
  - `streamType == 'video' | 'iframe'` → repli « Flux non affichable dans l'app au
    Lot 1 » + rappel de l'URL du flux (pas d'ouverture navigateur — aucune dépendance
    supplémentaire autorisée) ;
  - métadonnées : nom, badge de catégorie (météo/trafic), ville + quartier,
    description, numéro `#N`, coordonnées ;
  - 404 → message dédié « Caméra introuvable » (pas de bouton réessayer : définitif) ;
    autres erreurs → message générique + « Réessayer ».

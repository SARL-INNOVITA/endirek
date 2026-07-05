# Module futur `pages` — Pages restaurants et entreprises

**TODO Lot 2+ — anticipation architecturale uniquement, rien à implémenter au Lot 1.**

Vision Endirek : chaque utilisateur pourra créer et administrer des **pages
restaurant ou entreprise** (identité, horaires, menu/offres, publications au
nom de la page, abonnés).

Points d'ancrage déjà prévus dans le socle du Lot 1 :
- champ **`page_id` nullable sur les posts** : un post pourra être publié
  au nom d'une page sans changer le modèle ;
- relation propriétaire prévue côté `users` ;
- **`url_slug`** : les pages auront elles aussi une URL web partageable ;
- la modération (`moderation`) et le backoffice (`admin`) s'étendront aux pages.

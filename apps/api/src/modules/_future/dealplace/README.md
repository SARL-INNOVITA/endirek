# Module futur `dealplace` — Listings biens et services

**TODO Lot 2+ — anticipation architecturale uniquement, rien à implémenter au Lot 1.**

Vision Endirek : la Dealplace est la place de marché locale — des **listings
de biens et de services** publiés par les utilisateurs ou les pages, avec une
**valeur obligatoire** sur chaque listing (base des futurs deals contractuels).

Au Lot 1, l'onglet Dealplace du mobile est un écran placeholder propre.

Points d'ancrage déjà prévus dans le socle :
- architecture modulaire NestJS : le module se branchera dans `app.module.ts` ;
- **`url_slug`** pour des listings partageables sur le web ;
- adapters médias (`media`) et géocodage réutilisés tels quels ;
- la carte (`map`) accueillera le mode « Offres & restos » (placeholder visuel au Lot 1).

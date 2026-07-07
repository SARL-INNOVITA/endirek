# feature: feed

**Statut : livré au Lot 1.**

Onglet Accueil : feed scoré de l'API, composer compact, cartes de posts,
pagination offset/limit, pull-to-refresh et actions sociales.

Surfaces principales :

- `presentation/feed_screen.dart` : liste principale, empty/loading/error states,
  composer compact et infinite scroll ;
- `presentation/widgets/post_card.dart` : carte de publication, compteurs,
  réactions, commentaire, partage placeholder, enregistrement ;
- `application/posts_liste_controller.dart` : pagination réutilisée par le feed
  et "Mes publications" ;
- `data/posts_repository.dart` : accès feed/posts/actions.

Limites restantes : partage natif non branché, bonus GPS du feed non actif tant
que la position réelle du viewer n'est pas collectée.

# feature: post_detail

**Statut : livré au Lot 1.**

Écran `/post/:id` :

- détail complet du post : média, type, ville, temps relatif, auteur, titre et
  corps ;
- réactions et compteurs synchronisés avec les cartes du feed ;
- commentaires niveau 0 + réponses niveau 1 uniquement (option A) ;
- champ de commentaire fixe en bas ;
- menu auteur : modifier / supprimer ;
- menu non-auteur : signaler.

Règles importantes :

- pas de réponse à une réponse au Lot 1 ;
- suppression de post/commentaire = soft-delete côté API ;
- un post masqué/supprimé par modération n'est plus ouvert publiquement.

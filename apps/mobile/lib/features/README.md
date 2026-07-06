# features/

Architecture **feature-first** : chaque dossier = une fonctionnalité autonome
(présentation + état Riverpod + accès données), qui ne dépend que de `core/`.

| Feature | Étape Lot 1 | Rôle |
|---|---|---|
| `auth` | 7 | Connexion / inscription email+mdp, placeholders Google/Apple |
| `feed` | 7 | Fil d'actualité (Accueil) |
| `post_composer` | 7 | Création de post — bottom sheet 5 types |
| `post_detail` | 7 | Détail post + commentaires (racine + 1 niveau de réponses) |
| `map` | 7 | Carte live La Réunion — mode Météo & trafic |
| `profile` | 7 | Profil utilisateur (Mes infos) + onglet Dealplace placeholder |
| `notifications` | 7 | Notifications in-app |
| `news` | placeholder | Écran propre « bientôt disponible » (Lot 4) |
| `dealplace` | placeholder | Écran propre « bientôt disponible » (Lot 2) |

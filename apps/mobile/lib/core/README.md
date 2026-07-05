# core/

Socle transverse de l'application mobile Endirek (rempli à l'étape 7) :

- `config/` — configuration d'environnement (API_BASE_URL via `--dart-define`), constantes.
- `theme/` — thème Endirek fidèle aux mockups : fond blanc, bleu Endirek, cartes arrondies, ombres légères, typographie type Sora.
- `router/` — navigation `go_router` : shell 4 onglets (Accueil, Carte, News, Dealplace) + routes détail.
- `api/` — client HTTP (dio) : intercepteurs auth JWT, gestion erreurs, modèles partagés.

Règle : `core/` ne dépend d'aucune feature ; les features dépendent de `core/`.

# Module `posts` — Publications

**Statut : IMPLÉMENTÉ (Lot 1 étape 4).**

Rôle : création et gestion des posts, cœur de l'expérience « Live Local »,
plus le fil d'actualité scoré (le module `feed` prévu au départ est fusionné
ici — voir `../feed/README.md`).

## Endpoints

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/v1/posts/types` | Types actifs triés par position (table `post_types` pilotable — rien de hardcodé) |
| GET | `/api/v1/posts/feed` | Feed scoré `{ items: FEED_POST[], total }` — `?limit=&offset=&lat=&lng=` |
| POST | `/api/v1/posts` | Création (règles carte pilotées par le type, city auto-déduite, urlSlug unique, ≤ 4 médias) |
| GET | `/api/v1/posts/slug/:slug` | Détail par urlSlug (mêmes règles de visibilité) |
| GET | `/api/v1/posts/:id` | Détail — `deleted` → 404 ; `hidden` → 404 sauf auteur/moderator/super_admin |
| PATCH | `/api/v1/posts/:id` | title/body, AUTEUR uniquement (type/location non modifiables au MVP) |
| DELETE | `/api/v1/posts/:id` | Soft-delete (`status='deleted'`), AUTEUR uniquement → 204 |
| GET | `/api/v1/users/me/posts` | Mes posts `active` + `hidden` (statut visible dans FEED_POST) |
| GET | `/api/v1/users/:id/posts` | Posts `active` d'un profil visible |

## Règles métier clés

- publication libre et question/aide : **feed uniquement** ;
- météo/trafic/danger : **feed + carte si géolocalisés** — un post de type
  carte SANS location est **légal** (feed-only, aucun blocage) ;
- expiration **carte** : `mapExpiresAt = créé + defaultMapDurationMinutes`
  **du type** (piloté par `post_types`, jamais de « 120 » en dur) — le post
  reste au feed après expiration ;
- `city` déduite de la commune la plus proche (référentiel 12 communes +
  haversine, `common/geo/nearest-commune.ts`) si location sans ville ;
- chaque post porte un **`url_slug`** unique (slugify + suffixe aléatoire,
  retry) pour l'URL web partageable future ;
- champ **`page_id` nullable** prévu pour les posts de pages (TODO Lot 2+).

## Forme FEED_POST

Assemblée par **`FeedPostAssembler`** (exporté par ce module — source
UNIQUE, réutilisée par map et par les phases interactions/admin) au-dessus
des projections pures de `common/mappers/post.mapper.ts`. Chargements PAR
LOT (auteurs, médias, viewerReaction, viewerSaved, reactionsTop) : pas de
N+1 par post.

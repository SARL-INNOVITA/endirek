# Module `dealplace` — Taxonomie & annonces (Dealplace)

**Statut : IMPLÉMENTÉ (Lot 2 — CP2.1).** Première fonctionnalité du Lot 2.

Rôle : la **place de marché locale** d'Endirek — taxonomie biens/services
pilotable par le backoffice + **annonces (listings)** publiées par les
utilisateurs, chaque annonce portant une **valeur obligatoire** (socle des
futurs deals contractuels — CP2.4).

Périmètre STRICT du checkpoint : taxonomie publique, CRUD d'annonces, annuaire
filtré, listes de profil. **Hors périmètre** (checkpoints ultérieurs) :
conversations, deals contractuels, avis/profil Dealplace (CP2.2+), paiement
(hors app). Le bouton « Proposer un deal » du mobile reste un **placeholder**.

## Endpoints (authentifiés — guard JWT global)

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/v1/dealplace/taxonomy` | Catégories actives (famille, moderationLevel, sous-catégories actives) + tags actifs, triés par position |
| GET | `/api/v1/dealplace/listings` | Annuaire public `{ items: LISTING_CARD[], total }` — `?family=&category=&subcategory=&city=&valueMin=&valueMax=&tags=&search=&limit=&offset=` |
| POST | `/api/v1/dealplace/listings` | Création (toutes les règles métier ci-dessous) → 201 `LISTING` |
| GET | `/api/v1/dealplace/listings/slug/:slug` | Détail par urlSlug (mêmes règles de visibilité) |
| GET | `/api/v1/dealplace/listings/:id` | Détail — `deleted` → 404 ; `hidden` → 404 sauf propriétaire/moderator/super_admin |
| PATCH | `/api/v1/dealplace/listings/:id` | title/description/value*/category/subcategory/exchangePrefs/externalLinks/tags — PROPRIÉTAIRE uniquement |
| DELETE | `/api/v1/dealplace/listings/:id` | Soft-delete (`status='deleted'`), PROPRIÉTAIRE uniquement → 204 |
| GET | `/api/v1/users/me/listings` | Mes annonces `active` + `hidden` (statut jamais `deleted`) — cartes enrichies du champ `status` (le propriétaire distingue ses annonces masquées) |
| GET | `/api/v1/users/:id/listings` | Annonces `active` d'un profil visible (404 si compte absent/supprimé/suspendu) |

Le **backoffice** Dealplace (liste tous statuts + PATCH status, gestion de la
taxonomie) vit dans le module `admin` (`/api/v1/admin/dealplace/...`) — voir
`../admin/README.md`.

## Règles métier clés (au SERVICE)

- **valeur obligatoire et cohérente** : `fixed` → `valueMin` seul ; `range` →
  `valueMin ≤ valueMax` (400 sinon) ;
- **photo obligatoire pour un bien** (`listingType='good'`, ≥ 1 média),
  facultative pour un service (400 pour un bien sans photo) ;
- **commune du référentiel** (12 communes de La Réunion,
  `database/seed/communes.ts`) — l'adresse exacte n'est **jamais** stockée ;
  `location` = centre de la commune (400 si commune inconnue) ;
- **catégorie + sous-catégorie cohérentes et ACTIVES** : la catégorie existe
  et est active, sa famille correspond au type d'annonce, la sous-catégorie
  est active et appartient à la catégorie — repli `autres-<cat>` autorisé
  (400 sinon). Une entrée désactivée au backoffice n'accepte plus de nouvelle
  annonce (comme les types de posts) ; les annonces existantes restent
  affichées ;
- **catégorie `forbidden`** → création REFUSÉE (400) ; **`sensitive`** →
  autorisée mais marquée (visible via le filtre `flaggedOnly` du backoffice) ;
- **`exchangePrefs` non vide** (sous-ensemble de `goods/services/money/open`) ;
- **`url_slug`** unique (slugify du titre + suffixe aléatoire, retry — même
  mécanisme que les posts, `../posts/slug.util.ts`) ;
- **médias** : URLs issues de `POST /media/upload` uniquement (base
  `${API_PUBLIC_URL}/uploads/`) — toute URL externe est refusée (400), garde
  strictement identique à celle des posts.

## Visibilité (miroir des posts)

`active` visible de tous ; `hidden` → 404 pour tous sauf le propriétaire et les
rôles moderator/super_admin ; `deleted` → 404 pour tout le monde (soft-delete,
la ligne reste pour l'audit).

## Formes du contrat

- **`LISTING`** (détail) : `{ id, ownerId, owner, listingType, title,
  description, category:{slug,labelFr,family,moderationLevel},
  subcategory:{slug,labelFr}, valueKind, valueMin, valueMax, currency, city,
  location, exchangePrefs, externalLinks, media[], tags[], urlSlug, status,
  createdAt, updatedAt }` ;
- **`LISTING_CARD`** (listes) : sous-ensemble `{ id, ownerId, owner,
  listingType, title, category:{slug,labelFr,family}, subcategory, valueKind,
  valueMin, valueMax, currency, city, coverMedia (1er média ou null), tags,
  urlSlug, createdAt }`. Les listes du PROPRIÉTAIRE (`/users/me/listings`) et
  du BACKOFFICE ajoutent `status` à chaque carte.

Les deux formes sont projetées par `common/mappers/listing.mapper.ts` (source
unique, la forme AUTEUR est mutualisée avec `post.mapper.ts`) et assemblées
**par lot** (owner, médias, tags, catégorie, sous-catégorie — anti N+1) par
`listing.assembler.ts` (`ListingAssembler`, exporté pour le backoffice, comme
`FeedPostAssembler` côté posts).

## Parité mock / postgres

Les règles métier vivent ICI (service), pas dans les repositories : les deux
drivers (`MockListingsRepository` / `PostgresListingsRepository`,
`*ListingTaxonomyRepository`) exposent un comportement observable identique.
Vérifié en mock ET en postgres (43 contrôles identiques : taxonomie, filtres,
détail, règles de création, ownership, profil, backoffice).

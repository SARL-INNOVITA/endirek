# Module `pages` — Pages restaurants & entreprises (Lot 3)

Pages professionnelles possédées par des utilisateurs (PRD §12, décisions
D69-D76) : identité (nom, bio, avatar/couverture, commune, attributs,
téléphone), horaires hebdomadaires avec statut d'ouverture DÉRIVÉ, plats et
menus programmés par date (restaurant), documents PDF « Nos cartes »
(restaurant), offres et événements, abonnés, publications AU NOM de la page.

## Endpoints (préfixe `/api/v1`, JWT global)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/pages` | Créer une page (active immédiatement — D69) |
| GET | `/pages/slug/:slug` | Détail par slug public |
| GET | `/pages/:id` | Détail (PAGE : horaires, documents, openStatus, isOwner, myFollow) |
| PATCH | `/pages/:id` | Modifier (propriétaire — pageType/urlSlug immuables, congés D70) |
| DELETE | `/pages/:id` | Suppression douce (propriétaire) |
| PUT | `/pages/:id/hours` | Remplacer les horaires (≤ 4 plages/jour, sans chevauchement) |
| GET | `/pages/:id/menus?from=` | Menus de la semaine (7 jours, restaurant) |
| PUT | `/pages/:id/menus/:date` | Programmer le menu d'une date ([] = supprimer) |
| GET | `/pages/:id/dishes` | Bibliothèque de plats (propriétaire/modération) |
| POST/PATCH/DELETE | `/pages/:id/dishes[/:dishId]` | CRUD plats (prix en CENTIMES, ≥ 1 prix) |
| POST/DELETE | `/pages/:id/documents[/:documentId]` | Cartes PDF (≤ 5, upload D77) |
| GET | `/pages/:id/offers[?all=true]` | Offres (public : non expirées) |
| POST/PATCH/DELETE | `/pages/:id/offers[/:offerId]` | CRUD offres (soft-delete) |
| GET | `/pages/:id/events[?all=true]` | Événements (public : à venir/en cours) |
| POST/PATCH/DELETE | `/pages/:id/events[/:eventId]` | CRUD événements (soft-delete) |
| POST/DELETE | `/pages/:id/follow` | S'abonner / se désabonner (D74) |
| GET | `/pages/:id/posts` | Publications de la page (FEED_POST) |
| POST | `/pages/:id/posts` | Publier au nom de la page (D73 — free/menu/offer/event) |
| GET | `/users/me/pages` | Mes pages (active + hidden, cartes avec statut) |
| GET | `/users/:id/pages` | Pages actives d'un profil |

Le signalement de page (`POST /pages/:id/report`) vit dans le module
`moderation` (D76) ; le backoffice (`/admin/pages`) dans le module `admin`.

## Règles métier clés

- **Visibilité** (D69, miroir annonces) : `active` pour tous ; `hidden` → 404
  sauf propriétaire/modération ; `deleted` → 404 définitif. Les posts d'une
  page non-active sortent du feed et de la carte (filtre à la lecture).
- **Statut d'ouverture** (D70) : DÉRIVÉ à la lecture (heure Réunion UTC+4) —
  congés (`vacationUntil`) prioritaires, sinon plages du jour. Jamais stocké.
- **Restaurant uniquement** (D71) : plats, menus, documents → 400 sur une
  page entreprise. Prix des plats en CENTIMES (les euros entiers des annonces
  ne couvrent pas 12,50 €), au moins un des deux prix. Supprimer un plat le
  RETIRE des menus programmés.
- **Publications** (D73) : `menu`/`offer` expirent de la carte à 23 h 00
  Réunion le jour de publication ; `event` est visible carte de J-3 à la fin
  effective (`endsAt` ?? début + 6 h — `posts.map_visible_from`). Corps
  AUTO-COMPOSÉS (le post est un instantané) ; `free` suit les règles du
  composer. Les 3 types sont `page_only` (refusés au composer utilisateur).
  Pas de notification aux abonnés (anti-flood).
- **Abonnés** (D74) : compteur calculé à la lecture (comptes actifs), bonus
  feed `FEED_WEIGHTS.followedPage`, jamais sa propre page.

## Formes du contrat

`PAGE_CARD` / `OwnerPageCard` (+status) / `PAGE` (common/mappers/page.mapper.ts),
`DISH`, `MENU_DAY`, `OFFER` (isCurrent dérivé), `EVENT` (timing dérivé),
`PostPageRef` (identité de page dans FEED_POST et MapPostItem). Assemblage
PAR LOT par `PageAssembler` (exporté, réutilisé par l'admin).

## Parité mock/postgres

14ᵉ repository (`PAGES_REPOSITORY`) : `MockPagesRepository` (spécification de
référence) et `PostgresPagesRepository` au comportement observable identique —
compteurs à la lecture, tris avec tie-break id, transactions pour les
écritures multi-tables (horaires, menus, suppression de plat).

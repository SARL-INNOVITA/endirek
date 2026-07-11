# Module `deals` — Deals contractuels + avis (CP2.4)

**Statut : IMPLÉMENTÉ (Lot 2 — CP2.4, décision D64).** Remplace le
placeholder `_future/deals`. Le cœur du Dealplace : un DEAL est un contrat
d'échange entre deux utilisateurs autour d'une annonce.

## Machine à états (le repository ne la connaît pas — tout est au service)

`proposed` → `active` (accepté par le DESTINATAIRE) | `declined` |
`cancelled` (retiré par le proposeur) ; `active` → `completed`
(**AUTOMATIQUE : tous les sous-éléments validés**) | `cancelled` (annulation
amiable EN DEUX TEMPS) | `disputed` (unilatéral, motif requis — TERMINAL au
CP2.4). Le stepper 5 étapes du mockup 07 est DÉRIVÉ (`stage`), jamais stocké.

## Endpoints (authentifiés — participants uniquement, 404 sinon)

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/v1/deals` | Mes deals (DEAL_CARD, activité décroissante, `?status=`) |
| GET | `/api/v1/deals/conversation/:conversationId` | Deal OUVERT d'un fil (bandeau) |
| POST | `/api/v1/deals` | Proposer (annonce `active`, jamais soi-même, UN SEUL deal ouvert par (annonce, paire) → 409 ; steps auto « titre » ; conversation liée créée si besoin) |
| GET | `/api/v1/deals/:id` | Page complète (items + badges dérivés, ajustements, notes, avis, stage) |
| PUT | `/api/v1/deals/:id/items` | Remplacer la proposition (PROPOSEUR, phase proposed) |
| POST | `/api/v1/deals/:id/accept` \| `/decline` \| `/withdraw` | Transitions de la proposition |
| POST | `/api/v1/deals/:id/steps/:stepId/honor` \| `/validate` | Le FOURNISSEUR honore, la CONTREPARTIE valide (conclusion auto) |
| POST | `/api/v1/deals/:id/adjustments` (+ `/:adjId/accept\|reject`) | Négociation en phase active — payload appliqué à l'acceptation |
| POST | `/api/v1/deals/:id/notes` | Timeline « Suivi du deal » |
| POST | `/api/v1/deals/:id/cancellation` (+ `/withdraw`) | Annulation amiable en 2 temps |
| POST | `/api/v1/deals/:id/dispute` | Litige (motif 10-1000 caractères) — terminal |
| POST | `/api/v1/deals/:id/review` | Avis sur deal CONCLU (3 critères 1-5 + commentaire, un par partie) |
| GET | `/api/v1/users/:id/deal-profile` (+ `me`) | Stats du profil Dealplace (mockup 05) : deals réalisés, moyennes + note globale, derniers avis, deals conclus |

## Règles clés (D64)

- Chaque élément a un FOURNISSEUR ∈ {proposeur, destinataire}, une valeur
  estimée **indicative** (paiement hors app) et **≥ 1 sous-élément**.
- En `proposed`, seul le PROPOSEUR édite — l'accord FIGE ; ensuite tout passe
  par les ajustements (add/modify/remove, appliqués transactionnellement).
- Notifications in-app type **'deal'** sur les JALONS uniquement (anti-flood) ;
  event socket **`deal.updated`** pour rafraîchir la page ouverte.
- Note globale d'un avis / du profil = moyenne ARRONDIE à 2 décimales,
  calculée à la lecture (identique dans les deux drivers).

## Parité mock / postgres

`MockDealsRepository` / `PostgresDealsRepository` (13ᵉ repository) —
comportement observable identique : tris, messages d'erreur, écritures
multi-tables atomiques (deal+items+steps, replaceItems), honor/validate
idempotents, agrégats calculés à la lecture. Seed : 2 deals (1 actif complet,
1 conclu avec avis croisés).

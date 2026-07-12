# Module `deals` — Deals contractuels + avis (CP2.4/CP2.5)

**Statut : IMPLÉMENTÉ (Lot 2 — CP2.4, décision D64 ; arbitrage des litiges
au CP2.5, décision D66).** Remplace le placeholder `_future/deals`. Le cœur
du Dealplace : un DEAL est un contrat d'échange entre deux utilisateurs
autour d'une annonce.

## Machine à états (le repository ne la connaît pas — tout est au service)

`proposed` → `active` (accepté par le DESTINATAIRE) | `declined` |
`cancelled` (retiré par le proposeur) ; `active` → `completed`
(**AUTOMATIQUE : tous les sous-éléments validés**) | `cancelled` (annulation
amiable EN DEUX TEMPS) | `disputed` (unilatéral, motif requis). Depuis le
CP2.5 (D66), `disputed` n'est **plus terminal** : un modérateur TRANCHE via
le backoffice — `cancelled` (annulé), `completed` (déclaré conclu — les avis
s'ouvrent) ou retour à `active` (`resumed` : litige non fondé, un nouveau
litige reste possible et efface alors les traces de l'arbitrage précédent).
L'issue est tracée par `dispute_resolved_by/at`, `dispute_resolution`,
`dispute_resolution_note` (migration `0008`) — la note est montrée aux DEUX
parties, l'identité du modérateur ne l'est jamais. Le stepper 5 étapes du
mockup 07 est DÉRIVÉ (`stage`), jamais stocké.

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
| POST | `/api/v1/deals/:id/dispute` | Litige (motif 10-1000 caractères) — arbitré par le backoffice (CP2.5) |
| POST | `/api/v1/deals/:id/review` | Avis sur deal CONCLU (3 critères 1-5 + commentaire, un par partie) |
| GET | `/api/v1/users/:id/deal-profile` (+ `me`) | Stats du profil Dealplace (mockup 05) : deals réalisés, moyennes + note globale, derniers avis, deals conclus |

## Backoffice (CP2.5 — D66, rôles moderator/super_admin — voir module `admin`)

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/v1/admin/dealplace/deals` | Tous les deals (ADMIN_DEAL_CARD : les DEUX parties nommées ; `?status=disputed` = file des litiges, `?search=` parties/annonce/n°) |
| GET | `/api/v1/admin/dealplace/deals/:id` | Page ADMIN_DEAL complète (litige + arbitrage inclus) |
| POST | `/api/v1/admin/dealplace/deals/:id/resolve-dispute` | Arbitrage : `{ outcome: cancelled\|completed\|resumed, note }` (note 10-1000 OBLIGATOIRE, montrée aux deux parties ; 409 si non disputé, 403 si l'arbitre est partie prenante) |

Le contrôleur admin DÉLÈGUE à `DealsService` (pattern « service métier
hôte », comme les caméras) : la machine à états ne sort jamais de ce module.
L'arbitrage notifie les DEUX parties (type 'deal', event `dispute_resolved`)
et émet `deal.updated` (la page mobile ouverte se recharge seule).

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
idempotents, agrégats calculés à la lecture, liste backoffice `listAdmin`
(CP2.5 : createdAt DESC, recherche parties/annonce/n°). Seed : 3 deals
(1 actif complet, 1 conclu avec avis croisés, 1 en litige non arbitré —
démo de la file d'arbitrage).

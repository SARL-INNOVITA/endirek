# feature: deals — Deals contractuels + avis (CP2.4)

Le cœur du Dealplace (D64, mockups 05/07) : proposer, négocier, exécuter et
conclure un échange, puis s'évaluer.

## Arborescence

- `domain/deal_models.dart` — formes du contrat : `Deal` (page complète),
  `DealCard`, `DealItem`/`DealStep` (badges/étape DÉRIVÉS PAR LE SERVEUR),
  `DealAdjustment`, `DealNote`, `DealReview`, `DealProfile` (stats mockup 05).
  Testé (`test/deals_models_test.dart`).
- `data/deals_repository.dart` — endpoints `/deals*` + `/users/:id/deal-profile`
  (toutes les transitions renvoient le DEAL à jour).
- `application/deal_providers.dart` — providers autoDispose : page de deal
  (invalidée par l'event `deal.updated`), mes deals, deal d'un fil, profil.
- `presentation/` :
  - `deal_screen.dart` — PAGE DE DEAL (mockup 07) : en-tête (partenaire,
    annonce, conversation liées), stepper 5 étapes, bandeaux contextuels
    (accepter/refuser/retirer, annulation en 2 temps, litige), sections
    « Ce que j'offre » / « Ce que mon deal-partner offre » avec sous-éléments
    actionnables (honorer/valider selon mon rôle), ajustements (proposer via
    bottom sheet + accepter/refuser), timeline de notes, actions sensibles,
    bloc d'avis (formulaire 3 critères en étoiles sur deal conclu) ;
  - `propose_deal_screen.dart` — composition de la proposition
    (`/dealplace/:id/proposer`, `?recipient=` depuis un fil) : éléments des
    deux côtés (nature, titre, valeur, sous-éléments « un par ligne ») ;
  - `deals_screen.dart` — liste « Mes deals » (`/deals`) ;
  - `widgets/` — `deal_stepper.dart`, `etoiles_avis.dart`.

## Points d'entrée

« Proposer un deal » du détail d'annonce (non-propriétaire) ; action du fil
de conversation (les DEUX parties — le propriétaire propose ici) ; bandeau
« Deal N » dans le fil ; « Mes deals » depuis le volet Profil Dealplace ;
notifications type `deal` (tap → page du deal). Le volet Profil Dealplace
est ACTIVÉ : stats réelles, barres des 3 critères, dernier avis, « Deals
conclus » (plus aucun placeholder du CP2.2).

## Hors périmètre CP2.4

Arbitrage des litiges (terminal — CP2.5+), modération backoffice des deals,
rappels d'échéance, modification des sous-éléments par ajustement, paiement
(hors app — valeurs indicatives).

# Module futur `deals` — Deals contractuels

**TODO Lot 2+ — anticipation architecturale uniquement, rien à implémenter au Lot 1.**

Vision Endirek : des **deals contractuels à états** (proposé → négocié →
accepté → en cours → terminé/annulé) conclus entre utilisateurs à partir des
listings Dealplace, composés d'**éléments et de sous-éléments validables**
par chaque partie (checklist contractuelle bilatérale).

Points d'ancrage déjà prévus dans le socle :
- valeur obligatoire des listings (`_future/dealplace`) = base de calcul du deal ;
- **gateway WebSocket** (`realtime`) pour le suivi d'état en direct ;
- notifications (`notifications`) pour chaque transition d'état ;
- messagerie liée au deal via `_future/conversations`.

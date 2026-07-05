# Module futur `conversations` — Messagerie 1-to-1

**TODO Lot 2+ — anticipation architecturale uniquement, rien à implémenter au Lot 1.**

Vision Endirek : **messagerie privée 1-to-1 en temps réel** entre utilisateurs
(et plus tard avec les pages), notamment autour des listings et des deals
(négociation, coordination).

Points d'ancrage déjà prévus dans le socle :
- la **gateway WebSocket** (`realtime`) de l'étape 5 est le transport naturel
  des messages en direct ;
- l'authentification des connexions temps réel (JWT du module `auth`) est
  déjà prévue ;
- les adapters `media` (pièces jointes) et `push` (notification de nouveau
  message) se réutilisent sans modification.

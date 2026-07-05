# Module `realtime` — Temps réel (WebSocket)

**Statut : TODO — implémentation prévue à l'étape 5 du Lot 1.**

Rôle : gateway WebSocket de l'API — canal temps réel entre le backend
et l'application mobile.

Périmètre Lot 1 :
- diffusion des notifications in-app en direct ;
- rafraîchissement live des marqueurs de la carte (nouveaux posts
  météo/trafic/danger, expirations) ;
- compteurs de réactions/commentaires mis à jour en direct.

Anticipation : cette gateway est le **point d'ancrage** des fonctionnalités
temps réel futures — messagerie 1-to-1 (`_future/conversations`), présence,
suivi des deals (TODO Lot 2+). L'authentification des connexions réutilise
les JWT du module `auth`.

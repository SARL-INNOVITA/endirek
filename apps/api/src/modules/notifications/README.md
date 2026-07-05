# Module `notifications` — Notifications

**Statut : TODO — implémentation prévue à l'étape 5 du Lot 1.**

Rôle : notifications utilisateur, **in-app d'abord**, push plus tard.

Événements notifiés au Lot 1 :
- nouveau commentaire sur un de ses posts ;
- réponse à un de ses commentaires ;
- réaction sur un de ses posts ;
- post signalé traité ;
- alerte système.

Architecture : adapter remplaçable sélectionné par `PUSH_DRIVER`
(`mock` tant que Firebase/APNs ne sont pas configurés — variables
`FIREBASE_*` / `FCM_SERVER_KEY` déjà prévues, ne pas bloquer).
La diffusion temps réel in-app passe par le module `realtime`.

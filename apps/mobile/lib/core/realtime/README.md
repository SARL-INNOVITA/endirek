# core/realtime — Client temps réel socket.io + fallback polling (checkpoint 5)

Canal temps réel MINIMAL du Lot 1 (pas de messagerie).

## Contenu

- `realtime_service.dart` : connexion socket.io au namespace par défaut de l'API
  (`ApiConfig.baseUrl`), auth au HANDSHAKE via `auth.token` (jeton d'accès courant),
  transport WebSocket, reconnexion automatique. Décode deux events serveur en un
  `Stream<RealtimeEvent>` :
  - `notification.created` → `NotificationRecue { notification, unreadCount }` ;
  - `map.updated` → `CarteAMettreAJour`.
  Émet `map.subscribe` à la connexion (rejoint la room carte côté serveur).
- `realtime_bridge.dart` : **orchestrateur** gardé en vie par l'app root
  (`ref.watch(realtimeBridgeProvider)` dans `main.dart`). Il :
  - ouvre le socket + charge le badge non-lues à la CONNEXION de l'utilisateur, le
    ferme + remet le badge à 0 à la DÉCONNEXION (écoute `authControllerProvider`) ;
  - route les events vers les contrôleurs : `notification.created` → badge +
    insertion en tête de l'écran notifs ; `map.updated` → refresh de la carte
    **seulement si elle a déjà été chargée** ;
  - **FALLBACK polling** : un timer (~45 s, avant-plan) rafraîchit
    `GET /notifications/unread-count` **uniquement quand le socket n'est pas
    connecté**. Le temps réel est un confort ; le REST reste la source de vérité.

## Cycle de vie

Démarrage à la connexion, arrêt à la déconnexion. La (re)connexion relit le jeton
courant (utile après un refresh de session). Aucune erreur socket ne casse le flux
métier : en absence de socket, l'app fonctionne en polling.

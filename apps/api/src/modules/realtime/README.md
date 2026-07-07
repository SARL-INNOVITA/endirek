# Module `realtime` — Temps réel (socket.io)

Gateway WebSocket **minimale** du Lot 1 (étape 5), sur le **namespace par
défaut**. Deux usages seulement : diffuser les **notifications in-app** en
direct et signaler un **rafraîchissement léger de la carte**. **PAS de
messagerie** (conversations 1-to-1, présence, suivi de deals = Lot 2+).

## Authentification au handshake

À la connexion (`handleConnection`), la gateway :

1. lit le token dans `client.handshake.auth.token` (repli : `?token=` en query) ;
2. vérifie signature + expiration via `JwtService` (secret `auth.jwtSecret` —
   même secret que le guard HTTP) ;
3. **recharge** l'utilisateur via `USERS_REPOSITORY` et **refuse** la connexion
   (`client.disconnect(true)`) s'il est introuvable ou non `active`
   (`deleted` / `suspended`) — miroir de la politique du guard JWT HTTP, sans
   liste de révocation ;
4. sinon joint la room privée **`user:<userId>`** (cible des notifications).

L'écran carte s'abonne aux rafraîchissements en émettant `map.subscribe`
(rejoint la room commune `map`) et se désabonne via `map.unsubscribe`. Aucun
autre message entrant n'est traité au Lot 1.

## Événements émis

| Event                  | Room             | Payload                                      | Émis par                                  |
| ---------------------- | ---------------- | -------------------------------------------- | ----------------------------------------- |
| `notification.created` | `user:<userId>`  | `{ notification: NOTIFICATION, unreadCount }`| `NotificationsService.create` (après persistance) |
| `map.updated`          | `map`            | `{ reason: 'post.created' }`                 | `PostsService.create` (post visible carte)|
| `error`                | socket courant   | `{ message }`                                | handshake refusé (juste avant disconnect) |

- `emitNotification(userId, { notification, unreadCount })` →
  `server.to('user:'+userId).emit('notification.created', …)`.
- `emitMapUpdated('post.created')` → `server.to('map').emit('map.updated', …)`.

Les deux méthodes sont **sans effet si aucun serveur socket n'est encore
initialisé** (garde `if (!this.server) return`) : le temps réel ne casse jamais
le flux métier HTTP.

## Câblage & dépendances (pas de cycle)

`RealtimeModule` n'importe que `JwtModule` (secret `auth.jwtSecret`) ; les
repositories viennent de `DatabaseModule` (`@Global`). Il **n'importe ni
notifications ni posts** : le sens des dépendances est à sens unique —

```
NotificationsModule ─▶ RealtimeModule   (injecte la gateway pour émettre)
PostsModule         ─▶ RealtimeModule   (injecte la gateway pour map.updated)
RealtimeModule      ─▶ (auth/jwt + DatabaseModule global)
```

`RealtimeGateway` est **exporté** ; aucun `forwardRef` n'est nécessaire puisque
la gateway ne dépend d'aucun de ses consommateurs.

## CORS

La politique d'origines (`app.corsOrigins`, issue de `CORS_ORIGINS`) est
appliquée par `RealtimeIoAdapter` (voir `realtime.adapter.ts`), enregistré dans
`main.ts` via `app.useWebSocketAdapter(...)` **avant** `app.listen`. Le
décorateur `@WebSocketGateway`, évalué au chargement de la classe, ne peut pas
lire la config injectée — d'où l'adapter. L'adapter ne touche **que** le
transport WebSocket : préfixe `api/v1`, Swagger `/docs`, guard JWT HTTP et
service statique `/uploads` restent inchangés.

## Fallback (repli)

Si le socket est indisponible (réseau, proxy, coupure), le client retombe sur
du **polling** de `GET /api/v1/notifications/unread-count`. Le temps réel est un
**confort** : la base de données reste l'unique source de vérité (les
notifications sont persistées AVANT d'être émises).

## Vérification (checkpoint 5)

Test de handshake sans dépendance externe (`socket.io-client` n'est pas
installé — aucune dépendance n'a été ajoutée) : une requête HTTP GET brute sur
`/socket.io/?EIO=4&transport=polling` prouve que le serveur Engine.IO répond
(session ouverte, code 200 + payload `0{"sid":...}`). Le refus d'une connexion
sans token valide est assuré par `handleConnection` (disconnect immédiat) et
couvert par les règles ci-dessus.

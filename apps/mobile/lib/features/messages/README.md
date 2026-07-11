# feature: messages — Messagerie 1-to-1 (CP2.3)

Messagerie privée temps réel LIÉE À UNE ANNONCE (décision D63) : le fil se
démarre depuis le bouton « Contacter » du détail d'une annonce (get-or-create
serveur au premier message). L'icône messagerie du header est ACTIVE avec un
badge « conversations avec non-lus », miroir exact de la cloche.

## Arborescence

- `domain/` — formes du contrat CP2.3 :
  - `conversation.dart` — `ConversationCard` (annonce en référence légère,
    interlocuteur, dernier message, non-lus) + `ConversationListingRef` ;
  - `message_chat.dart` — `MessageChat` (texte, 1-2000 caractères).
- `data/messages_repository.dart` — endpoints `/conversations*` (liste,
  badge, fil par annonce (404 → null), démarrage + premier message, messages,
  envoi, marquage lu).
- `application/` :
  - `messages_unread_controller.dart` — badge global (socket + polling de
    repli ~45 s + compteurs absolus du serveur) ;
  - `conversations_controller.dart` — liste des fils (page large de 50,
    rechargée à l'ouverture et à chaque 'message.created').
- `presentation/` :
  - `conversations_screen.dart` — /messages (cartes, badges par fil, états
    vide/erreur, pull-to-refresh) ;
  - `chat_screen.dart` — fil de discussion (bulles chronologiques, bandeau
    d'annonce cliquable, saisie bornée à 2000). DEUX modes : `/messages/:id`
    (fil existant) et `/dealplace/:id/contact` (contact depuis une annonce —
    fil repris s'il existe, créé au premier envoi). Réception en DIRECT
    (écoute du flux realtime) + marquage lu à l'ouverture et à la réception.

## Temps réel (gateway du Lot 1 — pas de second canal)

Event socket **`message.created`** `{ conversationId, message,
unreadConversations }`, émis au DESTINATAIRE (room `user:<id>`) :
- `realtime_service` le décode en `MessageRecu` ;
- `realtime_bridge` applique le badge absolu + rafraîchit la liste si montée ;
- l'écran de fil concerné ajoute la bulle et marque lu.
Fallback : polling de `GET /conversations/unread-count` (~45 s, comme la
cloche). PAS de notification in-app par message (anti-flood, D63).

## Hors périmètre CP2.3

Pièces jointes, édition/suppression de message, groupes, conversations sans
annonce, indicateur de frappe, accusés de lecture par message.

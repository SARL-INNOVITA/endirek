# feature: messages — Messagerie 1-to-1 (CP2.3 + fils de PAGE au Lot 3)

Messagerie privée temps réel LIÉE À UNE CIBLE : une ANNONCE (décision D63 —
bouton « Contacter » du détail d'annonce) ou, depuis le Lot 3 (D75), une
PAGE restaurant/entreprise (bouton « Message » de l'écran de page). Dans
les deux cas : get-or-create serveur au premier message. L'icône messagerie
du header est ACTIVE avec un badge « conversations avec non-lus », miroir
exact de la cloche.

## Arborescence

- `domain/` — formes du contrat (CP2.3 + D75) :
  - `conversation.dart` — `ConversationCard` (cible = `listing` OU `page`,
    exactement une des deux non nulle ; interlocuteur, dernier message,
    non-lus) + `ConversationListingRef` + `ConversationPageRef` ;
  - `message_chat.dart` — `MessageChat` (texte, 1-2000 caractères).
- `data/messages_repository.dart` — endpoints `/conversations*` (liste,
  badge, fil par annonce ou par page (404 → null), démarrage + premier
  message avec `listingId` XOR `pageId`, messages, envoi, marquage lu).
- `application/` :
  - `messages_unread_controller.dart` — badge global (socket + polling de
    repli ~45 s + compteurs absolus du serveur) ;
  - `conversations_controller.dart` — liste des fils (page large de 50,
    rechargée à l'ouverture et à chaque 'message.created').
- `presentation/` :
  - `conversations_screen.dart` — /messages (cartes avec vignette + titre
    de la cible — annonce ou page —, badges par fil, états vide/erreur,
    pull-to-refresh) ;
  - `chat_screen.dart` — fil de discussion (bulles chronologiques, bandeau
    de cible cliquable — annonce → `/dealplace/:id`, page → `/pages/:id` —,
    saisie bornée à 2000). TROIS modes : `/messages/:id` (fil existant),
    `/dealplace/:id/contact` (contact depuis une annonce) et
    `/pages/:id/contact` (message à une page) — fil repris s'il existe,
    créé au premier envoi. Réception en DIRECT (écoute du flux realtime) +
    marquage lu à l'ouverture et à la réception. Le bandeau/action « deal »
    ne concerne que les fils d'ANNONCE.

## Temps réel (gateway du Lot 1 — pas de second canal)

Event socket **`message.created`** `{ conversationId, message,
unreadConversations }`, émis au DESTINATAIRE (room `user:<id>`) :
- `realtime_service` le décode en `MessageRecu` ;
- `realtime_bridge` applique le badge absolu + rafraîchit la liste si montée ;
- l'écran de fil concerné ajoute la bulle et marque lu.
Fallback : polling de `GET /conversations/unread-count` (~45 s, comme la
cloche). PAS de notification in-app par message (anti-flood, D63).

## Hors périmètre

Pièces jointes, édition/suppression de message, groupes, indicateur de
frappe, accusés de lecture par message.

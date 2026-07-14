# Module `conversations` — Messagerie 1-to-1 (CP2.3/CP2.5)

**Statut : IMPLÉMENTÉ (Lot 2 — CP2.3 ; modération des messages au CP2.5,
décision D67).** Remplace le placeholder `_future/conversations` du Lot 1.

Rôle : **messagerie privée 1-to-1 temps réel**, LIÉE À UNE ANNONCE au CP2.3
(décision D63) — point d'entrée unique : « Contacter » depuis le détail d'une
annonce. Les deals (CP2.4) s'appuieront sur ces fils pour la négociation.

## Endpoints (authentifiés — guard JWT global, participants uniquement)

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/v1/conversations` | Mes conversations (activité décroissante) — `{ items: CONVERSATION[], total, unreadConversations }` |
| GET | `/api/v1/conversations/unread-count` | Badge messagerie : `{ unreadConversations }` (polling de repli) |
| GET | `/api/v1/conversations/listing/:listingId` | MA conversation existante sur cette annonce (404 si aucune — le mobile propose alors le premier message) |
| POST | `/api/v1/conversations` | Démarre (ou reprend) le fil sur une annonce + PREMIER message — get-or-create ; annonce `active` uniquement (404), jamais la sienne (400) |
| GET | `/api/v1/conversations/:id` | Détail d'un fil (forme CONVERSATION) |
| GET | `/api/v1/conversations/:id/messages` | Messages, du PLUS RÉCENT au plus ancien (le client inverse), paginés |
| POST | `/api/v1/conversations/:id/messages` | Envoie un message (1-2000 caractères, texte seul) |
| PATCH | `/api/v1/conversations/:id/read` | Marque le fil lu (idempotent) → `{ unreadConversations }` à jour |

## Règles clés (décision D63)

- **Une conversation = (annonce, initiateur)**, UNIQUE — `owner_id` =
  propriétaire de l'annonce, dénormalisé à la création. Pas de fil vide : le
  démarrage exige le premier message.
- **Accès strictement réservé aux 2 participants** : tout le reste → 404
  « Conversation introuvable » (ne rien divulguer, miroir notifications).
- **Non-lu** = message de l'AUTRE participant postérieur à MON jalon
  (`initiator_last_read_at` / `owner_last_read_at`, null = tout non lu).
  Compteurs calculés À LA LECTURE ; seule exception : `last_message_at`,
  horodatage posé dans la MÊME transaction que l'INSERT du message.
- **Pas de notification in-app par message** (anti-flood) : badge messagerie
  dédié (`unreadConversations`) + event socket **`message.created`** émis au
  DESTINATAIRE (room `user:<id>` de la gateway du Lot 1 — pas de second
  canal) avec `{ conversationId, message, unreadConversations }`. Fallback
  client : polling de `/conversations/unread-count` (~45 s, comme la cloche).
- **Texte seul au CP2.3** : pas de pièces jointes, pas d'édition/suppression
  de message, pas de groupe. Une annonce soft-supprimée laisse le fil
  consultable (référence « Annonce supprimée »).

## Modération des messages (CP2.5 — D67)

- `messages.status` (`active`/`hidden`, migration `0008`) : le backoffice
  peut **masquer** un message (soft, réversible — pas de suppression, D63).
- Un message masqué **RESTE dans le fil** (pagination et non-lus inchangés —
  pas de « badge fantôme ») : son CORPS est remplacé côté service pour les
  participants (« Message masqué par la modération. », forme MESSAGE avec
  `status: 'hidden'`) — le contenu réel n'atteint jamais les participants ;
  le backoffice, lui, lit le corps réel.
- **Pas d'event socket de modération** : un fil ouvert se resynchronise à sa
  réouverture (REST = source de vérité, la modération est rare).
- Routes backoffice (module `admin`) : `GET /admin/dealplace/conversations`
  (toutes, recherche participant/annonce), `GET .../conversations/:id/messages`
  (corps réels), `PATCH /admin/dealplace/messages/:id/status`.

## Parité mock / postgres

Les règles métier vivent ICI (service) ; `MockConversationsRepository` et
`PostgresConversationsRepository` exposent un comportement observable
identique (tris par activité, définitions de non-lus, messages d'erreur,
lectures par lot anti-N+1, `createMessage` atomique, liste backoffice
`listAdmin` + `setMessageStatus` — CP2.5). Seed : 3 conversations
(9 messages, dont 1 masqué — fil du deal en litige) — le fil Valérie ↔ Kévin
laisse 1 conversation non lue à Valérie pour la démo du badge.

## Extension Lot 3 — fils de page (D75)

La cible d'une conversation devient annonce OU page (exactement une —
CHECK SQL) : `POST /conversations` accepte `{ pageId, body }` (bouton
« Message » d'une page — page `active` uniquement 404, jamais la sienne
400, get-or-create sur (page, initiateur)) et
`GET /conversations/page/:pageId` sert mon fil existant. La forme
CONVERSATION expose `listing` NULLABLE et `page` (référence légère —
repli « Page supprimée »). Non-lus, badge et event `message.created`
inchangés.

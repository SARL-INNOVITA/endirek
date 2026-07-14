/**
 * Sous-vue « Conversations » de l'onglet Dealplace (CP2.5 — D67) — liste
 * paginée de TOUTES les conversations (GET /admin/dealplace/conversations)
 * et panneau détail avec le fil EN CLAIR + modération des messages
 * (PATCH /admin/dealplace/messages/:id/status).
 *
 * Le backoffice lit les corps RÉELS (y compris masqués) : la modération doit
 * lire pour statuer. Un message masqué RESTE dans le fil des participants,
 * son corps y est remplacé par « Message masqué par la modération. ».
 *
 * Depuis le Lot 3, une conversation porte sur une annonce Dealplace OU sur
 * une page restaurant/entreprise (exactement une des deux cibles non
 * nulle) : la colonne « Sujet » et le panneau affichent l'une ou l'autre.
 */

import { useEffect, useState } from 'react'
import {
  adminListConversationMessages,
  adminListConversations,
  adminSetMessageStatus,
  toErrorMessage,
} from './api'
import type {
  AdminConversationCard,
  AdminMessage,
  MessageStatus,
  PagedAdminConversations,
} from './api'
import { Avatar, PageTypeBadge, formatDate, formatDateTime } from './ui'

/** Taille de page du backoffice (identique aux autres vues). */
const PAGE_SIZE = 20

/** Messages chargés par page dans le panneau détail. */
const MESSAGES_PAGE_SIZE = 50

/** Délai du debounce de recherche (simple setTimeout, suffisant ici). */
const SEARCH_DEBOUNCE_MS = 300

type ListState =
  | { kind: 'loading' }
  | { kind: 'success'; page: PagedAdminConversations }
  | { kind: 'error'; message: string }

type MessagesState =
  | { kind: 'loading' }
  | { kind: 'success'; messages: AdminMessage[]; total: number }
  | { kind: 'error'; message: string }

/** Sujet lisible d'une conversation : le titre de l'annonce ou le nom de la
 * page liée (Lot 3 — exactement une des deux cibles non nulle). */
function conversationSubject(conversation: AdminConversationCard): string {
  if (conversation.listing) return conversation.listing.title
  if (conversation.page) return `Page : ${conversation.page.name}`
  return '—'
}

export default function ConversationsView() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  // L'objet sélectionné (pas seulement l'id) : le panneau affiche les
  // participants/annonce sans re-fetch — re-synchronisé au rechargement
  // (même mécanique que ReportsView).
  const [selected, setSelected] = useState<AdminConversationCard | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setOffset(0)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    setList({ kind: 'loading' })

    adminListConversations(
      {
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset,
      },
      controller.signal,
    )
      .then((page) => {
        setList({ kind: 'success', page })
        // Garde la sélection cohérente avec la page rechargée.
        setSelected((current) =>
          current
            ? (page.items.find((item) => item.id === current.id) ?? current)
            : current,
        )
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setList({ kind: 'error', message: toErrorMessage(caught) })
      })

    return () => controller.abort()
  }, [debouncedSearch, offset])

  const loading = list.kind === 'loading'
  const total = list.kind === 'success' ? list.page.total : 0
  const hasPrevious = offset > 0
  const hasNext = list.kind === 'success' && offset + PAGE_SIZE < total

  return (
    <div
      className={
        selected ? 'view-layout view-layout--with-detail' : 'view-layout'
      }
    >
      <section className="card" aria-labelledby="conversations-title">
        <div className="card-header">
          <h2 id="conversations-title" className="card-title">
            Conversations
          </h2>
          {list.kind === 'success' && (
            <span className="badge badge--neutral">
              {total} conversation{total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="users-toolbar">
          <input
            type="search"
            className="users-search"
            placeholder="Rechercher un participant, une annonce ou une page…"
            aria-label="Rechercher un participant, une annonce ou une page"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {list.kind === 'loading' && <p className="muted">Chargement…</p>}

        {list.kind === 'error' && (
          <p className="form-error" role="alert">
            {list.message}
          </p>
        )}

        {list.kind === 'success' && list.page.items.length === 0 && (
          <p className="muted">
            Aucune conversation ne correspond à ces critères.
          </p>
        )}

        {list.kind === 'success' && list.page.items.length > 0 && (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col">Participants</th>
                  <th scope="col">Sujet</th>
                  <th scope="col">Dernier message</th>
                  <th scope="col">Activité</th>
                </tr>
              </thead>
              <tbody>
                {list.page.items.map((conversation) => (
                  <tr
                    key={conversation.id}
                    className={
                      conversation.id === selected?.id
                        ? 'user-row user-row--selected'
                        : 'user-row'
                    }
                    onClick={() => setSelected(conversation)}
                  >
                    <td>
                      <span className="deal-parties">
                        <span className="user-cell">
                          <Avatar
                            displayName={conversation.initiator.displayName}
                            avatarUrl={conversation.initiator.avatarUrl}
                          />
                          <span className="user-name">
                            {conversation.initiator.displayName}
                          </span>
                        </span>
                        <span className="deal-parties-arrow" aria-hidden="true">
                          →
                        </span>
                        <span className="user-cell">
                          <Avatar
                            displayName={conversation.owner.displayName}
                            avatarUrl={conversation.owner.avatarUrl}
                          />
                          <span className="user-name">
                            {conversation.owner.displayName}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td
                      className="cell-excerpt"
                      title={conversationSubject(conversation)}
                    >
                      {conversation.page ? (
                        <>
                          <span className="excerpt-title">
                            Page : {conversation.page.name}
                          </span>{' '}
                          <PageTypeBadge pageType={conversation.page.pageType} />
                        </>
                      ) : (
                        <span className="excerpt-title">
                          {conversation.listing?.title ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="cell-excerpt conversation-last-message">
                      {conversation.lastMessage ? (
                        <>
                          {conversation.lastMessage.status === 'hidden' && (
                            <span className="badge badge--dark">Masqué</span>
                          )}{' '}
                          <span
                            className={
                              conversation.lastMessage.status === 'hidden'
                                ? 'conversation-excerpt conversation-excerpt--hidden'
                                : 'conversation-excerpt'
                            }
                          >
                            {conversation.lastMessage.body}
                          </span>
                        </>
                      ) : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>
                    <td className="cell-muted">
                      {formatDate(
                        conversation.lastMessageAt ?? conversation.createdAt,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="users-pagination">
          <button
            type="button"
            className="button-ghost"
            disabled={!hasPrevious || loading}
            onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
          >
            ← Précédent
          </button>
          <span className="muted">
            {list.kind === 'success' && total > 0
              ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} sur ${total}`
              : '—'}
          </span>
          <button
            type="button"
            className="button-ghost"
            disabled={!hasNext || loading}
            onClick={() => setOffset((current) => current + PAGE_SIZE)}
          >
            Suivant →
          </button>
        </div>
      </section>

      {selected && (
        <ConversationPanel
          conversation={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ─── Panneau détail : fil en clair + modération des messages ─────────────────

interface ConversationPanelProps {
  conversation: AdminConversationCard
  onClose: () => void
}

function ConversationPanel({ conversation, onClose }: ConversationPanelProps) {
  const [state, setState] = useState<MessagesState>({ kind: 'loading' })
  // Pagination du fil (offset sur l'API « du plus récent au plus ancien »).
  const [offset, setOffset] = useState(0)
  const [messageActing, setMessageActing] = useState<string | null>(null)
  const [messageError, setMessageError] = useState<string | null>(null)

  useEffect(() => {
    setOffset(0)
  }, [conversation.id])

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    setMessageError(null)

    adminListConversationMessages(
      conversation.id,
      { limit: MESSAGES_PAGE_SIZE, offset },
      controller.signal,
    )
      .then((page) =>
        setState({
          kind: 'success',
          // L'API sert du plus récent au plus ancien : inversé pour lire le
          // fil chronologiquement.
          messages: [...page.items].reverse(),
          total: page.total,
        }),
      )
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: toErrorMessage(caught) })
      })

    return () => controller.abort()
  }, [conversation.id, offset])

  /** Masque ou réactive un message après confirmation explicite. */
  async function applyStatus(message: AdminMessage, status: MessageStatus) {
    const question =
      status === 'hidden'
        ? 'Masquer ce message ? Les participants verront « Message masqué par la modération. » (réversible).'
        : 'Réactiver ce message ? Son contenu redeviendra visible des participants.'
    if (!window.confirm(question)) return

    setMessageActing(message.id)
    setMessageError(null)
    try {
      const updated = await adminSetMessageStatus(message.id, status)
      setState((current) =>
        current.kind === 'success'
          ? {
              ...current,
              messages: current.messages.map((m) =>
                m.id === updated.id ? updated : m,
              ),
            }
          : current,
      )
    } catch (caught) {
      setMessageError(toErrorMessage(caught))
    } finally {
      setMessageActing(null)
    }
  }

  /** Nom d'un participant à partir de son id. */
  function senderName(senderId: string): string {
    if (senderId === conversation.initiator.id) {
      return conversation.initiator.displayName
    }
    if (senderId === conversation.owner.id) {
      return conversation.owner.displayName
    }
    return 'Compte inconnu'
  }

  const total = state.kind === 'success' ? state.total : 0
  const hasOlder = state.kind === 'success' && offset + MESSAGES_PAGE_SIZE < total
  const hasNewer = offset > 0

  return (
    <aside className="card detail-panel" aria-label="Détail de la conversation">
      <div className="detail-header">
        <h3 className="card-title">Conversation</h3>
        <button type="button" className="button-ghost" onClick={onClose}>
          Fermer
        </button>
      </div>

      <div className="detail-body">
        <div className="detail-identity">
          <Avatar
            displayName={conversation.initiator.displayName}
            avatarUrl={conversation.initiator.avatarUrl}
          />
          <div>
            <p className="detail-name">
              {conversation.initiator.displayName} →{' '}
              {conversation.owner.displayName}
            </p>
            <p className="detail-email">
              {conversation.listing
                ? `Annonce : ${conversation.listing.title}`
                : conversationSubject(conversation)}
            </p>
          </div>
        </div>

        {state.kind === 'loading' && <p className="muted">Chargement…</p>}

        {state.kind === 'error' && (
          <p className="form-error" role="alert">
            {state.message}
          </p>
        )}

        {state.kind === 'success' && (
          <>
            {messageError && (
              <p className="form-error" role="alert">
                {messageError}
              </p>
            )}
            <ul className="deal-messages">
              {state.messages.map((message) => (
                <li
                  key={message.id}
                  className={
                    message.status === 'hidden'
                      ? 'deal-message deal-message--hidden'
                      : 'deal-message'
                  }
                >
                  <div className="deal-message-head">
                    <span className="deal-message-sender">
                      {senderName(message.senderId)}
                    </span>
                    <span className="muted">
                      {formatDateTime(message.createdAt)}
                    </span>
                    {message.status === 'hidden' && (
                      <span className="badge badge--dark">Masqué</span>
                    )}
                  </div>
                  <p className="deal-message-body">{message.body}</p>
                  <div className="report-actions">
                    {message.status === 'active' ? (
                      <button
                        type="button"
                        className="button-danger button-compact"
                        disabled={messageActing === message.id}
                        onClick={() => void applyStatus(message, 'hidden')}
                      >
                        {messageActing === message.id ? 'En cours…' : 'Masquer'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button-primary button-compact"
                        disabled={messageActing === message.id}
                        onClick={() => void applyStatus(message, 'active')}
                      >
                        {messageActing === message.id
                          ? 'En cours…'
                          : 'Réactiver'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {(hasOlder || hasNewer) && (
              <div className="users-pagination">
                <button
                  type="button"
                  className="button-ghost"
                  disabled={!hasOlder}
                  onClick={() =>
                    setOffset((current) => current + MESSAGES_PAGE_SIZE)
                  }
                >
                  ← Plus anciens
                </button>
                <span className="muted">{total} messages</span>
                <button
                  type="button"
                  className="button-ghost"
                  disabled={!hasNewer}
                  onClick={() =>
                    setOffset((current) =>
                      Math.max(0, current - MESSAGES_PAGE_SIZE),
                    )
                  }
                >
                  Plus récents →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

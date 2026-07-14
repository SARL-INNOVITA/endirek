/**
 * Parametres pilotables du Lot 1 :
 * - types de posts (actifs, carte, duree, couleur, ordre) ;
 * - notification systeme dev/mock vers un utilisateur ou tous les actifs.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  adminCreateSystemNotification,
  adminListPostTypes,
  adminUpdatePostType,
  toErrorMessage,
} from './api'
import type {
  AdminPostType,
  AdminSystemNotificationResult,
  UpdatePostTypePayload,
} from './api'
import { TypeBadge, formatDateTime } from './ui'

type TypesState =
  | { kind: 'loading' }
  | { kind: 'success'; types: AdminPostType[] }
  | { kind: 'error'; message: string }

interface PostTypeFormState {
  labelFr: string
  icon: string
  color: string
  isActive: boolean
  showsOnMap: boolean
  requiresLocationForMap: boolean
  defaultMapDurationMinutes: string
  position: string
}

export default function SettingsView() {
  const [state, setState] = useState<TypesState>({ kind: 'loading' })
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    adminListPostTypes(controller.signal)
      .then((types) => {
        setState({ kind: 'success', types })
        setSelectedSlug((current) => current ?? types[0]?.slug ?? null)
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: toErrorMessage(caught) })
      })
    return () => controller.abort()
  }, [refreshCount])

  const selected =
    state.kind === 'success'
      ? state.types.find((type) => type.slug === selectedSlug) ?? null
      : null

  function handleTypeUpdated(updated: AdminPostType) {
    setState((current) => {
      if (current.kind !== 'success') return current
      return {
        kind: 'success',
        types: current.types
          .map((type) => (type.slug === updated.slug ? updated : type))
          .sort((a, b) => a.position - b.position || a.slug.localeCompare(b.slug)),
      }
    })
  }

  return (
    <div className="settings-stack">
      <div className={selected ? 'view-layout view-layout--with-detail' : 'view-layout'}>
        <section className="card" aria-labelledby="settings-types-title">
          <div className="card-header">
            <h2 id="settings-types-title" className="card-title">
              Types de posts
            </h2>
            {state.kind === 'success' && (
              <span className="badge badge--neutral">
                {state.types.length} type{state.types.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="card-hint">
            Les changements de duree carte s'appliquent aux nouvelles publications.
          </p>

          {state.kind === 'loading' && <p className="muted">Chargement...</p>}
          {state.kind === 'error' && (
            <p className="form-error" role="alert">
              {state.message}
            </p>
          )}

          {state.kind === 'success' && (
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Slug</th>
                    <th scope="col">Actif</th>
                    <th scope="col">Carte</th>
                    <th scope="col">Duree</th>
                    <th scope="col">Ordre</th>
                    <th scope="col">MAJ</th>
                  </tr>
                </thead>
                <tbody>
                  {state.types.map((type) => (
                    <tr
                      key={type.slug}
                      className={
                        type.slug === selectedSlug
                          ? 'user-row user-row--selected'
                          : 'user-row'
                      }
                      onClick={() => setSelectedSlug(type.slug)}
                    >
                      <td>
                        <TypeBadge slug={type.slug} type={type} />{' '}
                        {type.pageOnly && (
                          <span className="badge badge--neutral">
                            Réservé aux pages
                          </span>
                        )}
                      </td>
                      <td>
                        <code>{type.slug}</code>
                      </td>
                      <td>
                        <span
                          className={
                            type.isActive
                              ? 'badge badge--success'
                              : 'badge badge--neutral'
                          }
                        >
                          {type.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            type.showsOnMap
                              ? 'badge badge--info'
                              : 'badge badge--neutral'
                          }
                        >
                          {type.showsOnMap ? 'Carte' : 'Feed'}
                        </span>
                      </td>
                      <td className="cell-muted">
                        {type.defaultMapDurationMinutes ?? '-'}
                      </td>
                      <td>{type.position}</td>
                      <td className="cell-muted">
                        {type.updatedAt ? formatDateTime(type.updatedAt) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selected && (
          <PostTypeEditor
            type={selected}
            onUpdated={handleTypeUpdated}
            onRefresh={() => setRefreshCount((count) => count + 1)}
          />
        )}
      </div>

      <SystemNotificationCard />
    </div>
  )
}

interface PostTypeEditorProps {
  type: AdminPostType
  onUpdated: (type: AdminPostType) => void
  onRefresh: () => void
}

function PostTypeEditor({ type, onUpdated, onRefresh }: PostTypeEditorProps) {
  const [form, setForm] = useState<PostTypeFormState>(() => toForm(type))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(toForm(type))
    setMessage(null)
    setError(null)
  }, [type])

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(toForm(type)),
    [form, type],
  )

  async function save() {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = toPayload(form)
      const updated = await adminUpdatePostType(type.slug, payload)
      onUpdated(updated)
      setMessage('Parametres enregistres.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : toErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside className="card detail-panel" aria-label="Edition du type de post">
      <div className="detail-header">
        <h3 className="card-title">Parametres</h3>
        <button type="button" className="button-ghost" onClick={onRefresh}>
          Recharger
        </button>
      </div>

      <div className="settings-form">
        <div className="detail-row">
          <dt>Slug</dt>
          <dd>
            <code>{type.slug}</code>
          </dd>
        </div>

        {/* Type reserve aux pages (Lot 3) : publiable uniquement via
            POST /pages/:id/posts, absent du composer utilisateur. */}
        {type.pageOnly && (
          <div className="detail-badges">
            <span className="badge badge--neutral">Réservé aux pages</span>
          </div>
        )}

        <div className="form-field">
          <label htmlFor="post-type-label">Libelle</label>
          <input
            id="post-type-label"
            className="form-input"
            value={form.labelFr}
            onChange={(event) =>
              setForm((current) => ({ ...current, labelFr: event.target.value }))
            }
          />
        </div>

        <div className="camera-form-row">
          <div className="form-field">
            <label htmlFor="post-type-icon">Icone</label>
            <input
              id="post-type-icon"
              className="form-input"
              value={form.icon}
              onChange={(event) =>
                setForm((current) => ({ ...current, icon: event.target.value }))
              }
            />
          </div>
          <div className="form-field">
            <label htmlFor="post-type-color">Couleur</label>
            <input
              id="post-type-color"
              className="form-input"
              type="color"
              value={form.color}
              onChange={(event) =>
                setForm((current) => ({ ...current, color: event.target.value }))
              }
            />
          </div>
        </div>

        <label className="settings-check">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({ ...current, isActive: event.target.checked }))
            }
          />
          Disponible dans le composer mobile
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={form.showsOnMap}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                showsOnMap: event.target.checked,
                requiresLocationForMap: event.target.checked
                  ? true
                  : current.requiresLocationForMap,
              }))
            }
          />
          Eligible a la carte
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={form.requiresLocationForMap}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                requiresLocationForMap: event.target.checked,
              }))
            }
          />
          Requiert une localisation
        </label>

        <div className="camera-form-row">
          <div className="form-field">
            <label htmlFor="post-type-duration">Duree carte (min)</label>
            <input
              id="post-type-duration"
              className="form-input"
              inputMode="numeric"
              value={form.defaultMapDurationMinutes}
              // Types reserves aux pages : la fenetre carte est calculee par
              // l'API (service du jour, periode d'offre, evenement) — la
              // duree par defaut ne s'applique pas.
              disabled={type.pageOnly}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  defaultMapDurationMinutes: event.target.value,
                }))
              }
            />
            {type.pageOnly && (
              <span className="form-hint">
                Sans effet pour ce type : fenetre carte calculee par l'API.
              </span>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="post-type-position">Ordre</label>
            <input
              id="post-type-position"
              className="form-input"
              inputMode="numeric"
              value={form.position}
              onChange={(event) =>
                setForm((current) => ({ ...current, position: event.target.value }))
              }
            />
          </div>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && <p className="form-success">{message}</p>}

        <button
          type="button"
          className="button-primary"
          disabled={!dirty || saving}
          onClick={() => void save()}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </aside>
  )
}

function SystemNotificationCard() {
  const [broadcast, setBroadcast] = useState(false)
  const [userId, setUserId] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<AdminSystemNotificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const created = await adminCreateSystemNotification({
        ...(broadcast ? { broadcast: true } : { userId: userId.trim() }),
        ...(title.trim() !== '' ? { title: title.trim() } : {}),
        message: message.trim(),
      })
      setResult(created)
      setMessage('')
      setTitle('')
    } catch (caught) {
      setError(toErrorMessage(caught))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="card" aria-labelledby="settings-notifications-title">
      <div className="card-header">
        <h2 id="settings-notifications-title" className="card-title">
          Notification systeme
        </h2>
      </div>
      <p className="card-hint">
        Outil dev/mock : creation d'une notification in-app de type system.
      </p>

      <div className="settings-notification-form">
        <label className="settings-check">
          <input
            type="checkbox"
            checked={broadcast}
            onChange={(event) => setBroadcast(event.target.checked)}
          />
          Envoyer a tous les comptes actifs
        </label>

        {!broadcast && (
          <div className="form-field">
            <label htmlFor="system-notification-user">ID utilisateur</label>
            <input
              id="system-notification-user"
              className="form-input"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="UUID du destinataire"
            />
          </div>
        )}

        <div className="form-field">
          <label htmlFor="system-notification-title">Titre (facultatif)</label>
          <input
            id="system-notification-title"
            className="form-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="system-notification-message">Message</label>
          <textarea
            id="system-notification-message"
            className="resolution-note"
            rows={3}
            maxLength={500}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <p className="form-success">
            {result.createdCount} notification
            {result.createdCount > 1 ? 's' : ''} creee
            {result.createdCount > 1 ? 's' : ''}.
          </p>
        )}

        <button
          type="button"
          className="button-primary button-compact"
          disabled={
            sending || message.trim().length < 3 || (!broadcast && userId.trim() === '')
          }
          onClick={() => void submit()}
        >
          {sending ? 'Envoi...' : 'Envoyer'}
        </button>
      </div>
    </section>
  )
}

function toForm(type: AdminPostType): PostTypeFormState {
  return {
    labelFr: type.labelFr,
    icon: type.icon,
    color: type.color,
    isActive: type.isActive,
    showsOnMap: type.showsOnMap,
    requiresLocationForMap: type.requiresLocationForMap,
    defaultMapDurationMinutes:
      type.defaultMapDurationMinutes === null
        ? ''
        : String(type.defaultMapDurationMinutes),
    position: String(type.position),
  }
}

function toPayload(form: PostTypeFormState): UpdatePostTypePayload {
  const duration =
    form.defaultMapDurationMinutes.trim() === ''
      ? null
      : Number(form.defaultMapDurationMinutes)
  const position = Number(form.position)
  if (duration !== null && !Number.isInteger(duration)) {
    throw new Error('La duree carte doit etre un entier en minutes')
  }
  if (!Number.isInteger(position)) {
    throw new Error("L'ordre doit etre un entier")
  }
  return {
    labelFr: form.labelFr,
    icon: form.icon,
    color: form.color,
    isActive: form.isActive,
    showsOnMap: form.showsOnMap,
    requiresLocationForMap: form.requiresLocationForMap,
    defaultMapDurationMinutes: duration,
    position,
  }
}

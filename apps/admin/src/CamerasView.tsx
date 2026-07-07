/**
 * Vue « Caméras » du backoffice (checkpoint 5) — tableau paginé alimenté par
 * GET /api/v1/admin/cameras (tous statuts : active, inactive, error, hidden).
 *
 * - filtres catégorie (météo / trafic) + statut + recherche
 *   (nom / ville / description) avec debounce ;
 * - pagination limit 20 ;
 * - bouton « + Nouvelle caméra » (panneau CameraForm en création) ;
 * - clic sur une ligne : panneau détail avec édition et actions de statut
 *   (Activer / Désactiver / Marquer en erreur / Masquer) + suppression douce
 *   (DELETE = masquage). Toute action recharge la liste.
 *
 * Sécurité rappelée par le contrat : seules les caméras 'active' sont servies
 * côté carte publique — masquer une caméra ici la retire de la carte.
 */

import { useEffect, useState } from 'react'
import {
  adminDeleteCamera,
  adminListCameras,
  adminSetCameraStatus,
  toErrorMessage,
} from './api'
import type {
  Camera,
  CameraCategory,
  CameraStatus,
  PagedCameras,
} from './api'
import CameraForm from './CameraForm'
import {
  CameraCategoryBadge,
  CameraStatusBadge,
  formatDate,
} from './ui'

/** Taille de page du backoffice (identique aux autres vues). */
const PAGE_SIZE = 20

/** Délai du debounce de recherche (simple setTimeout, suffisant ici). */
const SEARCH_DEBOUNCE_MS = 300

/** '' = pas de filtre (aucun paramètre envoyé à l'API). */
type CategoryFilter = '' | CameraCategory
type StatusFilter = '' | CameraStatus

type ListState =
  | { kind: 'loading' }
  | { kind: 'success'; page: PagedCameras }
  | { kind: 'error'; message: string }

/** Panneau latéral ouvert : aucun, création, ou détail d'une caméra. */
type Panel =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'detail'; camera: Camera }

export default function CamerasView() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [offset, setOffset] = useState(0)
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const [panel, setPanel] = useState<Panel>({ kind: 'none' })
  // Incrémenté après une action réussie pour recharger la page courante.
  const [refreshCount, setRefreshCount] = useState(0)

  // Debounce de la recherche : appel API après une courte pause de saisie,
  // et retour en première page.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setOffset(0)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search])

  // Chargement de la page courante (annulé si les filtres changent entre-temps).
  useEffect(() => {
    const controller = new AbortController()
    setList({ kind: 'loading' })

    adminListCameras(
      {
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset,
      },
      controller.signal,
    )
      .then((page) => {
        setList({ kind: 'success', page })
        // Garde le panneau détail synchronisé avec la ligne rechargée sans le
        // fermer si la caméra a quitté la page courante (filtre/pagination).
        setPanel((current) => {
          if (current.kind !== 'detail') return current
          const fresh = page.items.find((c) => c.id === current.camera.id)
          return fresh ? { kind: 'detail', camera: fresh } : current
        })
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        // Le 401 est traité de façon centralisée par api.ts (retour au login).
        setList({ kind: 'error', message: toErrorMessage(caught) })
      })

    return () => controller.abort()
  }, [debouncedSearch, categoryFilter, statusFilter, offset, refreshCount])

  /** Recharge la page courante après une action réussie. */
  function reload() {
    setRefreshCount((count) => count + 1)
  }

  /** Caméra créée : ferme le panneau, revient en page 1 et recharge. */
  function handleCreated() {
    setPanel({ kind: 'none' })
    setOffset(0)
    reload()
  }

  /** Caméra éditée : garde le détail ouvert sur la version à jour et recharge. */
  function handleUpdated(updated: Camera) {
    setPanel({ kind: 'detail', camera: updated })
    reload()
  }

  const loading = list.kind === 'loading'
  const total = list.kind === 'success' ? list.page.total : 0
  const hasPrevious = offset > 0
  const hasNext = list.kind === 'success' && offset + PAGE_SIZE < total
  const panelOpen = panel.kind !== 'none'

  return (
    <div className={panelOpen ? 'view-layout view-layout--with-detail' : 'view-layout'}>
      <section className="card" aria-labelledby="cameras-title">
        <div className="card-header">
          <h2 id="cameras-title" className="card-title">
            Caméras
          </h2>
          <div className="card-header-actions">
            {list.kind === 'success' && (
              <span className="badge badge--neutral">
                {total} caméra{total > 1 ? 's' : ''}
              </span>
            )}
            <button
              type="button"
              className="button-primary button-compact"
              onClick={() => setPanel({ kind: 'create' })}
            >
              + Nouvelle caméra
            </button>
          </div>
        </div>

        <div className="users-toolbar">
          <input
            type="search"
            className="users-search"
            placeholder="Rechercher par nom, ville ou description…"
            aria-label="Rechercher par nom, ville ou description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="users-status-filter"
            aria-label="Filtrer par catégorie"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value as CategoryFilter)
              setOffset(0)
            }}
          >
            <option value="">Toutes les catégories</option>
            <option value="weather">Météo</option>
            <option value="traffic">Trafic</option>
          </select>
          <select
            className="users-status-filter"
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter)
              setOffset(0)
            }}
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actives</option>
            <option value="inactive">Inactives</option>
            <option value="error">En erreur</option>
            <option value="hidden">Masquées</option>
          </select>
        </div>

        {list.kind === 'loading' && <p className="muted">Chargement…</p>}

        {list.kind === 'error' && (
          <p className="form-error" role="alert">
            {list.message}
          </p>
        )}

        {list.kind === 'success' && list.page.items.length === 0 && (
          <p className="muted">Aucune caméra ne correspond à ces critères.</p>
        )}

        {list.kind === 'success' && list.page.items.length > 0 && (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col" className="cell-number">
                    N°
                  </th>
                  <th scope="col">Nom</th>
                  <th scope="col">Catégorie</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Ville</th>
                  <th scope="col">Coordonnées</th>
                  <th scope="col">Flux</th>
                  <th scope="col">Créée le</th>
                </tr>
              </thead>
              <tbody>
                {list.page.items.map((camera) => (
                  <tr
                    key={camera.id}
                    className={
                      panel.kind === 'detail' && panel.camera.id === camera.id
                        ? 'user-row user-row--selected'
                        : 'user-row'
                    }
                    onClick={() => setPanel({ kind: 'detail', camera })}
                  >
                    <td className="cell-number camera-number">
                      {camera.cameraNumber}
                    </td>
                    <td className="user-name">{camera.name}</td>
                    <td>
                      <CameraCategoryBadge category={camera.category} />
                    </td>
                    <td>
                      <CameraStatusBadge status={camera.status} />
                    </td>
                    <td className="cell-muted">{camera.cityName}</td>
                    <td className="camera-coords">
                      {formatCoords(camera.location)}
                    </td>
                    <td>
                      {/* stopPropagation : ouvrir le flux ne sélectionne pas la
                          ligne (pas de bascule inutile du panneau détail). */}
                      <a
                        className="camera-link"
                        href={camera.url}
                        target="_blank"
                        rel="noreferrer"
                        title="Ouvrir le flux dans un nouvel onglet"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Ouvrir ↗
                      </a>
                    </td>
                    <td className="cell-muted">{formatDate(camera.createdAt)}</td>
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

      {panel.kind === 'create' && (
        <CameraForm
          onClose={() => setPanel({ kind: 'none' })}
          onSaved={handleCreated}
        />
      )}

      {panel.kind === 'detail' && (
        <CameraDetail
          camera={panel.camera}
          onClose={() => setPanel({ kind: 'none' })}
          onChanged={reload}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}

// ─── Panneau détail / actions d'une caméra ───────────────────────────────────

interface CameraDetailProps {
  camera: Camera
  onClose: () => void
  /** Une action de statut / suppression a eu lieu : recharger la liste. */
  onChanged: () => void
  /** La caméra a été éditée : le détail se met à jour sur la nouvelle version. */
  onUpdated: (camera: Camera) => void
}

/** Statuts posables depuis les actions (le masquage passe par « Supprimer »). */
const STATUS_ACTIONS: { status: CameraStatus; label: string; className: string }[] = [
  { status: 'active', label: 'Activer', className: 'button-primary' },
  { status: 'inactive', label: 'Désactiver', className: 'button-ghost' },
  { status: 'error', label: 'Marquer en erreur', className: 'button-ghost' },
]

function CameraDetail({ camera, onClose, onChanged, onUpdated }: CameraDetailProps) {
  const [editing, setEditing] = useState(false)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // En mode édition, on délègue au formulaire (pré-rempli avec la caméra).
  if (editing) {
    return (
      <CameraForm
        camera={camera}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          setEditing(false)
          onUpdated(updated)
        }}
      />
    )
  }

  /** Change le statut de la caméra puis recharge la liste. */
  async function applyStatus(status: CameraStatus) {
    setActing(true)
    setActionError(null)
    try {
      await adminSetCameraStatus(camera.id, status)
      onChanged()
    } catch (caught) {
      setActionError(toErrorMessage(caught))
    } finally {
      setActing(false)
    }
  }

  /** Suppression DOUCE (DELETE = masquage) après confirmation. */
  async function handleDelete() {
    const question =
      `Masquer la caméra « ${camera.name} » ? ` +
      'Elle disparaîtra de la carte publique (masquage doux, réversible).'
    if (!window.confirm(question)) return

    setActing(true)
    setActionError(null)
    try {
      await adminDeleteCamera(camera.id)
      onChanged()
    } catch (caught) {
      setActionError(toErrorMessage(caught))
    } finally {
      setActing(false)
    }
  }

  return (
    <aside className="card detail-panel" aria-label="Détail de la caméra">
      <div className="detail-header">
        <h3 className="card-title">Caméra n° {camera.cameraNumber}</h3>
        <button type="button" className="button-ghost" onClick={onClose}>
          Fermer
        </button>
      </div>

      <div className="detail-body">
        <div className="detail-badges">
          <CameraCategoryBadge category={camera.category} />
          <CameraStatusBadge status={camera.status} />
        </div>

        <p className="detail-name">{camera.name}</p>
        {camera.description !== '' && (
          <p className="detail-bio">{camera.description}</p>
        )}

        <dl className="detail-rows">
          <div className="detail-row">
            <dt>Identifiant</dt>
            <dd>
              <code>{camera.id}</code>
            </dd>
          </div>
          <div className="detail-row">
            <dt>Type de flux</dt>
            <dd>{camera.streamType}</dd>
          </div>
          <div className="detail-row">
            <dt>Flux</dt>
            <dd>
              <a
                className="camera-link"
                href={camera.url}
                target="_blank"
                rel="noreferrer"
                title="Ouvrir le flux dans un nouvel onglet"
              >
                Ouvrir ↗
              </a>
            </dd>
          </div>
          <div className="detail-row">
            <dt>Ville</dt>
            <dd>{camera.cityName}</dd>
          </div>
          <div className="detail-row">
            <dt>Quartier</dt>
            <dd>{camera.districtName ?? '—'}</dd>
          </div>
          <div className="detail-row">
            <dt>Coordonnées</dt>
            <dd className="camera-coords">{formatCoords(camera.location)}</dd>
          </div>
          <div className="detail-row">
            <dt>Créée le</dt>
            <dd>{formatDate(camera.createdAt)}</dd>
          </div>
          <div className="detail-row">
            <dt>Modifiée le</dt>
            <dd>{formatDate(camera.updatedAt)}</dd>
          </div>
        </dl>

        {actionError && (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        )}

        <div className="camera-form-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => setEditing(true)}
            disabled={acting}
          >
            Modifier
          </button>
        </div>

        <section aria-label="Changer le statut">
          <h4 className="detail-section-title">Statut</h4>
          <div className="camera-status-actions">
            {STATUS_ACTIONS.map(({ status, label, className }) => (
              <button
                key={status}
                type="button"
                className={className}
                disabled={acting || camera.status === status}
                onClick={() => void applyStatus(status)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section aria-label="Masquer la caméra">
          <h4 className="detail-section-title">Masquage</h4>
          <p className="muted camera-delete-hint">
            Masquer retire la caméra de la carte publique (statut « hidden »).
            Aucune suppression dure : le numéro est préservé.
          </p>
          <button
            type="button"
            className="button-danger"
            disabled={acting || camera.status === 'hidden'}
            onClick={() => void handleDelete()}
          >
            {camera.status === 'hidden' ? 'Déjà masquée' : 'Masquer'}
          </button>
        </section>
      </div>
    </aside>
  )
}

// ─── Aides d'affichage ───────────────────────────────────────────────────────

/** Coordonnées courtes (4 décimales) pour l'aperçu tableau / détail. */
function formatCoords(location: { lat: number; lng: number }): string {
  return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
}

/**
 * Panneau de création / édition d'une caméra (checkpoint 5).
 *
 * - mode CRÉATION (aucune caméra fournie) : POST /api/v1/admin/cameras ;
 * - mode ÉDITION (caméra fournie) : PATCH /api/v1/admin/cameras/:id (champs
 *   partiels). Le statut n'est PAS modifié ici : il a sa propre route,
 *   pilotée depuis les actions de la liste / du détail (CamerasView).
 *
 * Validation côté client (garde-fou avant l'appel — l'API reste l'autorité) :
 * - name obligatoire (1 à 120 caractères) ;
 * - url http/https (protocole obligatoire) ;
 * - latitude / longitude dans l'emprise approximative de La Réunion
 *   (lat -21.6..-20.7, lng 55.0..56.0), mêmes bornes que l'API : un point
 *   hors emprise est refusé ici avec un message clair, sans aller-retour.
 *
 * Les erreurs 400 renvoyées par l'API (hors emprise détectée côté serveur,
 * validation, etc.) sont affichées telles quelles sous le formulaire.
 */

import { useState } from 'react'
import {
  adminCreateCamera,
  adminUpdateCamera,
  toErrorMessage,
} from './api'
import type {
  Camera,
  CameraCategory,
  CameraStreamType,
  CreateCameraPayload,
  UpdateCameraPayload,
} from './api'
import { CAMERA_CATEGORY_LABELS } from './ui'

/** Emprise approximative de La Réunion — miroir de REUNION_BBOX côté API
 * (common/geo/reunion.ts). Garde-fou client : l'API revalide de son côté. */
const REUNION_BOUNDS = {
  latMin: -21.6,
  latMax: -20.7,
  lngMin: 55.0,
  lngMax: 56.0,
} as const

/** Catégories proposées dans le select (source unique : libellés de ui.tsx). */
const CATEGORY_OPTIONS: CameraCategory[] = ['weather', 'traffic']

/** Types de flux proposés dans le select. */
const STREAM_TYPE_OPTIONS: { value: CameraStreamType; label: string }[] = [
  { value: 'image', label: 'Image (photo rafraîchie)' },
  { value: 'video', label: 'Vidéo' },
  { value: 'iframe', label: 'Iframe (intégration)' },
]

interface CameraFormProps {
  /** Caméra à éditer, ou null/undefined pour une création. */
  camera?: Camera | null
  /** Ferme le panneau sans enregistrer. */
  onClose: () => void
  /** Caméra créée ou mise à jour : la vue recharge sa liste. */
  onSaved: (camera: Camera) => void
}

/** État interne du formulaire (tout en chaînes — champs contrôlés). */
interface FormState {
  name: string
  category: CameraCategory
  streamType: CameraStreamType
  url: string
  description: string
  latitude: string
  longitude: string
  cityName: string
  districtName: string
}

/** Valeurs initiales : vierges en création, pré-remplies en édition. */
function initialState(camera: Camera | null | undefined): FormState {
  if (!camera) {
    return {
      name: '',
      category: 'weather',
      streamType: 'image',
      url: '',
      description: '',
      latitude: '',
      longitude: '',
      cityName: '',
      districtName: '',
    }
  }
  return {
    name: camera.name,
    category: camera.category,
    streamType: camera.streamType,
    url: camera.url,
    description: camera.description,
    latitude: String(camera.location.lat),
    longitude: String(camera.location.lng),
    cityName: camera.cityName,
    districtName: camera.districtName ?? '',
  }
}

export default function CameraForm({ camera, onClose, onSaved }: CameraFormProps) {
  const isEdit = Boolean(camera)
  const [form, setForm] = useState<FormState>(() => initialState(camera))
  const [saving, setSaving] = useState(false)
  /** Erreur de validation client (bloque l'envoi). */
  const [validationError, setValidationError] = useState<string | null>(null)
  /** Erreur renvoyée par l'API (400 hors emprise, etc.). */
  const [apiError, setApiError] = useState<string | null>(null)

  /** Met à jour un champ du formulaire. */
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  /**
   * Valide le formulaire et renvoie soit les coordonnées analysées, soit un
   * message d'erreur (français) à afficher. La validation « à La Réunion »
   * reprend exactement les bornes de l'API.
   */
  function validate(): { lat: number; lng: number } | { error: string } {
    if (form.name.trim().length < 1 || form.name.trim().length > 120) {
      return { error: 'Le nom doit contenir entre 1 et 120 caractères.' }
    }

    const url = form.url.trim()
    if (!/^https?:\/\/\S+/i.test(url)) {
      return {
        error:
          "L'URL du flux doit être une URL valide en http ou https (protocole obligatoire).",
      }
    }

    const lat = Number(form.latitude.trim().replace(',', '.'))
    const lng = Number(form.longitude.trim().replace(',', '.'))
    if (
      form.latitude.trim() === '' ||
      form.longitude.trim() === '' ||
      Number.isNaN(lat) ||
      Number.isNaN(lng)
    ) {
      return { error: 'La latitude et la longitude doivent être des nombres.' }
    }
    if (
      lat < REUNION_BOUNDS.latMin ||
      lat > REUNION_BOUNDS.latMax ||
      lng < REUNION_BOUNDS.lngMin ||
      lng > REUNION_BOUNDS.lngMax
    ) {
      return {
        error:
          'La caméra doit être située à La Réunion ' +
          `(latitude ${REUNION_BOUNDS.latMin}…${REUNION_BOUNDS.latMax}, ` +
          `longitude ${REUNION_BOUNDS.lngMin}…${REUNION_BOUNDS.lngMax}).`,
      }
    }

    return { lat, lng }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setApiError(null)

    const result = validate()
    if ('error' in result) {
      setValidationError(result.error)
      return
    }
    setValidationError(null)

    setSaving(true)
    try {
      const name = form.name.trim()
      const url = form.url.trim()
      const description = form.description.trim()
      const cityName = form.cityName.trim()
      const districtName = form.districtName.trim()
      const location = { lat: result.lat, lng: result.lng }

      let saved: Camera
      if (isEdit && camera) {
        // Édition : on envoie toujours les champs éditables (l'API ne modifie
        // que ce qui est fourni ; cityName vide reste ignorée côté serveur).
        const payload: UpdateCameraPayload = {
          name,
          category: form.category,
          streamType: form.streamType,
          url,
          description,
          location,
          districtName,
          ...(cityName ? { cityName } : {}),
        }
        saved = await adminUpdateCamera(camera.id, payload)
      } else {
        // Création : cityName et districtName restent omis s'ils sont vides
        // (cityName sera déduite par géocodage côté serveur).
        const payload: CreateCameraPayload = {
          name,
          category: form.category,
          streamType: form.streamType,
          url,
          location,
          ...(description ? { description } : {}),
          ...(cityName ? { cityName } : {}),
          ...(districtName ? { districtName } : {}),
        }
        saved = await adminCreateCamera(payload)
      }
      onSaved(saved)
    } catch (caught) {
      // 400 (hors emprise détectée côté serveur, validation) et autres erreurs
      // portent déjà un message français propre renvoyé par l'API.
      setApiError(toErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside
      className="card detail-panel"
      aria-label={isEdit ? 'Modifier la caméra' : 'Nouvelle caméra'}
    >
      <div className="detail-header">
        <h3 className="card-title">
          {isEdit ? 'Modifier la caméra' : 'Nouvelle caméra'}
        </h3>
        <button type="button" className="button-ghost" onClick={onClose}>
          Fermer
        </button>
      </div>

      <form className="camera-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-field">
          <label htmlFor="camera-name">Nom</label>
          <input
            id="camera-name"
            type="text"
            className="form-input"
            maxLength={120}
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            disabled={saving}
            required
          />
        </div>

        <div className="camera-form-row">
          <div className="form-field">
            <label htmlFor="camera-category">Catégorie</label>
            <select
              id="camera-category"
              className="users-status-filter"
              value={form.category}
              onChange={(event) =>
                set('category', event.target.value as CameraCategory)
              }
              disabled={saving}
            >
              {CATEGORY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {CAMERA_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="camera-stream-type">Type de flux</label>
            <select
              id="camera-stream-type"
              className="users-status-filter"
              value={form.streamType}
              onChange={(event) =>
                set('streamType', event.target.value as CameraStreamType)
              }
              disabled={saving}
            >
              {STREAM_TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="camera-url">URL du flux</label>
          <input
            id="camera-url"
            type="url"
            className="form-input"
            placeholder="https://…"
            value={form.url}
            onChange={(event) => set('url', event.target.value)}
            disabled={saving}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="camera-description">Description (facultative)</label>
          <textarea
            id="camera-description"
            className="resolution-note"
            rows={2}
            maxLength={500}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            disabled={saving}
          />
        </div>

        <div className="camera-form-row">
          <div className="form-field">
            <label htmlFor="camera-latitude">Latitude</label>
            <input
              id="camera-latitude"
              type="text"
              inputMode="decimal"
              className="form-input"
              placeholder="-20.8823"
              value={form.latitude}
              onChange={(event) => set('latitude', event.target.value)}
              disabled={saving}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="camera-longitude">Longitude</label>
            <input
              id="camera-longitude"
              type="text"
              inputMode="decimal"
              className="form-input"
              placeholder="55.4504"
              value={form.longitude}
              onChange={(event) => set('longitude', event.target.value)}
              disabled={saving}
              required
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="camera-city">Ville</label>
          <input
            id="camera-city"
            type="text"
            className="form-input"
            maxLength={120}
            placeholder="Laissée vide : déduite automatiquement du point"
            value={form.cityName}
            onChange={(event) => set('cityName', event.target.value)}
            disabled={saving}
          />
          <p className="form-hint">
            Si vide, la ville est déduite côté serveur à partir des coordonnées.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="camera-district">Quartier (facultatif)</label>
          <input
            id="camera-district"
            type="text"
            className="form-input"
            maxLength={120}
            value={form.districtName}
            onChange={(event) => set('districtName', event.target.value)}
            disabled={saving}
          />
        </div>

        {isEdit && (
          <p className="form-hint">
            Le statut de la caméra se change via les actions de la liste
            (Activer / Désactiver / Marquer en erreur / Masquer).
          </p>
        )}

        {validationError && (
          <p className="form-error" role="alert">
            {validationError}
          </p>
        )}
        {apiError && (
          <p className="form-error" role="alert">
            {apiError}
          </p>
        )}

        <div className="camera-form-actions">
          <button type="submit" className="button-primary" disabled={saving}>
            {saving
              ? 'Enregistrement…'
              : isEdit
                ? 'Enregistrer'
                : 'Créer la caméra'}
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </button>
        </div>
      </form>
    </aside>
  )
}

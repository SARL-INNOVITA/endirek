/**
 * Carte « État de l'API » (GET /health) — héritée de l'étape 1, déplacée en
 * pied de page dans une version compacte pour laisser la place à la vue
 * Utilisateurs. TODO Lot 2+ : partager les types santé via un paquet commun.
 */

import { useEffect, useState } from 'react'
import { API_URL } from './api'

/** Réponse attendue de `GET /health` (tolérante : tous les champs optionnels). */
interface HealthResponse {
  status?: string
  version?: string
  environment?: string
  /** Durée de fonctionnement de l'API, en secondes. */
  uptime?: number
}

/** États possibles de la vérification de santé de l'API. */
type HealthState =
  | { kind: 'loading' }
  | { kind: 'success'; data: HealthResponse }
  | { kind: 'error' }

/** Formate une durée en secondes en libellé lisible (ex. « 2 h 5 min 12 s »). */
function formatUptime(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds % 60)
  const minutes = Math.floor((totalSeconds / 60) % 60)
  const hours = Math.floor((totalSeconds / 3600) % 24)
  const days = Math.floor(totalSeconds / 86400)

  const parts: string[] = []
  if (days > 0) parts.push(`${days} j`)
  if (hours > 0) parts.push(`${hours} h`)
  if (minutes > 0) parts.push(`${minutes} min`)
  parts.push(`${seconds} s`)
  return parts.join(' ')
}

export default function HealthCard() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' })
  // Chaque « Revérifier » relance l'effet ; le nettoyage annule l'appel
  // précédent via AbortController (garde anti-course).
  const [checkCount, setCheckCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setHealth({ kind: 'loading' })

    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`réponse HTTP ${response.status}`)
        const data = (await response.json()) as HealthResponse
        if (controller.signal.aborted) return
        setHealth({ kind: 'success', data })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setHealth({ kind: 'error' })
      })

    return () => controller.abort()
  }, [checkCount])

  return (
    <div className="health-strip" aria-label="État de l'API">
      <span className="health-strip-label">État de l'API</span>

      {health.kind === 'loading' && (
        <span className="badge badge--neutral">Vérification…</span>
      )}
      {health.kind === 'success' && (
        <>
          <span className="badge badge--success">API en ligne</span>
          <span className="health-strip-meta">
            v{health.data.version ?? '?'} · {health.data.environment ?? '—'}
            {health.data.uptime !== undefined &&
              ` · uptime ${formatUptime(health.data.uptime)}`}
          </span>
        </>
      )}
      {health.kind === 'error' && (
        <>
          <span className="badge badge--error">API injoignable</span>
          <span className="health-strip-meta">
            Lancez <code>npm run api:dev</code> ({API_URL})
          </span>
        </>
      )}

      <button
        type="button"
        className="button-ghost"
        onClick={() => setCheckCount((count) => count + 1)}
        disabled={health.kind === 'loading'}
      >
        Revérifier
      </button>
    </div>
  )
}

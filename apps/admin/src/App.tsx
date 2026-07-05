import { useEffect, useState } from 'react'

/**
 * Réponse attendue de `GET /health` exposé par l'API Endirek (apps/api).
 * Tous les champs sont optionnels : le backoffice reste tolérant si le
 * contrat évolue. TODO Lot 2+ : partager ces types via un paquet commun.
 */
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
  | { kind: 'error'; message: string }

/** URL de base de l'API (surchargée via `.env` → VITE_API_URL). */
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

/** Sections du backoffice prévues à l'étape 6 (liste statique désactivée). */
const UPCOMING_SECTIONS = [
  'Utilisateurs',
  'Publications',
  'Commentaires',
  'Signalements',
  'Caméras météo/trafic',
  'Paramètres',
]

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

export default function App() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' })
  // Compteur incrémenté par « Revérifier » : chaque changement relance
  // l'effet ci-dessous, dont le nettoyage annule l'appel précédent via
  // AbortController (garde anti-course).
  const [checkCount, setCheckCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    setHealth({ kind: 'loading' })

    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`réponse HTTP ${response.status}`)
        }
        const data = (await response.json()) as HealthResponse
        // Symétrie avec le .catch : ne pas mettre à jour l'état si l'appel
        // a été annulé pendant la lecture du corps (démontage/revérification).
        if (controller.signal.aborted) return
        setHealth({ kind: 'success', data })
      })
      .catch((error: unknown) => {
        // Appel annulé (démontage ou revérification) : ne rien afficher.
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setHealth({ kind: 'error', message })
      })

    return () => controller.abort()
  }, [checkCount])

  return (
    <div className="app">
      <header>
        <h1 className="app-title">ENDIREK</h1>
        <p className="app-subtitle">
          Backoffice — Lot 1 (minimal, en construction : étape 6)
        </p>
      </header>

      <main className="app-main">
        <section className="card" aria-labelledby="health-title">
          <div className="card-header">
            <h2 id="health-title" className="card-title">
              État de l'API
            </h2>
            {health.kind === 'loading' && (
              <span className="badge badge--neutral">Vérification…</span>
            )}
            {health.kind === 'success' && (
              <span className="badge badge--success">API en ligne</span>
            )}
            {health.kind === 'error' && (
              <span className="badge badge--error">API injoignable</span>
            )}
          </div>

          {health.kind === 'success' && (
            <dl className="health-details">
              <div className="health-row">
                <dt>Version</dt>
                <dd>{health.data.version ?? '—'}</dd>
              </div>
              <div className="health-row">
                <dt>Environnement</dt>
                <dd>{health.data.environment ?? '—'}</dd>
              </div>
              <div className="health-row">
                <dt>Uptime</dt>
                <dd>
                  {health.data.uptime !== undefined
                    ? formatUptime(health.data.uptime)
                    : '—'}
                </dd>
              </div>
            </dl>
          )}

          {health.kind === 'error' && (
            <div className="health-error">
              <p>
                Impossible de joindre l'API sur <code>{API_URL}</code> (
                {health.message}).
              </p>
              <p className="health-hint">
                Lancez <code>npm run api:dev</code> à la racine du monorepo.
              </p>
            </div>
          )}

          <button
            type="button"
            className="button-primary"
            onClick={() => setCheckCount((count) => count + 1)}
            disabled={health.kind === 'loading'}
          >
            Revérifier
          </button>
        </section>

        <section className="card" aria-labelledby="sections-title">
          <h2 id="sections-title" className="card-title">
            Sections à venir (étape 6)
          </h2>
          <p className="card-hint">
            Modules de gestion prévus pour la version complète du backoffice.
          </p>
          {/* Liste statique désactivée : sera branchée sur l'API à l'étape 6.
              TODO Lot 2+ : statistiques, modération avancée, notifications. */}
          <ul className="sections-list">
            {UPCOMING_SECTIONS.map((section) => (
              <li key={section}>
                <button type="button" className="section-item" disabled>
                  {section}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="app-footer">
        <p>Endirek — La Réunion · Lot 1 · squelette technique</p>
      </footer>
    </div>
  )
}

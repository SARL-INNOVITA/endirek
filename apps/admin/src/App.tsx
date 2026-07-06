/**
 * Racine du backoffice Endirek — Lot 1, étapes 3 et 4.
 *
 * Pas de routeur : un état de session + un état d'onglet suffisent.
 * - session en restauration → écran d'attente ;
 * - anonyme → LoginView (réservé aux rôles moderator / super_admin) ;
 * - administrateur connecté → onglets « Utilisateurs » (étape 3),
 *   « Publications » et « Signalements » (étape 4). L'onglet Signalements
 *   porte le nombre de signalements ouverts (un seul fetch du total —
 *   rechargé après chaque décision de modération).
 *
 * La session est restaurée au chargement via GET /api/v1/auth/me avec le
 * jeton conservé en localStorage (choix DEV documenté dans api.ts —
 * TODO cookie httpOnly/session plus tard). La carte « État de l'API » de
 * l'étape 1 est conservée, déplacée en pied de page (HealthCard).
 */

import { useCallback, useEffect, useState } from 'react'
import {
  adminListReports,
  clearToken,
  fetchMe,
  getToken,
  isAdminRole,
  logout,
  onSessionExpired,
} from './api'
import type { FullProfile } from './api'
import HealthCard from './HealthCard'
import LoginView from './LoginView'
import PostsView from './PostsView'
import ReportsView from './ReportsView'
import UsersView from './UsersView'
import { RoleBadge } from './ui'

/** État de session du backoffice. */
type Session =
  | { kind: 'restoring' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; admin: FullProfile }

/** Onglets du backoffice connecté. */
type Tab = 'users' | 'posts' | 'reports'

const TAB_LABELS: Record<Tab, string> = {
  users: 'Utilisateurs',
  posts: 'Publications',
  reports: 'Signalements',
}

const TABS: Tab[] = ['users', 'posts', 'reports']

export default function App() {
  const [session, setSession] = useState<Session>({ kind: 'restoring' })
  const [tab, setTab] = useState<Tab>('users')
  /** Nombre de signalements 'open' (badge de l'onglet) — null tant qu'inconnu. */
  const [openReportsCount, setOpenReportsCount] = useState<number | null>(null)

  // Restauration de session au chargement : si un jeton est présent, on le
  // valide via GET /auth/me et on revérifie le rôle (un compte rétrogradé,
  // suspendu ou supprimé entre-temps est renvoyé au login).
  useEffect(() => {
    if (!getToken()) {
      setSession({ kind: 'anonymous' })
      return
    }

    const controller = new AbortController()
    fetchMe(controller.signal)
      .then((me) => {
        if (isAdminRole(me.role)) {
          setSession({ kind: 'authenticated', admin: me })
        } else {
          clearToken()
          setSession({ kind: 'anonymous' })
        }
      })
      .catch(() => {
        // Jeton expiré/invalide ou API injoignable : retour au login.
        if (controller.signal.aborted) return
        clearToken()
        setSession({ kind: 'anonymous' })
      })

    return () => controller.abort()
  }, [])

  /**
   * Recharge le badge de l'onglet Signalements : un fetch minimal
   * (limit=1) dont seul le total est utilisé. Silencieux en cas d'échec
   * (le badge disparaît simplement, la vue reste utilisable).
   */
  const refreshOpenReportsCount = useCallback(() => {
    adminListReports({ status: 'open', limit: 1, offset: 0 })
      .then((page) => setOpenReportsCount(page.total))
      .catch(() => setOpenReportsCount(null))
  }, [])

  // Compteur chargé à l'entrée en session (puis rechargé par ReportsView
  // après chaque décision de modération).
  useEffect(() => {
    if (session.kind === 'authenticated') {
      refreshOpenReportsCount()
    }
  }, [session.kind, refreshOpenReportsCount])

  /** Déconnexion : appel de courtoisie à l'API puis purge locale du jeton. */
  const handleLogout = useCallback(() => {
    void logout() // stateless côté serveur : l'échec éventuel est sans effet
    clearToken()
    setSession({ kind: 'anonymous' })
    setTab('users')
    setOpenReportsCount(null)
  }, [])

  /** Jeton refusé en cours de session (401) : purge et retour au login. */
  const handleSessionExpired = useCallback(() => {
    clearToken()
    setSession({ kind: 'anonymous' })
    setTab('users')
    setOpenReportsCount(null)
  }, [])

  // Toute réponse 401 sur un appel authentifié (n'importe quelle vue) ramène
  // au login : le client API notifie ce gestionnaire de façon centralisée.
  useEffect(() => {
    onSessionExpired(handleSessionExpired)
    return () => onSessionExpired(null)
  }, [handleSessionExpired])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-row">
          <div>
            <h1 className="app-title">ENDIREK</h1>
            <p className="app-subtitle">
              Backoffice — Lot 1 · utilisateurs, publications & signalements
            </p>
          </div>

          {session.kind === 'authenticated' && (
            <div className="app-session">
              <span className="app-session-user">
                {session.admin.displayName} <RoleBadge role={session.admin.role} />
              </span>
              <button type="button" className="button-ghost" onClick={handleLogout}>
                Se déconnecter
              </button>
            </div>
          )}
        </div>

        {session.kind === 'authenticated' && (
          <nav className="app-tabs" aria-label="Sections du backoffice">
            {TABS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={candidate === tab ? 'app-tab app-tab--active' : 'app-tab'}
                aria-current={candidate === tab ? 'page' : undefined}
                onClick={() => setTab(candidate)}
              >
                {TAB_LABELS[candidate]}
                {candidate === 'reports' &&
                  openReportsCount !== null &&
                  openReportsCount > 0 && (
                    <span className="app-tab-count">{openReportsCount}</span>
                  )}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="app-main">
        {session.kind === 'restoring' && (
          <section className="card">
            <p className="muted">Restauration de la session…</p>
          </section>
        )}

        {session.kind === 'anonymous' && (
          <LoginView
            onLoggedIn={(admin) => setSession({ kind: 'authenticated', admin })}
          />
        )}

        {session.kind === 'authenticated' && tab === 'users' && (
          <UsersView onSessionExpired={handleSessionExpired} />
        )}
        {session.kind === 'authenticated' && tab === 'posts' && <PostsView />}
        {session.kind === 'authenticated' && tab === 'reports' && (
          <ReportsView onOpenCountChanged={refreshOpenReportsCount} />
        )}
      </main>

      <footer className="app-footer">
        <HealthCard />
        <p>Endirek — La Réunion · Lot 1 · étape 4</p>
      </footer>
    </div>
  )
}

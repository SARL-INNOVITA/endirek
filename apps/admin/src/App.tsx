/**
 * Racine du backoffice Endirek — Lot 1, étape 3.
 *
 * Pas de routeur : un simple état de session suffit pour l'instant.
 * - session en restauration → écran d'attente ;
 * - anonyme → LoginView (réservé aux rôles moderator / super_admin) ;
 * - administrateur connecté → UsersView (gestion des comptes).
 *
 * La session est restaurée au chargement via GET /api/v1/auth/me avec le
 * jeton conservé en localStorage (choix DEV documenté dans api.ts —
 * TODO cookie httpOnly/session plus tard). La carte « État de l'API » de
 * l'étape 1 est conservée, déplacée en pied de page (HealthCard).
 */

import { useCallback, useEffect, useState } from 'react'
import {
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
import UsersView from './UsersView'
import { RoleBadge } from './ui'

/** État de session du backoffice. */
type Session =
  | { kind: 'restoring' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; admin: FullProfile }

export default function App() {
  const [session, setSession] = useState<Session>({ kind: 'restoring' })

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

  /** Déconnexion : appel de courtoisie à l'API puis purge locale du jeton. */
  const handleLogout = useCallback(() => {
    void logout() // stateless côté serveur : l'échec éventuel est sans effet
    clearToken()
    setSession({ kind: 'anonymous' })
  }, [])

  /** Jeton refusé en cours de session (401) : purge et retour au login. */
  const handleSessionExpired = useCallback(() => {
    clearToken()
    setSession({ kind: 'anonymous' })
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
        <div>
          <h1 className="app-title">ENDIREK</h1>
          <p className="app-subtitle">Backoffice — Lot 1 · gestion des utilisateurs</p>
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

        {session.kind === 'authenticated' && (
          <UsersView onSessionExpired={handleSessionExpired} />
        )}
      </main>

      <footer className="app-footer">
        <HealthCard />
        <p>Endirek — La Réunion · Lot 1 · étape 3</p>
      </footer>
    </div>
  )
}

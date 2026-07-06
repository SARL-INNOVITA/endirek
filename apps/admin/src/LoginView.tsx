/**
 * Formulaire de connexion du backoffice — POST /api/v1/auth/login.
 *
 * L'entrée n'est accordée QU'AUX rôles moderator et super_admin : un compte
 * utilisateur classique reçoit « Accès réservé aux administrateurs » et
 * aucun jeton n'est conservé.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  clearToken,
  isAdminRole,
  login,
  setToken,
  toErrorMessage,
} from './api'
import type { FullProfile } from './api'

interface LoginViewProps {
  /** Appelé quand un administrateur est authentifié (jeton déjà stocké). */
  onLoggedIn: (admin: FullProfile) => void
}

export default function LoginView({ onLoggedIn }: LoginViewProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const session = await login(email.trim(), password)

      // Garde-fou rôle : le backoffice est réservé aux administrateurs.
      // On purge par précaution tout jeton résiduel et on ne stocke RIEN.
      if (!isAdminRole(session.user.role)) {
        clearToken()
        setError('Accès réservé aux administrateurs')
        return
      }

      setToken(session.accessToken)
      onLoggedIn(session.user)
    } catch (caught) {
      setError(toErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card login-card" aria-labelledby="login-title">
      <h2 id="login-title" className="card-title">
        Connexion administrateur
      </h2>
      <p className="card-hint">
        Réservé aux comptes modérateur et super administrateur.
      </p>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="form-field">
          <label htmlFor="login-password">Mot de passe</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </section>
  )
}

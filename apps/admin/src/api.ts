/**
 * Client HTTP typé du backoffice Endirek — Lot 1, étape 3.
 *
 * Regroupe tous les appels à l'API (auth + administration des utilisateurs)
 * derrière des fonctions typées, ainsi que la gestion du jeton d'accès.
 *
 * Stockage du jeton : `localStorage` — choix assumé pour le DÉVELOPPEMENT
 * uniquement (simple, survit au rechargement de la page). Un stockage
 * accessible en JavaScript est exposé au vol de jeton en cas de XSS.
 * TODO (durcissement, Lot 2+) : cookie httpOnly + session côté serveur,
 * ou a minima rotation courte des jetons via /auth/refresh.
 */

// ─── Types du contrat d'API (étape 3) ────────────────────────────────────────

export type UserRole = 'user' | 'moderator' | 'super_admin'
export type UserStatus = 'active' | 'suspended' | 'deleted'

/** Statuts posables par le backoffice (la suppression passe par le flux RGPD). */
export type AdminSettableStatus = 'active' | 'suspended'

/**
 * PROFIL COMPLET — forme renvoyée par l'API à l'utilisateur lui-même et aux
 * administrateurs (email, role, status et settings inclus). Les dates sont
 * sérialisées en chaînes ISO par le JSON.
 */
export interface FullProfile {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  coverUrl: string | null
  bio: string
  city: string | null
  role: UserRole
  status: UserStatus
  settings: Record<string, unknown>
  followersCount: number
  followingCount: number
  postsCount: number
  createdAt: string
}

/** Réponse de POST /auth/login : profil complet + paire de jetons. */
export interface AuthSession {
  user: FullProfile
  accessToken: string
  refreshToken: string
}

/** Page de la liste backoffice (GET /admin/users). */
export interface PagedUsers {
  items: FullProfile[]
  total: number
}

/** Paramètres de la liste backoffice — mêmes noms que la query string. */
export interface ListUsersParams {
  search?: string
  status?: UserStatus
  limit: number
  offset: number
}

// ─── Configuration ───────────────────────────────────────────────────────────

/** URL de base de l'API (surchargée via `.env` → VITE_API_URL). */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

/** Préfixe global des routes métier de l'API (le /health en est exclu). */
const API_BASE = `${API_URL}/api/v1`

/** Rôles autorisés à entrer dans le backoffice. */
const ADMIN_ROLES: readonly UserRole[] = ['moderator', 'super_admin']

/** Vrai si le rôle donne accès au backoffice (moderator ou super_admin). */
export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role)
}

// ─── Jeton d'accès (localStorage — voir l'avertissement en tête de fichier) ──

const TOKEN_KEY = 'endirek.admin.accessToken'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/** Purge le jeton (déconnexion, session invalide ou rôle insuffisant). */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// ─── Détection centralisée de la fin de session (401) ────────────────────────

/**
 * Gestionnaire notifié quand un appel AUTHENTIFIÉ reçoit un 401 (jeton expiré
 * ou révoqué en cours de session). Enregistré par App via [onSessionExpired] ;
 * `request()` l'invoque pour purger le jeton et ramener au login, quelle que
 * soit la vue à l'origine de l'appel (UsersView, UserDetail…).
 */
let sessionExpiredHandler: (() => void) | null = null

/** Enregistre (ou retire, avec `null`) le gestionnaire de fin de session. */
export function onSessionExpired(handler: (() => void) | null): void {
  sessionExpiredHandler = handler
}

// ─── Erreur d'API ────────────────────────────────────────────────────────────

/**
 * Erreur levée quand l'API répond avec un statut HTTP d'échec.
 * `message` reprend le message (français, sans détail technique) renvoyé
 * par l'API quand il existe, sinon un libellé générique par statut.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Libellés de secours si le corps d'erreur ne porte pas de message. */
function defaultErrorMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Session expirée ou identifiants invalides'
    case 403:
      return 'Accès refusé'
    case 404:
      return 'Ressource introuvable'
    default:
      return 'Une erreur est survenue, veuillez réessayer'
  }
}

/** Extrait le message d'erreur du corps NestJS ({ message: string | string[] }). */
function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const raw = (body as { message: unknown }).message
    if (typeof raw === 'string' && raw.trim() !== '') return raw
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
      return raw.join(' — ')
    }
  }
  return defaultErrorMessage(status)
}

// ─── Requête générique ───────────────────────────────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** Corps JSON éventuel (sérialisé automatiquement). */
  body?: unknown
  /** Joindre le jeton d'accès en Authorization: Bearer (défaut : oui). */
  auth?: boolean
  /** Signal d'annulation (AbortController) pour les listes/recherches. */
  signal?: AbortSignal
}

/**
 * Appel JSON générique vers l'API. Lève :
 * - ApiError si l'API répond avec un statut d'échec ;
 * - TypeError (fetch) si l'API est injoignable — à traduire côté vue.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  // Corps JSON éventuel (204 No Content, ou corps vide/HTML → null).
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    // Un 401 sur un appel AUTHENTIFIÉ = jeton expiré/révoqué en cours de
    // session : purge locale + notification globale (retour au login), quelle
    // que soit la vue appelante. Les appels non authentifiés (login) sont
    // exclus : leur 401 est une erreur métier (identifiants invalides), pas une
    // fin de session. Les 403/409 métier ne déclenchent RIEN ici (affichés
    // inline par les vues : super_admin intouchable, compte supprimé, etc.).
    if (response.status === 401 && auth) {
      clearToken()
      sessionExpiredHandler?.()
    }
    throw new ApiError(response.status, extractErrorMessage(payload, response.status))
  }
  return payload as T
}

/** Message présentable pour n'importe quelle erreur attrapée par une vue. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) {
    return "Impossible de joindre l'API — vérifiez qu'elle est démarrée"
  }
  return 'Une erreur est survenue, veuillez réessayer'
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/** POST /auth/login — le jeton n'est PAS stocké ici (la vue vérifie d'abord le rôle). */
export function login(email: string, password: string): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  })
}

/** GET /auth/me — restauration de session au chargement du backoffice. */
export function fetchMe(signal?: AbortSignal): Promise<FullProfile> {
  return request<FullProfile>('/auth/me', { signal })
}

/**
 * POST /auth/logout — appel de courtoisie : l'API est stateless (elle ne
 * révoque rien, limite documentée côté API), c'est la purge locale du jeton
 * qui déconnecte réellement. Les échecs sont donc ignorés.
 */
export async function logout(): Promise<void> {
  try {
    await request<undefined>('/auth/logout', { method: 'POST' })
  } catch {
    // Sans conséquence : le jeton est purgé par l'appelant quoi qu'il arrive.
  }
}

// ─── Administration des utilisateurs ─────────────────────────────────────────

/** GET /admin/users?search=&status=&limit=&offset= — PROFILS COMPLETS paginés. */
export function listUsers(
  params: ListUsersParams,
  signal?: AbortSignal,
): Promise<PagedUsers> {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  query.set('limit', String(params.limit))
  query.set('offset', String(params.offset))
  return request<PagedUsers>(`/admin/users?${query.toString()}`, { signal })
}

/** GET /admin/users/:id — PROFIL COMPLET quel que soit le statut du compte. */
export function getUser(id: string, signal?: AbortSignal): Promise<FullProfile> {
  return request<FullProfile>(`/admin/users/${encodeURIComponent(id)}`, { signal })
}

/** PATCH /admin/users/:id/status — suspendre ou réactiver un compte. */
export function updateUserStatus(
  id: string,
  status: AdminSettableStatus,
): Promise<FullProfile> {
  return request<FullProfile>(`/admin/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status },
  })
}

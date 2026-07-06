/**
 * Client HTTP typé du backoffice Endirek — Lot 1, étapes 3 et 4.
 *
 * Regroupe tous les appels à l'API (auth, administration des utilisateurs,
 * publications et signalements) derrière des fonctions typées, ainsi que la
 * gestion du jeton d'accès.
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

// ─── Types du contrat d'API (étape 4 — publications & signalements) ──────────

export type PostStatus = 'active' | 'hidden' | 'deleted'

/** Statuts posables par le backoffice sur une publication ('deleted' reste
 * réservé à l'auteur et au flux RGPD — 400 API sinon). */
export type AdminSettablePostStatus = 'active' | 'hidden'

/** Forme AUTEUR du contrat (les comptes supprimés arrivent déjà anonymisés). */
export interface PostAuthor {
  id: string
  displayName: string
  avatarUrl: string | null
  city: string | null
}

/** Forme MEDIA du contrat — images uniquement au Lot 1. */
export interface PostMedia {
  url: string
  thumbnailUrl: string | null
  width: number | null
  height: number | null
  mediaType: 'image' | 'video'
  position: number
}

/** Un emoji et son nombre de réactions (élément de reactionsTop). */
export interface EmojiCount {
  emoji: string
  count: number
}

/** Forme FEED_POST du contrat (dates sérialisées en chaînes ISO). */
export interface FeedPost {
  id: string
  typeSlug: string
  title: string | null
  body: string
  city: string | null
  location: { lat: number; lng: number } | null
  mapExpiresAt: string | null
  urlSlug: string
  status: PostStatus
  createdAt: string
  updatedAt: string
  reactionCount: number
  commentCount: number
  shareCount: number
  saveCount: number
  author: PostAuthor
  media: PostMedia[]
  viewerReaction: string | null
  viewerSaved: boolean
  reactionsTop: EmojiCount[]
}

/** FEED_POST enrichi pour le backoffice du nombre de signalements ouverts. */
export interface AdminFeedPost extends FeedPost {
  openReportsCount: number
}

/** Type de publication (table de référence post_types, GET /posts/types). */
export interface PostType {
  slug: string
  labelFr: string
  icon: string
  color: string
  requiresLocationForMap: boolean
  showsOnMap: boolean
  defaultMapDurationMinutes: number | null
  position: number
}

/** Motifs de signalement (codes pilotés côté app — libellés dans ui.tsx). */
export type ReportReasonCode =
  | 'spam'
  | 'hateful'
  | 'dangerous'
  | 'false_info'
  | 'other'

/** Cycle de vie d'un signalement ('open' = « pending » de la spec produit). */
export type ReportStatus = 'open' | 'reviewed' | 'action_taken' | 'dismissed'

/** Décisions posables au traitement (le retour à 'open' n'existe pas). */
export type ReportDecision = 'reviewed' | 'action_taken' | 'dismissed'

export type ReportTargetType = 'post' | 'comment' | 'user'

/** Signalement lié affiché dans le détail backoffice d'une publication. */
export interface AdminPostReport {
  id: string
  reasonCode: ReportReasonCode
  message: string
  status: ReportStatus
  createdAt: string
  reporter: PostAuthor
}

/** Détail backoffice d'une publication : FEED_POST + signalements liés. */
export interface AdminPostDetail extends AdminFeedPost {
  reports: AdminPostReport[]
}

/** Extrait d'une PUBLICATION signalée (body déjà tronqué à 140 par l'API). */
export interface ReportPostTarget {
  id: string
  title: string | null
  body: string
  typeSlug: string
  status: PostStatus
  urlSlug: string
}

/** Extrait d'un COMMENTAIRE signalé (body déjà tronqué à 140 par l'API). */
export interface ReportCommentTarget {
  id: string
  body: string
  status: 'active' | 'hidden' | 'deleted'
  postId: string
}

/**
 * Signalement de la file de modération. `target` se discrimine par
 * `targetType` ('post' → ReportPostTarget, 'comment' → ReportCommentTarget) ;
 * null si la cible est introuvable ou de type 'user' (Lot 2+).
 */
export interface AdminReport {
  id: string
  targetType: ReportTargetType
  targetId: string
  reasonCode: ReportReasonCode
  message: string
  status: ReportStatus
  createdAt: string
  handledBy: string | null
  handledAt: string | null
  resolutionNote: string | null
  reporter: PostAuthor
  target: ReportPostTarget | ReportCommentTarget | null
}

/** Page de la liste backoffice des publications (GET /admin/posts). */
export interface PagedAdminPosts {
  items: AdminFeedPost[]
  total: number
}

/** Page de la file de modération (GET /admin/reports). */
export interface PagedAdminReports {
  items: AdminReport[]
  total: number
}

/** Paramètres de GET /admin/posts — mêmes noms que la query string. */
export interface AdminListPostsParams {
  typeSlug?: string
  status?: PostStatus
  search?: string
  limit: number
  offset: number
}

/** Paramètres de GET /admin/reports — mêmes noms que la query string. */
export interface AdminListReportsParams {
  status?: ReportStatus
  targetType?: ReportTargetType
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

// ─── Types de publication (référentiel) ──────────────────────────────────────

/**
 * GET /posts/types — types de publication ACTIFS, triés par position.
 * Table de référence pilotable : les libellés et couleurs des badges du
 * backoffice viennent d'ici, jamais du code.
 */
export function listPostTypes(signal?: AbortSignal): Promise<PostType[]> {
  return request<PostType[]>('/posts/types', { signal })
}

// ─── Administration des publications ─────────────────────────────────────────

/** GET /admin/posts?typeSlug=&status=&search=&limit=&offset= — tous statuts. */
export function adminListPosts(
  params: AdminListPostsParams,
  signal?: AbortSignal,
): Promise<PagedAdminPosts> {
  const query = new URLSearchParams()
  if (params.typeSlug) query.set('typeSlug', params.typeSlug)
  if (params.status) query.set('status', params.status)
  if (params.search) query.set('search', params.search)
  query.set('limit', String(params.limit))
  query.set('offset', String(params.offset))
  return request<PagedAdminPosts>(`/admin/posts?${query.toString()}`, { signal })
}

/** GET /admin/posts/:id — FEED_POST quel que soit le statut + signalements liés. */
export function adminGetPost(
  id: string,
  signal?: AbortSignal,
): Promise<AdminPostDetail> {
  return request<AdminPostDetail>(`/admin/posts/${encodeURIComponent(id)}`, {
    signal,
  })
}

/** PATCH /admin/posts/:id/status — masquer ou republier une publication. */
export function adminSetPostStatus(
  id: string,
  status: AdminSettablePostStatus,
): Promise<AdminFeedPost> {
  return request<AdminFeedPost>(
    `/admin/posts/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: { status } },
  )
}

// ─── Administration des signalements ─────────────────────────────────────────

/** GET /admin/reports?status=&targetType=&limit=&offset= — tri createdAt DESC. */
export function adminListReports(
  params: AdminListReportsParams,
  signal?: AbortSignal,
): Promise<PagedAdminReports> {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.targetType) query.set('targetType', params.targetType)
  query.set('limit', String(params.limit))
  query.set('offset', String(params.offset))
  return request<PagedAdminReports>(`/admin/reports?${query.toString()}`, {
    signal,
  })
}

/**
 * PATCH /admin/reports/:id — pose la décision (reviewed | action_taken |
 * dismissed) avec la note de résolution éventuelle ; l'API renseigne
 * handledBy (admin courant) et handledAt (now).
 */
export function adminHandleReport(
  id: string,
  decision: ReportDecision,
  resolutionNote?: string,
): Promise<AdminReport> {
  return request<AdminReport>(`/admin/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {
      status: decision,
      ...(resolutionNote ? { resolutionNote } : {}),
    },
  })
}

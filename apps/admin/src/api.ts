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
  role?: UserRole
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
  isActive: boolean
  position: number
  createdAt?: string
  updatedAt?: string
}

/** Type de publication vu par le backoffice (inclut actifs + inactifs). */
export interface AdminPostType extends PostType {
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdatePostTypePayload {
  labelFr?: string
  icon?: string
  color?: string
  requiresLocationForMap?: boolean
  showsOnMap?: boolean
  defaultMapDurationMinutes?: number | null
  isActive?: boolean
  position?: number
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
  status: CommentStatus
  postId: string
}

export type CommentStatus = 'active' | 'hidden' | 'deleted'

export interface AdminCommentView {
  id: string
  postId: string
  parentCommentId: string | null
  depth: 0 | 1
  body: string
  status: CommentStatus
  reactionCount: number
  createdAt: string
  updatedAt: string
  author: PostAuthor
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
  mapVisible?: boolean
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

// ─── Types du contrat d'API (checkpoint 5 — caméras) ─────────────────────────

/** Type de flux d'une caméra (image fixe rafraîchie, vidéo, ou iframe intégrée). */
export type CameraStreamType = 'image' | 'video' | 'iframe'

/** Catégorie d'une caméra (les deux catégories du Lot 1). */
export type CameraCategory = 'weather' | 'traffic'

/** Cycle de vie d'une caméra. Le public ne voit que 'active' ; le backoffice
 * voit tous les statuts. La suppression backoffice est un masquage doux (hidden). */
export type CameraStatus = 'active' | 'inactive' | 'error' | 'hidden'

/**
 * Forme CAMERA_ADMIN du contrat (CAMERA_PUBLIC + status + updatedAt) — la
 * forme servie au backoffice, tous statuts confondus. Les dates sont
 * sérialisées en chaînes ISO par le JSON.
 */
export interface Camera {
  id: string
  cameraNumber: number
  name: string
  streamType: CameraStreamType
  url: string
  category: CameraCategory
  description: string
  location: { lat: number; lng: number }
  cityName: string
  districtName: string | null
  status: CameraStatus
  createdAt: string
  updatedAt: string
}

/** Page de la liste backoffice des caméras (GET /admin/cameras). */
export interface PagedCameras {
  items: Camera[]
  total: number
}

/** Paramètres de GET /admin/cameras — mêmes noms que la query string. */
export interface AdminListCamerasParams {
  category?: CameraCategory
  status?: CameraStatus
  search?: string
  limit: number
  offset: number
}

/**
 * Corps de POST /admin/cameras. `cameraNumber` est attribué automatiquement
 * (jamais fourni). `cityName` est déduite par géocodage côté serveur si absente
 * ou vide. `location` doit se situer à La Réunion (400 sinon). `status` par
 * défaut 'active'.
 */
export interface CreateCameraPayload {
  name: string
  streamType: CameraStreamType
  url: string
  category: CameraCategory
  description?: string
  location: { lat: number; lng: number }
  cityName?: string
  districtName?: string
  status?: CameraStatus
}

/**
 * Corps de PATCH /admin/cameras/:id — modification partielle (le statut a sa
 * route dédiée). Tout champ omis reste inchangé.
 */
export interface UpdateCameraPayload {
  name?: string
  streamType?: CameraStreamType
  url?: string
  category?: CameraCategory
  description?: string
  location?: { lat: number; lng: number }
  cityName?: string
  districtName?: string
}

export interface AdminSystemNotificationPayload {
  userId?: string
  broadcast?: boolean
  title?: string
  message: string
}

export interface AdminSystemNotificationResult {
  createdCount: number
  userIds: string[]
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
  if (params.role) query.set('role', params.role)
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

/** GET /admin/post-types — tous les types, actifs ou non. */
export function adminListPostTypes(signal?: AbortSignal): Promise<AdminPostType[]> {
  return request<AdminPostType[]>('/admin/post-types', { signal })
}

/** PATCH /admin/post-types/:slug — parametres pilotables. */
export function adminUpdatePostType(
  slug: string,
  payload: UpdatePostTypePayload,
): Promise<AdminPostType> {
  return request<AdminPostType>(`/admin/post-types/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body: payload,
  })
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
  if (params.mapVisible !== undefined) {
    query.set('mapVisible', String(params.mapVisible))
  }
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

/** PATCH /admin/comments/:id/status — action de moderation commentaire. */
export function adminSetCommentStatus(
  id: string,
  status: CommentStatus,
): Promise<AdminCommentView> {
  return request<AdminCommentView>(
    `/admin/comments/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: { status } },
  )
}

// ─── Administration des caméras (checkpoint 5) ───────────────────────────────

/** GET /admin/cameras?category=&status=&search=&limit=&offset= — tous statuts,
 * triés par numéro croissant côté API. */
export function adminListCameras(
  params: AdminListCamerasParams,
  signal?: AbortSignal,
): Promise<PagedCameras> {
  const query = new URLSearchParams()
  if (params.category) query.set('category', params.category)
  if (params.status) query.set('status', params.status)
  if (params.search) query.set('search', params.search)
  query.set('limit', String(params.limit))
  query.set('offset', String(params.offset))
  return request<PagedCameras>(`/admin/cameras?${query.toString()}`, { signal })
}

/** GET /admin/cameras/:id — CAMERA_ADMIN quel que soit le statut (404 si
 * inexistante). */
export function adminGetCamera(id: string, signal?: AbortSignal): Promise<Camera> {
  return request<Camera>(`/admin/cameras/${encodeURIComponent(id)}`, { signal })
}

/** POST /admin/cameras — crée une caméra (201). cameraNumber auto, cityName
 * déduite si absente, location validée « à La Réunion » (400 sinon). */
export function adminCreateCamera(payload: CreateCameraPayload): Promise<Camera> {
  return request<Camera>('/admin/cameras', { method: 'POST', body: payload })
}

/** PATCH /admin/cameras/:id — modifie les champs fournis (le statut a sa
 * propre route). */
export function adminUpdateCamera(
  id: string,
  payload: UpdateCameraPayload,
): Promise<Camera> {
  return request<Camera>(`/admin/cameras/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  })
}

/** PATCH /admin/cameras/:id/status — change le statut (active | inactive |
 * error | hidden). */
export function adminSetCameraStatus(
  id: string,
  status: CameraStatus,
): Promise<Camera> {
  return request<Camera>(`/admin/cameras/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status },
  })
}

/** DELETE /admin/cameras/:id — suppression DOUCE (204) : la caméra passe en
 * statut 'hidden' côté API (pas de suppression dure, cameraNumber préservé). */
export function adminDeleteCamera(id: string): Promise<void> {
  return request<void>(`/admin/cameras/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** POST /admin/notifications/system — notification systeme dev/mock. */
export function adminCreateSystemNotification(
  payload: AdminSystemNotificationPayload,
): Promise<AdminSystemNotificationResult> {
  return request<AdminSystemNotificationResult>('/admin/notifications/system', {
    method: 'POST',
    body: payload,
  })
}

// ─── Types du contrat d'API (CP2.1 — Dealplace : taxonomie & annonces) ───────

/** Famille d'une annonce : bien (« good ») ou service (« service »). */
export type ListingFamily = 'good' | 'service'

/**
 * Niveau de modération d'une catégorie Dealplace :
 * - 'standard'  : catégorie normale ;
 * - 'sensitive' : autorisée mais marquée pour la modération ;
 * - 'forbidden' : création d'annonce refusée par l'API (400).
 */
export type ModerationLevel = 'standard' | 'sensitive' | 'forbidden'

/** Nature de la valeur d'une annonce : prix unique ('fixed') ou fourchette. */
export type ListingValueKind = 'fixed' | 'range'

/** Cycle de vie d'une annonce Dealplace (miroir des posts). */
export type ListingStatus = 'active' | 'hidden' | 'deleted'

/** Statuts posables par le backoffice ('deleted' réservé au propriétaire/RGPD). */
export type AdminSettableListingStatus = 'active' | 'hidden'

/** Préférence d'échange d'une annonce (ce que le propriétaire accepte). */
export type ExchangePref = 'goods' | 'services' | 'money' | 'open'

/** Média d'une annonce (miroir de la forme MEDIA des posts + position). */
export interface ListingMedia {
  url: string
  thumbnailUrl: string | null
  width: number | null
  height: number | null
  mediaType: 'image' | 'video'
  position: number
}

/** Lien externe attaché à une annonce ({ label, url }). */
export interface ListingExternalLink {
  label: string
  url: string
}

/** Tag imbriqué dans une annonce ({ slug, labelFr }). */
export interface ListingTagRef {
  slug: string
  labelFr: string
}

/** Catégorie imbriquée dans le détail LISTING (avec moderationLevel). */
export interface ListingCategoryRef {
  slug: string
  labelFr: string
  family: ListingFamily
  moderationLevel: ModerationLevel
}

/** Catégorie allégée des cartes LISTING_CARD (sans moderationLevel). */
export interface ListingCardCategoryRef {
  slug: string
  labelFr: string
  family: ListingFamily
}

/** Sous-catégorie imbriquée dans une annonce ({ slug, labelFr }). */
export interface ListingSubcategoryRef {
  slug: string
  labelFr: string
}

/**
 * Forme LISTING_CARD du contrat, enrichie du `status` par le backoffice
 * (GET /admin/dealplace/listings). `coverMedia` = premier média ou null.
 */
export interface AdminListingCard {
  id: string
  ownerId: string
  owner: PostAuthor
  listingType: ListingFamily
  title: string
  category: ListingCardCategoryRef
  subcategory: ListingSubcategoryRef
  valueKind: ListingValueKind
  valueMin: number
  valueMax: number | null
  currency: string
  city: string
  coverMedia: ListingMedia | null
  tags: ListingTagRef[]
  urlSlug: string
  createdAt: string
  status: ListingStatus
}

/** Forme LISTING complète (GET /admin/dealplace/listings/:id — détail). */
export interface AdminListingDetail {
  id: string
  ownerId: string
  owner: PostAuthor
  listingType: ListingFamily
  title: string
  description: string
  category: ListingCategoryRef
  subcategory: ListingSubcategoryRef
  valueKind: ListingValueKind
  valueMin: number
  valueMax: number | null
  currency: string
  city: string
  location: { lat: number; lng: number } | null
  exchangePrefs: ExchangePref[]
  externalLinks: ListingExternalLink[]
  media: ListingMedia[]
  tags: ListingTagRef[]
  urlSlug: string
  status: ListingStatus
  createdAt: string
  updatedAt: string
}

/** Page de la liste backoffice des annonces (GET /admin/dealplace/listings). */
export interface PagedAdminListings {
  items: AdminListingCard[]
  total: number
}

/** Paramètres de GET /admin/dealplace/listings — mêmes noms que la query string. */
export interface AdminListListingsParams {
  status?: ListingStatus
  family?: ListingFamily
  category?: string
  search?: string
  limit: number
  offset: number
}

/**
 * Entité `listing_categories` telle que servie au backoffice
 * (GET /admin/dealplace/categories — actives ET inactives). Dates ISO.
 */
export interface AdminListingCategory {
  slug: string
  family: ListingFamily
  labelFr: string
  position: number
  moderationLevel: ModerationLevel
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Entité `listing_subcategories` servie au backoffice. */
export interface AdminListingSubcategory {
  slug: string
  categorySlug: string
  labelFr: string
  position: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Entité `listing_tags` servie au backoffice (actifs ET inactifs). */
export interface AdminListingTag {
  slug: string
  labelFr: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Corps de POST /admin/dealplace/categories (slug/family immuables ensuite). */
export interface CreateListingCategoryPayload {
  slug: string
  family: ListingFamily
  labelFr: string
  position: number
  moderationLevel?: ModerationLevel
  isActive?: boolean
}

/** Corps de PATCH /admin/dealplace/categories/:slug (slug/family figés). */
export interface UpdateListingCategoryPayload {
  labelFr?: string
  position?: number
  moderationLevel?: ModerationLevel
  isActive?: boolean
}

/** Corps de POST /admin/dealplace/subcategories. */
export interface CreateListingSubcategoryPayload {
  slug: string
  categorySlug: string
  labelFr: string
  position: number
  isActive?: boolean
}

/** Corps de PATCH /admin/dealplace/subcategories/:slug (slug/catégorie figés). */
export interface UpdateListingSubcategoryPayload {
  labelFr?: string
  position?: number
  isActive?: boolean
}

/** Corps de POST /admin/dealplace/tags. */
export interface CreateListingTagPayload {
  slug: string
  labelFr: string
  isActive?: boolean
}

/** Corps de PATCH /admin/dealplace/tags/:slug (slug figé). */
export interface UpdateListingTagPayload {
  labelFr?: string
  isActive?: boolean
}

// ─── Administration des annonces Dealplace (CP2.1) ───────────────────────────

/**
 * GET /admin/dealplace/listings?status=&family=&category=&search=&limit=&offset=
 * — LISTING_CARD + status, TOUS statuts confondus (active, hidden, deleted).
 */
export function adminListListings(
  params: AdminListListingsParams,
  signal?: AbortSignal,
): Promise<PagedAdminListings> {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.family) query.set('family', params.family)
  if (params.category) query.set('category', params.category)
  if (params.search) query.set('search', params.search)
  query.set('limit', String(params.limit))
  query.set('offset', String(params.offset))
  return request<PagedAdminListings>(
    `/admin/dealplace/listings?${query.toString()}`,
    { signal },
  )
}

/** GET /admin/dealplace/listings/:id — LISTING complet quel que soit le statut. */
export function adminGetListing(
  id: string,
  signal?: AbortSignal,
): Promise<AdminListingDetail> {
  return request<AdminListingDetail>(
    `/admin/dealplace/listings/${encodeURIComponent(id)}`,
    { signal },
  )
}

/** PATCH /admin/dealplace/listings/:id/status — masquer ('hidden') ou
 * republier ('active'). 'deleted' refusé (400) ; annonce supprimée → 409. */
export function adminSetListingStatus(
  id: string,
  status: AdminSettableListingStatus,
): Promise<AdminListingCard> {
  return request<AdminListingCard>(
    `/admin/dealplace/listings/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: { status } },
  )
}

// ─── Administration de la taxonomie Dealplace (CP2.1) ────────────────────────

/** GET /admin/dealplace/categories — toutes les catégories (actives ET
 * inactives), triées par position. */
export function adminListListingCategories(
  signal?: AbortSignal,
): Promise<AdminListingCategory[]> {
  return request<AdminListingCategory[]>('/admin/dealplace/categories', {
    signal,
  })
}

/** POST /admin/dealplace/categories — crée une catégorie (201 ; 409 si slug pris). */
export function adminCreateListingCategory(
  payload: CreateListingCategoryPayload,
): Promise<AdminListingCategory> {
  return request<AdminListingCategory>('/admin/dealplace/categories', {
    method: 'POST',
    body: payload,
  })
}

/** PATCH /admin/dealplace/categories/:slug — label, position, moderationLevel,
 * isActive (slug et family immuables). */
export function adminUpdateListingCategory(
  slug: string,
  payload: UpdateListingCategoryPayload,
): Promise<AdminListingCategory> {
  return request<AdminListingCategory>(
    `/admin/dealplace/categories/${encodeURIComponent(slug)}`,
    { method: 'PATCH', body: payload },
  )
}

/** GET /admin/dealplace/subcategories?category=<slug> — sous-catégories d'une
 * catégorie (actives ET inactives). */
export function adminListListingSubcategories(
  categorySlug: string,
  signal?: AbortSignal,
): Promise<AdminListingSubcategory[]> {
  const query = new URLSearchParams({ category: categorySlug })
  return request<AdminListingSubcategory[]>(
    `/admin/dealplace/subcategories?${query.toString()}`,
    { signal },
  )
}

/** POST /admin/dealplace/subcategories — crée une sous-catégorie (201). */
export function adminCreateListingSubcategory(
  payload: CreateListingSubcategoryPayload,
): Promise<AdminListingSubcategory> {
  return request<AdminListingSubcategory>('/admin/dealplace/subcategories', {
    method: 'POST',
    body: payload,
  })
}

/** PATCH /admin/dealplace/subcategories/:slug — label, position, isActive
 * (slug et catégorie parente immuables). */
export function adminUpdateListingSubcategory(
  slug: string,
  payload: UpdateListingSubcategoryPayload,
): Promise<AdminListingSubcategory> {
  return request<AdminListingSubcategory>(
    `/admin/dealplace/subcategories/${encodeURIComponent(slug)}`,
    { method: 'PATCH', body: payload },
  )
}

/** GET /admin/dealplace/tags — tous les tags (actifs ET inactifs). */
export function adminListListingTags(
  signal?: AbortSignal,
): Promise<AdminListingTag[]> {
  return request<AdminListingTag[]>('/admin/dealplace/tags', { signal })
}

/** POST /admin/dealplace/tags — crée un tag (201 ; 409 si slug pris). */
export function adminCreateListingTag(
  payload: CreateListingTagPayload,
): Promise<AdminListingTag> {
  return request<AdminListingTag>('/admin/dealplace/tags', {
    method: 'POST',
    body: payload,
  })
}

/** PATCH /admin/dealplace/tags/:slug — label, isActive (slug immuable). */
export function adminUpdateListingTag(
  slug: string,
  payload: UpdateListingTagPayload,
): Promise<AdminListingTag> {
  return request<AdminListingTag>(
    `/admin/dealplace/tags/${encodeURIComponent(slug)}`,
    { method: 'PATCH', body: payload },
  )
}

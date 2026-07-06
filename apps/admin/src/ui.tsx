/**
 * Petits composants et aides d'interface partagés entre les vues du
 * backoffice : badges (rôle, statuts de compte/publication/signalement,
 * type de publication), avatar (image ou initiales), formats de date et
 * chargement du référentiel des types de publication.
 */

import { useEffect, useMemo, useState } from 'react'
import { listPostTypes } from './api'
import type {
  PostStatus,
  PostType,
  ReportReasonCode,
  ReportStatus,
  UserRole,
  UserStatus,
} from './api'

// ─── Libellés français ───────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Utilisateur',
  moderator: 'Modérateur',
  super_admin: 'Super admin',
}

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  deleted: 'Supprimé',
}

/** Classe de badge par statut : vert (actif), orange (suspendu), gris (supprimé). */
const STATUS_BADGE_CLASSES: Record<UserStatus, string> = {
  active: 'badge badge--success',
  suspended: 'badge badge--warning',
  deleted: 'badge badge--neutral',
}

/** Statuts de publication (feed) : active | hidden | deleted. */
const POST_STATUS_LABELS: Record<PostStatus, string> = {
  active: 'Active',
  hidden: 'Masquée',
  deleted: 'Supprimée',
}

const POST_STATUS_BADGE_CLASSES: Record<PostStatus, string> = {
  active: 'badge badge--success',
  hidden: 'badge badge--warning',
  deleted: 'badge badge--neutral',
}

/** Libellés français des 5 motifs de signalement du contrat. */
export const REPORT_REASON_LABELS: Record<ReportReasonCode, string> = {
  spam: 'Spam',
  hateful: 'Contenu haineux',
  dangerous: 'Contenu dangereux',
  false_info: 'Fausse information',
  other: 'Autre',
}

/** Statuts de signalement ('open' = « pending » de la spec produit). */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Ouvert',
  reviewed: 'Examiné',
  action_taken: 'Action prise',
  dismissed: 'Rejeté',
}

const REPORT_STATUS_BADGE_CLASSES: Record<ReportStatus, string> = {
  open: 'badge badge--error',
  reviewed: 'badge badge--info',
  action_taken: 'badge badge--success',
  dismissed: 'badge badge--neutral',
}

/** Formate une date ISO en date française courte (ex. « 06/07/2026 »). */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
}

/** Formate une date ISO en date + heure françaises (ex. « 06/07/2026 14:05 »). */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

// ─── Badges ──────────────────────────────────────────────────────────────────

/** Badge bleu du rôle (Utilisateur / Modérateur / Super admin). */
export function RoleBadge({ role }: { role: UserRole }) {
  return <span className="badge badge--info">{ROLE_LABELS[role]}</span>
}

/** Badge de statut de compte (Actif / Suspendu / Supprimé). */
export function StatusBadge({ status }: { status: UserStatus }) {
  return <span className={STATUS_BADGE_CLASSES[status]}>{STATUS_LABELS[status]}</span>
}

/** Badge de statut de publication (Active / Masquée / Supprimée). */
export function PostStatusBadge({ status }: { status: PostStatus }) {
  return (
    <span className={POST_STATUS_BADGE_CLASSES[status]}>
      {POST_STATUS_LABELS[status]}
    </span>
  )
}

/** Badge de statut de signalement (Ouvert / Examiné / Action prise / Rejeté). */
export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={REPORT_STATUS_BADGE_CLASSES[status]}>
      {REPORT_STATUS_LABELS[status]}
    </span>
  )
}

interface TypeBadgeProps {
  /** Slug du type (repli affiché si le référentiel n'est pas chargé). */
  slug: string
  /** Entrée du référentiel post_types — la couleur et le libellé viennent
   * de la table, jamais du code. */
  type: PostType | undefined
}

/**
 * Badge coloré d'un type de publication : pastille de la couleur du type
 * (fond teinté à ~10 %) + labelFr. Sans référentiel : badge neutre avec le slug.
 */
export function TypeBadge({ slug, type }: TypeBadgeProps) {
  if (!type) {
    return <span className="badge badge--neutral">{slug}</span>
  }
  return (
    <span className="badge badge--type" style={{ backgroundColor: `${type.color}1A` }}>
      <span className="type-dot" style={{ backgroundColor: type.color }} aria-hidden="true" />
      {type.labelFr}
    </span>
  )
}

// ─── Référentiel des types de publication ────────────────────────────────────

/**
 * Charge une fois (au montage de la vue) le référentiel des types de
 * publication (GET /posts/types) et l'indexe par slug pour les badges et
 * filtres. En cas d'échec, `types` reste null : les badges retombent sur le
 * slug brut et le filtre type est simplement vide — la vue reste utilisable.
 */
export function usePostTypes(): {
  types: PostType[] | null
  typesBySlug: Map<string, PostType>
} {
  const [types, setTypes] = useState<PostType[] | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    listPostTypes(controller.signal)
      .then(setTypes)
      .catch(() => {
        // Référentiel indisponible : repli documenté ci-dessus, sans erreur.
      })
    return () => controller.abort()
  }, [])

  const typesBySlug = useMemo(() => {
    const map = new Map<string, PostType>()
    for (const type of types ?? []) map.set(type.slug, type)
    return map
  }, [types])

  return { types, typesBySlug }
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

/** Initiales d'un nom affiché (ex. « Marie Hoarau » → « MH »). */
function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.slice(0, 2).map((word) => word[0].toUpperCase())
  return letters.join('')
}

interface AvatarProps {
  displayName: string
  avatarUrl: string | null
  /** Variante large pour le panneau détail. */
  size?: 'small' | 'large'
}

/** Avatar rond : image si `avatarUrl` est fourni, sinon initiales colorées. */
export function Avatar({ displayName, avatarUrl, size = 'small' }: AvatarProps) {
  const className = size === 'large' ? 'avatar avatar--large' : 'avatar'
  if (avatarUrl) {
    return <img className={className} src={avatarUrl} alt="" loading="lazy" />
  }
  return (
    <span className={className} aria-hidden="true">
      {initialsOf(displayName)}
    </span>
  )
}

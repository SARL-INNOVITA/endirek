/**
 * Petits composants d'interface partagés entre les vues du backoffice :
 * badges de rôle/statut, avatar (image ou initiales) et formatage de dates.
 */

import type { UserRole, UserStatus } from './api'

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

/** Formate une date ISO en date française courte (ex. « 06/07/2026 »). */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
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

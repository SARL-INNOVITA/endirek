/**
 * Petits composants et aides d'interface partagés entre les vues du
 * backoffice : badges (rôle, statuts de compte/publication/signalement,
 * type de publication), avatar (image ou initiales), formats de date et
 * chargement du référentiel des types de publication.
 */

import { useEffect, useMemo, useState } from 'react'
import { listPostTypes } from './api'
import type {
  CameraCategory,
  CameraStatus,
  DealStatus,
  DisputeResolution,
  ListingFamily,
  ListingStatus,
  ListingValueKind,
  MessageStatus,
  ModerationLevel,
  PageEventTiming,
  PageOpenStatus,
  PageStatus,
  PageType,
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

/** Catégories de caméra (checkpoint 5) : météo / trafic. */
export const CAMERA_CATEGORY_LABELS: Record<CameraCategory, string> = {
  weather: 'Météo',
  traffic: 'Trafic',
}

/** Statuts de caméra (checkpoint 5) — libellés français du backoffice. */
export const CAMERA_STATUS_LABELS: Record<CameraStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  error: 'En erreur',
  hidden: 'Masquée',
}

/**
 * Classe de badge par statut de caméra : vert (active), gris (inactive),
 * rouge (error) et sombre (hidden — masquée volontairement, plus appuyé que
 * le gris neutre d'un simple « inactive »).
 */
const CAMERA_STATUS_BADGE_CLASSES: Record<CameraStatus, string> = {
  active: 'badge badge--success',
  inactive: 'badge badge--neutral',
  error: 'badge badge--error',
  hidden: 'badge badge--dark',
}

// ─── Dealplace (CP2.1) : familles, statuts, modération ───────────────────────

/** Famille d'annonce : bien / service. */
export const LISTING_FAMILY_LABELS: Record<ListingFamily, string> = {
  good: 'Bien',
  service: 'Service',
}

/** Statuts d'annonce (miroir des publications) : active | hidden | deleted. */
export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  active: 'Active',
  hidden: 'Masquée',
  deleted: 'Supprimée',
}

const LISTING_STATUS_BADGE_CLASSES: Record<ListingStatus, string> = {
  active: 'badge badge--success',
  hidden: 'badge badge--warning',
  deleted: 'badge badge--neutral',
}

/** Niveaux de modération d'une catégorie : standard / sensible / interdit. */
export const MODERATION_LEVEL_LABELS: Record<ModerationLevel, string> = {
  standard: 'Standard',
  sensitive: 'Sensible',
  forbidden: 'Interdit',
}

/** Vert (standard), orange (sensible), rouge (interdit). */
const MODERATION_LEVEL_BADGE_CLASSES: Record<ModerationLevel, string> = {
  standard: 'badge badge--success',
  sensitive: 'badge badge--warning',
  forbidden: 'badge badge--error',
}

// ─── Dealplace (CP2.5) : deals, arbitrage, messages ──────────────────────────

/** Statuts d'un deal (machine à états D64). */
export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  proposed: 'Proposé',
  active: 'Actif',
  completed: 'Conclu',
  declined: 'Refusé',
  cancelled: 'Annulé',
  disputed: 'Litige',
}

/** Rouge pour la file de travail (litige), vert pour conclu, bleu pour
 * actif, gris pour les autres états. */
const DEAL_STATUS_BADGE_CLASSES: Record<DealStatus, string> = {
  proposed: 'badge badge--neutral',
  active: 'badge badge--info',
  completed: 'badge badge--success',
  declined: 'badge badge--neutral',
  cancelled: 'badge badge--neutral',
  disputed: 'badge badge--error',
}

/** Issues d'un arbitrage de litige (D66). */
export const DISPUTE_RESOLUTION_LABELS: Record<DisputeResolution, string> = {
  cancelled: 'Deal annulé',
  completed: 'Deal conclu',
  resumed: 'Reprise du deal',
}

/** Statuts de modération d'un message (D67). */
export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  active: 'Visible',
  hidden: 'Masqué',
}

// ─── Pages restaurants & entreprises (Lot 3) ─────────────────────────────────

/** Type de page professionnelle : restaurant / entreprise. */
export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  restaurant: 'Restaurant',
  business: 'Entreprise',
}

/** Statuts de page (miroir des annonces — au FÉMININ : une page). */
export const PAGE_STATUS_LABELS: Record<PageStatus, string> = {
  active: 'Active',
  hidden: 'Masquée',
  deleted: 'Supprimée',
}

const PAGE_STATUS_BADGE_CLASSES: Record<PageStatus, string> = {
  active: 'badge badge--success',
  hidden: 'badge badge--warning',
  deleted: 'badge badge--neutral',
}

/** Libellés du statut d'ouverture dérivé (openStatus.state). */
export const PAGE_OPEN_STATE_LABELS: Record<PageOpenStatus['state'], string> = {
  open: 'Ouvert',
  closed: 'Fermé',
  vacation: 'En congés',
}

/** Vert (ouvert), gris (fermé), orange (en congés). */
const PAGE_OPEN_STATE_BADGE_CLASSES: Record<PageOpenStatus['state'], string> = {
  open: 'badge badge--success',
  closed: 'badge badge--neutral',
  vacation: 'badge badge--warning',
}

/** Position temporelle d'un événement de page. */
export const PAGE_EVENT_TIMING_LABELS: Record<PageEventTiming, string> = {
  upcoming: 'À venir',
  ongoing: 'En cours',
  past: 'Passé',
}

/**
 * Formate la valeur d'une annonce pour l'affichage : montant unique ('fixed')
 * ou fourchette ('range', valueMin–valueMax). La devise suit le montant.
 */
export function formatListingValue(
  valueKind: ListingValueKind,
  valueMin: number,
  valueMax: number | null,
  currency: string,
): string {
  const money = (amount: number) =>
    `${amount.toLocaleString('fr-FR')} ${currency}`
  if (valueKind === 'range' && valueMax !== null) {
    return `${money(valueMin)} – ${money(valueMax)}`
  }
  return money(valueMin)
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

/** Badge de catégorie de caméra (Météo / Trafic). */
export function CameraCategoryBadge({ category }: { category: CameraCategory }) {
  return (
    <span className="badge badge--info">{CAMERA_CATEGORY_LABELS[category]}</span>
  )
}

/** Badge de statut de caméra (Active / Inactive / En erreur / Masquée). */
export function CameraStatusBadge({ status }: { status: CameraStatus }) {
  return (
    <span className={CAMERA_STATUS_BADGE_CLASSES[status]}>
      {CAMERA_STATUS_LABELS[status]}
    </span>
  )
}

/** Badge de famille d'annonce (Bien / Service). */
export function ListingFamilyBadge({ family }: { family: ListingFamily }) {
  return (
    <span className="badge badge--info">{LISTING_FAMILY_LABELS[family]}</span>
  )
}

/** Badge de statut d'annonce (Active / Masquée / Supprimée). */
export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span className={LISTING_STATUS_BADGE_CLASSES[status]}>
      {LISTING_STATUS_LABELS[status]}
    </span>
  )
}

/** Badge de statut de deal (Proposé / Actif / Conclu / Refusé / Annulé /
 * Litige) — CP2.5. */
export function DealStatusBadge({ status }: { status: DealStatus }) {
  return (
    <span className={DEAL_STATUS_BADGE_CLASSES[status]}>
      {DEAL_STATUS_LABELS[status]}
    </span>
  )
}

/** Badge de type de page (Restaurant / Entreprise) — Lot 3. */
export function PageTypeBadge({ pageType }: { pageType: PageType }) {
  return <span className="badge badge--info">{PAGE_TYPE_LABELS[pageType]}</span>
}

/** Badge de statut de page (Active / Masquée / Supprimée) — Lot 3. */
export function PageStatusBadge({ status }: { status: PageStatus }) {
  return (
    <span className={PAGE_STATUS_BADGE_CLASSES[status]}>
      {PAGE_STATUS_LABELS[status]}
    </span>
  )
}

/** Badge du statut d'ouverture dérivé (Ouvert / Fermé / En congés) — Lot 3. */
export function PageOpenStateBadge({ state }: { state: PageOpenStatus['state'] }) {
  return (
    <span className={PAGE_OPEN_STATE_BADGE_CLASSES[state]}>
      {PAGE_OPEN_STATE_LABELS[state]}
    </span>
  )
}

/** Coche bleue « page vérifiée » (✓ du mockup) — Lot 3. */
export function VerifiedBadge() {
  return (
    <span
      className="verified-badge"
      role="img"
      aria-label="Page vérifiée"
      title="Page vérifiée"
    >
      ✓
    </span>
  )
}

/** Badge de niveau de modération (Standard / Sensible / Interdit). */
export function ModerationLevelBadge({ level }: { level: ModerationLevel }) {
  return (
    <span className={MODERATION_LEVEL_BADGE_CLASSES[level]}>
      {MODERATION_LEVEL_LABELS[level]}
    </span>
  )
}

/** Badge d'activation (Actif / Inactif) pour la taxonomie. */
export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="badge badge--success">Actif</span>
  ) : (
    <span className="badge badge--neutral">Inactif</span>
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

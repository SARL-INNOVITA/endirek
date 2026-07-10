/**
 * Sous-vue « Taxonomie » de l'onglet Dealplace (CP2.1) — gestion des
 * catégories (+ sous-catégories) et des tags de l'annuaire Dealplace.
 *
 * Alimentée par les endpoints backoffice (actifs ET inactifs) :
 * - GET/POST/PATCH /admin/dealplace/categories
 * - GET/POST/PATCH /admin/dealplace/subcategories?category=<slug>
 * - GET/POST/PATCH /admin/dealplace/tags
 *
 * Champs éditables : label, position, moderationLevel (catégories),
 * isActive. Le SLUG est immuable après création ; la FAMILY d'une catégorie
 * et la catégorie parente d'une sous-catégorie sont figées (imposé par l'API).
 *
 * Ergonomie sobre : une carte « Catégories » (liste dépliable → sous-
 * catégories) et une carte « Tags », chacune avec formulaires inline de
 * création / édition. Toute écriture recharge la liste concernée.
 */

import { useEffect, useState } from 'react'
import {
  adminCreateListingCategory,
  adminCreateListingSubcategory,
  adminCreateListingTag,
  adminListListingCategories,
  adminListListingSubcategories,
  adminListListingTags,
  adminUpdateListingCategory,
  adminUpdateListingSubcategory,
  adminUpdateListingTag,
  toErrorMessage,
} from './api'
import type {
  AdminListingCategory,
  AdminListingSubcategory,
  AdminListingTag,
  ListingFamily,
  ModerationLevel,
} from './api'
import {
  ActiveBadge,
  LISTING_FAMILY_LABELS,
  ModerationLevelBadge,
} from './ui'

const MODERATION_LEVELS: ModerationLevel[] = [
  'standard',
  'sensitive',
  'forbidden',
]

/** Contrainte de slug côté API (kebab-case) reflétée dans l'aide de saisie. */
const SLUG_HINT = 'Minuscules, chiffres et tirets (ex. « velos-electriques »). Immuable ensuite.'

export default function TaxonomyView() {
  return (
    <div className="taxonomy-stack">
      <CategoriesCard />
      <TagsCard />
    </div>
  )
}

// ─── Catégories ──────────────────────────────────────────────────────────────

type CategoriesState =
  | { kind: 'loading' }
  | { kind: 'success'; categories: AdminListingCategory[] }
  | { kind: 'error'; message: string }

function CategoriesCard() {
  const [state, setState] = useState<CategoriesState>({ kind: 'loading' })
  const [refreshCount, setRefreshCount] = useState(0)
  /** Slug de la catégorie en cours d'édition (null = aucune). */
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  /** Vrai si le formulaire de création de catégorie est ouvert. */
  const [creating, setCreating] = useState(false)
  /** Slug de la catégorie dont les sous-catégories sont dépliées. */
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    adminListListingCategories(controller.signal)
      .then((categories) => setState({ kind: 'success', categories }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: toErrorMessage(caught) })
      })
    return () => controller.abort()
  }, [refreshCount])

  function reload() {
    setRefreshCount((count) => count + 1)
  }

  return (
    <section className="card" aria-labelledby="taxonomy-categories-title">
      <div className="card-header">
        <h2 id="taxonomy-categories-title" className="card-title">
          Catégories
        </h2>
        <div className="card-header-actions">
          {state.kind === 'success' && (
            <span className="badge badge--neutral">
              {state.categories.length} catégorie
              {state.categories.length > 1 ? 's' : ''}
            </span>
          )}
          <button
            type="button"
            className="button-primary button-compact"
            onClick={() => {
              setCreating(true)
              setEditingSlug(null)
            }}
          >
            + Nouvelle catégorie
          </button>
        </div>
      </div>

      {creating && (
        <CategoryForm
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            reload()
          }}
        />
      )}

      {state.kind === 'loading' && <p className="muted">Chargement…</p>}

      {state.kind === 'error' && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      {state.kind === 'success' && state.categories.length === 0 && !creating && (
        <p className="muted">Aucune catégorie pour l'instant.</p>
      )}

      {state.kind === 'success' && state.categories.length > 0 && (
        <ul className="taxonomy-list">
          {state.categories.map((category) => (
            <li key={category.slug} className="taxonomy-item">
              {editingSlug === category.slug ? (
                <CategoryForm
                  category={category}
                  onCancel={() => setEditingSlug(null)}
                  onSaved={() => {
                    setEditingSlug(null)
                    reload()
                  }}
                />
              ) : (
                <>
                  <div className="taxonomy-row">
                    <div className="taxonomy-main">
                      <span className="taxonomy-label">{category.labelFr}</span>
                      <code className="taxonomy-slug">{category.slug}</code>
                    </div>
                    <div className="taxonomy-badges">
                      <span className="badge badge--info">
                        {LISTING_FAMILY_LABELS[category.family]}
                      </span>
                      <ModerationLevelBadge level={category.moderationLevel} />
                      <ActiveBadge isActive={category.isActive} />
                      <span className="taxonomy-position">
                        pos. {category.position}
                      </span>
                    </div>
                    <div className="taxonomy-actions">
                      <button
                        type="button"
                        className="button-ghost"
                        onClick={() =>
                          setExpandedSlug((current) =>
                            current === category.slug ? null : category.slug,
                          )
                        }
                        aria-expanded={expandedSlug === category.slug}
                      >
                        {expandedSlug === category.slug
                          ? 'Masquer les sous-catégories'
                          : 'Sous-catégories'}
                      </button>
                      <button
                        type="button"
                        className="button-ghost"
                        onClick={() => {
                          setEditingSlug(category.slug)
                          setCreating(false)
                        }}
                      >
                        Modifier
                      </button>
                    </div>
                  </div>

                  {expandedSlug === category.slug && (
                    <SubcategoriesPanel categorySlug={category.slug} />
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface CategoryFormProps {
  /** Catégorie à éditer, ou undefined pour une création. */
  category?: AdminListingCategory
  onCancel: () => void
  onSaved: () => void
}

function CategoryForm({ category, onCancel, onSaved }: CategoryFormProps) {
  const editing = category !== undefined
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [family, setFamily] = useState<ListingFamily>(category?.family ?? 'good')
  const [labelFr, setLabelFr] = useState(category?.labelFr ?? '')
  const [position, setPosition] = useState(String(category?.position ?? 0))
  const [moderationLevel, setModerationLevel] = useState<ModerationLevel>(
    category?.moderationLevel ?? 'standard',
  )
  const [isActive, setIsActive] = useState(category?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        await adminUpdateListingCategory(category.slug, {
          labelFr: labelFr.trim(),
          position: Number(position),
          moderationLevel,
          isActive,
        })
      } else {
        await adminCreateListingCategory({
          slug: slug.trim(),
          family,
          labelFr: labelFr.trim(),
          position: Number(position),
          moderationLevel,
          isActive,
        })
      }
      onSaved()
    } catch (caught) {
      setError(toErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="taxonomy-form" onSubmit={handleSubmit}>
      <div className="taxonomy-form-grid">
        <div className="form-field">
          <label htmlFor="cat-slug">Slug</label>
          {editing ? (
            <code className="taxonomy-slug taxonomy-slug--locked">
              {category.slug}
            </code>
          ) : (
            <>
              <input
                id="cat-slug"
                className="form-input"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="velos-electriques"
                required
              />
              <span className="form-hint">{SLUG_HINT}</span>
            </>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="cat-family">Famille</label>
          {editing ? (
            <span className="detail-locked muted">
              {LISTING_FAMILY_LABELS[category.family]} (immuable)
            </span>
          ) : (
            <select
              id="cat-family"
              className="form-input"
              value={family}
              onChange={(e) => setFamily(e.target.value as ListingFamily)}
            >
              <option value="good">Bien</option>
              <option value="service">Service</option>
            </select>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="cat-label">Libellé (fr)</label>
          <input
            id="cat-label"
            className="form-input"
            value={labelFr}
            onChange={(e) => setLabelFr(e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="cat-position">Position</label>
          <input
            id="cat-position"
            type="number"
            min={0}
            max={1000}
            className="form-input"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="cat-moderation">Niveau de modération</label>
          <select
            id="cat-moderation"
            className="form-input"
            value={moderationLevel}
            onChange={(e) =>
              setModerationLevel(e.target.value as ModerationLevel)
            }
          >
            {MODERATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level === 'standard'
                  ? 'Standard'
                  : level === 'sensitive'
                    ? 'Sensible'
                    : 'Interdit'}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="settings-check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Catégorie active
          </label>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="camera-form-actions">
        <button type="submit" className="button-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer'}
        </button>
        <button
          type="button"
          className="button-ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

// ─── Sous-catégories (panneau déplié sous une catégorie) ─────────────────────

type SubcatState =
  | { kind: 'loading' }
  | { kind: 'success'; subcategories: AdminListingSubcategory[] }
  | { kind: 'error'; message: string }

function SubcategoriesPanel({ categorySlug }: { categorySlug: string }) {
  const [state, setState] = useState<SubcatState>({ kind: 'loading' })
  const [refreshCount, setRefreshCount] = useState(0)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    adminListListingSubcategories(categorySlug, controller.signal)
      .then((subcategories) => setState({ kind: 'success', subcategories }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: toErrorMessage(caught) })
      })
    return () => controller.abort()
  }, [categorySlug, refreshCount])

  function reload() {
    setRefreshCount((count) => count + 1)
  }

  return (
    <div className="taxonomy-subpanel">
      <div className="taxonomy-subpanel-head">
        <h4 className="detail-section-title">Sous-catégories</h4>
        <button
          type="button"
          className="button-ghost"
          onClick={() => {
            setCreating(true)
            setEditingSlug(null)
          }}
        >
          + Ajouter
        </button>
      </div>

      {creating && (
        <SubcategoryForm
          categorySlug={categorySlug}
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            reload()
          }}
        />
      )}

      {state.kind === 'loading' && <p className="muted">Chargement…</p>}

      {state.kind === 'error' && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      {state.kind === 'success' &&
        state.subcategories.length === 0 &&
        !creating && <p className="muted">Aucune sous-catégorie.</p>}

      {state.kind === 'success' && state.subcategories.length > 0 && (
        <ul className="taxonomy-sublist">
          {state.subcategories.map((sub) => (
            <li key={sub.slug} className="taxonomy-subitem">
              {editingSlug === sub.slug ? (
                <SubcategoryForm
                  categorySlug={categorySlug}
                  subcategory={sub}
                  onCancel={() => setEditingSlug(null)}
                  onSaved={() => {
                    setEditingSlug(null)
                    reload()
                  }}
                />
              ) : (
                <div className="taxonomy-row">
                  <div className="taxonomy-main">
                    <span className="taxonomy-label">{sub.labelFr}</span>
                    <code className="taxonomy-slug">{sub.slug}</code>
                  </div>
                  <div className="taxonomy-badges">
                    <ActiveBadge isActive={sub.isActive} />
                    <span className="taxonomy-position">pos. {sub.position}</span>
                  </div>
                  <div className="taxonomy-actions">
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => {
                        setEditingSlug(sub.slug)
                        setCreating(false)
                      }}
                    >
                      Modifier
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface SubcategoryFormProps {
  categorySlug: string
  subcategory?: AdminListingSubcategory
  onCancel: () => void
  onSaved: () => void
}

function SubcategoryForm({
  categorySlug,
  subcategory,
  onCancel,
  onSaved,
}: SubcategoryFormProps) {
  const editing = subcategory !== undefined
  const [slug, setSlug] = useState(subcategory?.slug ?? '')
  const [labelFr, setLabelFr] = useState(subcategory?.labelFr ?? '')
  const [position, setPosition] = useState(String(subcategory?.position ?? 0))
  const [isActive, setIsActive] = useState(subcategory?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        await adminUpdateListingSubcategory(subcategory.slug, {
          labelFr: labelFr.trim(),
          position: Number(position),
          isActive,
        })
      } else {
        await adminCreateListingSubcategory({
          slug: slug.trim(),
          categorySlug,
          labelFr: labelFr.trim(),
          position: Number(position),
          isActive,
        })
      }
      onSaved()
    } catch (caught) {
      setError(toErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="taxonomy-form" onSubmit={handleSubmit}>
      <div className="taxonomy-form-grid">
        <div className="form-field">
          <label htmlFor="sub-slug">Slug</label>
          {editing ? (
            <code className="taxonomy-slug taxonomy-slug--locked">
              {subcategory.slug}
            </code>
          ) : (
            <>
              <input
                id="sub-slug"
                className="form-input"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="vtt"
                required
              />
              <span className="form-hint">{SLUG_HINT}</span>
            </>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="sub-label">Libellé (fr)</label>
          <input
            id="sub-label"
            className="form-input"
            value={labelFr}
            onChange={(e) => setLabelFr(e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="sub-position">Position</label>
          <input
            id="sub-position"
            type="number"
            min={0}
            max={1000}
            className="form-input"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label className="settings-check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Sous-catégorie active
          </label>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="camera-form-actions">
        <button type="submit" className="button-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer'}
        </button>
        <button
          type="button"
          className="button-ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

// ─── Tags ────────────────────────────────────────────────────────────────────

type TagsState =
  | { kind: 'loading' }
  | { kind: 'success'; tags: AdminListingTag[] }
  | { kind: 'error'; message: string }

function TagsCard() {
  const [state, setState] = useState<TagsState>({ kind: 'loading' })
  const [refreshCount, setRefreshCount] = useState(0)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    adminListListingTags(controller.signal)
      .then((tags) => setState({ kind: 'success', tags }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: toErrorMessage(caught) })
      })
    return () => controller.abort()
  }, [refreshCount])

  function reload() {
    setRefreshCount((count) => count + 1)
  }

  return (
    <section className="card" aria-labelledby="taxonomy-tags-title">
      <div className="card-header">
        <h2 id="taxonomy-tags-title" className="card-title">
          Tags
        </h2>
        <div className="card-header-actions">
          {state.kind === 'success' && (
            <span className="badge badge--neutral">
              {state.tags.length} tag{state.tags.length > 1 ? 's' : ''}
            </span>
          )}
          <button
            type="button"
            className="button-primary button-compact"
            onClick={() => {
              setCreating(true)
              setEditingSlug(null)
            }}
          >
            + Nouveau tag
          </button>
        </div>
      </div>

      {creating && (
        <TagForm
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            reload()
          }}
        />
      )}

      {state.kind === 'loading' && <p className="muted">Chargement…</p>}

      {state.kind === 'error' && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      {state.kind === 'success' && state.tags.length === 0 && !creating && (
        <p className="muted">Aucun tag pour l'instant.</p>
      )}

      {state.kind === 'success' && state.tags.length > 0 && (
        <ul className="taxonomy-list">
          {state.tags.map((tag) => (
            <li key={tag.slug} className="taxonomy-item">
              {editingSlug === tag.slug ? (
                <TagForm
                  tag={tag}
                  onCancel={() => setEditingSlug(null)}
                  onSaved={() => {
                    setEditingSlug(null)
                    reload()
                  }}
                />
              ) : (
                <div className="taxonomy-row">
                  <div className="taxonomy-main">
                    <span className="taxonomy-label">{tag.labelFr}</span>
                    <code className="taxonomy-slug">{tag.slug}</code>
                  </div>
                  <div className="taxonomy-badges">
                    <ActiveBadge isActive={tag.isActive} />
                  </div>
                  <div className="taxonomy-actions">
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => {
                        setEditingSlug(tag.slug)
                        setCreating(false)
                      }}
                    >
                      Modifier
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface TagFormProps {
  tag?: AdminListingTag
  onCancel: () => void
  onSaved: () => void
}

function TagForm({ tag, onCancel, onSaved }: TagFormProps) {
  const editing = tag !== undefined
  const [slug, setSlug] = useState(tag?.slug ?? '')
  const [labelFr, setLabelFr] = useState(tag?.labelFr ?? '')
  const [isActive, setIsActive] = useState(tag?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        await adminUpdateListingTag(tag.slug, {
          labelFr: labelFr.trim(),
          isActive,
        })
      } else {
        await adminCreateListingTag({
          slug: slug.trim(),
          labelFr: labelFr.trim(),
          isActive,
        })
      }
      onSaved()
    } catch (caught) {
      setError(toErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="taxonomy-form" onSubmit={handleSubmit}>
      <div className="taxonomy-form-grid">
        <div className="form-field">
          <label htmlFor="tag-slug">Slug</label>
          {editing ? (
            <code className="taxonomy-slug taxonomy-slug--locked">
              {tag.slug}
            </code>
          ) : (
            <>
              <input
                id="tag-slug"
                className="form-input"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="urgent"
                required
              />
              <span className="form-hint">{SLUG_HINT}</span>
            </>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="tag-label">Libellé (fr)</label>
          <input
            id="tag-label"
            className="form-input"
            value={labelFr}
            onChange={(e) => setLabelFr(e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label className="settings-check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Tag actif
          </label>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="camera-form-actions">
        <button type="submit" className="button-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer'}
        </button>
        <button
          type="button"
          className="button-ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

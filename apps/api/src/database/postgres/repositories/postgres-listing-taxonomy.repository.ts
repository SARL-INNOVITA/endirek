/**
 * PostgresListingTaxonomyRepository — implémentation SQL de
 * ListingTaxonomyRepository.
 *
 * Parité STRICTE avec MockListingTaxonomyRepository (mock/mock-repositories.ts) :
 * mêmes tris, mêmes filtres `activeOnly`, mêmes messages d'erreur (catégorie /
 * sous-catégorie / tag déjà existant ou introuvable, FK catégorie inconnue) et
 * mêmes valeurs par défaut à la création (moderationLevel 'standard', isActive
 * true).
 *
 * La taxonomie de RÉFÉRENCE (familles/catégories/sous-catégories/tags MVP) vient
 * des tables peuplées par la migration 0004_dealplace_reference.sql, jamais du
 * code : ce repository ne fait que lire/écrire ces tables.
 *
 * Tris (miroir du mock) :
 *   - catégories / sous-catégories : position ASC, tie-break slug ASC ;
 *   - tags : slug ASC.
 * updated_at est géré par les triggers *_set_updated_at (comme db.touch() côté
 * mock).
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import {
  ListingCategory,
  ListingSubcategory,
  ListingTag,
} from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  CreateListingCategoryInput,
  CreateListingSubcategoryInput,
  CreateListingTagInput,
  ListingTaxonomyRepository,
  UpdateListingCategoryPatch,
  UpdateListingSubcategoryPatch,
  UpdateListingTagPatch,
} from '../../repositories/interfaces';
import {
  query,
  rowToListingCategory,
  rowToListingSubcategory,
  rowToListingTag,
} from '../pg-helpers';

/** Colonnes de listing_categories (ordre = mapper). */
const CATEGORY_COLUMNS = `
  slug, family, label_fr, position, moderation_level, is_active,
  created_at, updated_at
`.trim();

/** Colonnes de listing_subcategories. */
const SUBCATEGORY_COLUMNS = `
  slug, category_slug, label_fr, position, is_active, created_at, updated_at
`.trim();

/** Colonnes de listing_tags. */
const TAG_COLUMNS = `slug, label_fr, is_active, created_at, updated_at`;

@Injectable()
export class PostgresListingTaxonomyRepository
  implements ListingTaxonomyRepository
{
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async listCategories(activeOnly: boolean): Promise<ListingCategory[]> {
    // Tri position ASC, tie-break slug ASC (mock : byPositionThenSlug).
    // activeOnly : WHERE is_active. Le filtre est exprimé avec un paramètre
    // booléen pour rester paramétré (pas de concaténation).
    const { rows } = await query(
      this.pool,
      `SELECT ${CATEGORY_COLUMNS}
         FROM listing_categories
        WHERE ($1 = false OR is_active = true)
        ORDER BY position ASC, slug ASC`,
      [activeOnly],
    );
    return rows.map(rowToListingCategory);
  }

  async listSubcategories(
    categorySlug: string,
    activeOnly: boolean,
  ): Promise<ListingSubcategory[]> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SUBCATEGORY_COLUMNS}
         FROM listing_subcategories
        WHERE category_slug = $1
          AND ($2 = false OR is_active = true)
        ORDER BY position ASC, slug ASC`,
      [categorySlug, activeOnly],
    );
    return rows.map(rowToListingSubcategory);
  }

  async listTags(activeOnly: boolean): Promise<ListingTag[]> {
    // Tags triés par slug ASC (mock : localeCompare sur slug).
    const { rows } = await query(
      this.pool,
      `SELECT ${TAG_COLUMNS}
         FROM listing_tags
        WHERE ($1 = false OR is_active = true)
        ORDER BY slug ASC`,
      [activeOnly],
    );
    return rows.map(rowToListingTag);
  }

  async findCategory(slug: string): Promise<ListingCategory | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${CATEGORY_COLUMNS} FROM listing_categories WHERE slug = $1`,
      [slug],
    );
    return rows.length > 0 ? rowToListingCategory(rows[0]) : null;
  }

  async findSubcategory(slug: string): Promise<ListingSubcategory | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SUBCATEGORY_COLUMNS} FROM listing_subcategories WHERE slug = $1`,
      [slug],
    );
    return rows.length > 0 ? rowToListingSubcategory(rows[0]) : null;
  }

  async findTag(slug: string): Promise<ListingTag | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${TAG_COLUMNS} FROM listing_tags WHERE slug = $1`,
      [slug],
    );
    return rows.length > 0 ? rowToListingTag(rows[0]) : null;
  }

  // ── Backoffice : gestion du vocabulaire ───────────────────────────────────

  async createCategory(
    input: CreateListingCategoryInput,
  ): Promise<ListingCategory> {
    // Doublon de PK vérifié explicitement pour produire le MÊME message que le
    // mock (plutôt que l'erreur SQL 23505 brute).
    if (await this.findCategory(input.slug)) {
      throw new Error(
        `Catégorie déjà existante : « ${input.slug} » (PK slug).`,
      );
    }
    const { rows } = await query(
      this.pool,
      `INSERT INTO listing_categories
         (slug, family, label_fr, position, moderation_level, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CATEGORY_COLUMNS}`,
      [
        input.slug,
        input.family,
        input.labelFr,
        input.position,
        input.moderationLevel ?? 'standard',
        input.isActive ?? true,
      ],
    );
    return rowToListingCategory(rows[0]);
  }

  async updateCategory(
    slug: string,
    patch: UpdateListingCategoryPatch,
  ): Promise<ListingCategory> {
    // applyPatch : seules les clés FOURNIES entrent dans le SET (colonne absente
    // = inchangée). updated_at via trigger listing_categories_set_updated_at.
    const sets: string[] = [];
    const params: unknown[] = [];
    let n = 1;
    if (patch.labelFr !== undefined) {
      sets.push(`label_fr = $${n++}`);
      params.push(patch.labelFr);
    }
    if (patch.position !== undefined) {
      sets.push(`position = $${n++}`);
      params.push(patch.position);
    }
    if (patch.moderationLevel !== undefined) {
      sets.push(`moderation_level = $${n++}`);
      params.push(patch.moderationLevel);
    }
    if (patch.isActive !== undefined) {
      sets.push(`is_active = $${n++}`);
      params.push(patch.isActive);
    }

    if (sets.length > 0) {
      params.push(slug);
      const { rowCount } = await query(
        this.pool,
        `UPDATE listing_categories SET ${sets.join(', ')} WHERE slug = $${n}`,
        params,
      );
      if (rowCount === 0) {
        throw new Error(`Catégorie introuvable : « ${slug} ».`);
      }
    } else {
      // Patch vide : on vérifie tout de même l'existence (mock lève si absente).
      const existing = await this.findCategory(slug);
      if (!existing) {
        throw new Error(`Catégorie introuvable : « ${slug} ».`);
      }
      return existing;
    }
    // Relecture (la catégorie existe forcément après un UPDATE ayant matché).
    return (await this.findCategory(slug)) as ListingCategory;
  }

  async createSubcategory(
    input: CreateListingSubcategoryInput,
  ): Promise<ListingSubcategory> {
    if (await this.findSubcategory(input.slug)) {
      throw new Error(
        `Sous-catégorie déjà existante : « ${input.slug} » (PK slug).`,
      );
    }
    // FK catégorie vérifiée explicitement (même message que le mock).
    if (!(await this.findCategory(input.categorySlug))) {
      throw new Error(
        `Catégorie inconnue : « ${input.categorySlug} » (FK listing_categories).`,
      );
    }
    const { rows } = await query(
      this.pool,
      `INSERT INTO listing_subcategories
         (slug, category_slug, label_fr, position, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SUBCATEGORY_COLUMNS}`,
      [
        input.slug,
        input.categorySlug,
        input.labelFr,
        input.position,
        input.isActive ?? true,
      ],
    );
    return rowToListingSubcategory(rows[0]);
  }

  async updateSubcategory(
    slug: string,
    patch: UpdateListingSubcategoryPatch,
  ): Promise<ListingSubcategory> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let n = 1;
    if (patch.labelFr !== undefined) {
      sets.push(`label_fr = $${n++}`);
      params.push(patch.labelFr);
    }
    if (patch.position !== undefined) {
      sets.push(`position = $${n++}`);
      params.push(patch.position);
    }
    if (patch.isActive !== undefined) {
      sets.push(`is_active = $${n++}`);
      params.push(patch.isActive);
    }

    if (sets.length > 0) {
      params.push(slug);
      const { rowCount } = await query(
        this.pool,
        `UPDATE listing_subcategories SET ${sets.join(', ')} WHERE slug = $${n}`,
        params,
      );
      if (rowCount === 0) {
        throw new Error(`Sous-catégorie introuvable : « ${slug} ».`);
      }
    } else {
      const existing = await this.findSubcategory(slug);
      if (!existing) {
        throw new Error(`Sous-catégorie introuvable : « ${slug} ».`);
      }
      return existing;
    }
    return (await this.findSubcategory(slug)) as ListingSubcategory;
  }

  async createTag(input: CreateListingTagInput): Promise<ListingTag> {
    if (await this.findTag(input.slug)) {
      throw new Error(`Tag déjà existant : « ${input.slug} » (PK slug).`);
    }
    const { rows } = await query(
      this.pool,
      `INSERT INTO listing_tags (slug, label_fr, is_active)
       VALUES ($1, $2, $3)
       RETURNING ${TAG_COLUMNS}`,
      [input.slug, input.labelFr, input.isActive ?? true],
    );
    return rowToListingTag(rows[0]);
  }

  async updateTag(
    slug: string,
    patch: UpdateListingTagPatch,
  ): Promise<ListingTag> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let n = 1;
    if (patch.labelFr !== undefined) {
      sets.push(`label_fr = $${n++}`);
      params.push(patch.labelFr);
    }
    if (patch.isActive !== undefined) {
      sets.push(`is_active = $${n++}`);
      params.push(patch.isActive);
    }

    if (sets.length > 0) {
      params.push(slug);
      const { rowCount } = await query(
        this.pool,
        `UPDATE listing_tags SET ${sets.join(', ')} WHERE slug = $${n}`,
        params,
      );
      if (rowCount === 0) {
        throw new Error(`Tag introuvable : « ${slug} ».`);
      }
    } else {
      const existing = await this.findTag(slug);
      if (!existing) {
        throw new Error(`Tag introuvable : « ${slug} ».`);
      }
      return existing;
    }
    return (await this.findTag(slug)) as ListingTag;
  }
}

/**
 * PostgresPostTypesRepository — implémentation SQL de PostTypesRepository.
 * Lit/écrit la table de référence post_types (peuplée par la migration 0002).
 * Comportement OBSERVABLE identique au driver mock (MockPostTypesRepository) :
 *
 *   - listAll   : tous les types, tri position ASC puis slug ASC (tie-break) ;
 *   - listActive: types actifs, tri position ASC ;
 *   - findBySlug: un type ou null ;
 *   - update    : applyPatch (clés undefined ignorées) ; slug NON modifiable
 *                 (absent du patch type, jamais écrit).
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PostType } from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  PostTypesRepository,
  UpdatePostTypePatch,
} from '../../repositories/interfaces';
import { query, rowToPostType } from '../pg-helpers';

/** Colonnes de `post_types` (aucune géométrie). */
const SQL_POST_TYPE_COLUMNS = `
  slug, label_fr, icon, color, requires_location_for_map, shows_on_map,
  default_map_duration_minutes, is_active, position, created_at, updated_at
`.trim();

/** Correspondance clé de patch (camelCase) → colonne SQL (snake_case). Le slug
 * n'y figure pas : il n'est jamais modifiable (miroir du mock). */
const POST_TYPE_PATCH_COLUMNS: Record<keyof UpdatePostTypePatch, string> = {
  labelFr: 'label_fr',
  icon: 'icon',
  color: 'color',
  requiresLocationForMap: 'requires_location_for_map',
  showsOnMap: 'shows_on_map',
  defaultMapDurationMinutes: 'default_map_duration_minutes',
  isActive: 'is_active',
  position: 'position',
};

@Injectable()
export class PostgresPostTypesRepository implements PostTypesRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async listAll(): Promise<PostType[]> {
    // Tri position ASC, tie-break slug ASC (miroir du mock).
    const res = await query(
      this.pool,
      `SELECT ${SQL_POST_TYPE_COLUMNS} FROM post_types
        ORDER BY position ASC, slug ASC`,
    );
    return res.rows.map(rowToPostType);
  }

  async listActive(): Promise<PostType[]> {
    // Types actifs, tri position ASC (le mock ne trie que sur position ici).
    const res = await query(
      this.pool,
      `SELECT ${SQL_POST_TYPE_COLUMNS} FROM post_types
        WHERE is_active = true
        ORDER BY position ASC`,
    );
    return res.rows.map(rowToPostType);
  }

  async findBySlug(slug: string): Promise<PostType | null> {
    const res = await query(
      this.pool,
      `SELECT ${SQL_POST_TYPE_COLUMNS} FROM post_types WHERE slug = $1`,
      [slug],
    );
    return res.rows.length > 0 ? rowToPostType(res.rows[0]) : null;
  }

  async update(slug: string, patch: UpdatePostTypePatch): Promise<PostType> {
    // Existence d'abord (même message que le mock).
    const existing = await this.findBySlug(slug);
    if (!existing) {
      throw new Error(`Type de publication introuvable : « ${slug} ».`);
    }

    // applyPatch : clés undefined ignorées (colonne inchangée). null reste
    // légitime (ex. defaultMapDurationMinutes remis à NULL).
    const setClauses: string[] = [];
    const params: unknown[] = [];
    for (const [key, column] of Object.entries(
      POST_TYPE_PATCH_COLUMNS,
    ) as Array<[keyof UpdatePostTypePatch, string]>) {
      const value = patch[key];
      if (value === undefined) {
        continue;
      }
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    }

    if (setClauses.length > 0) {
      params.push(slug);
      // Le trigger post_types_set_updated_at maintient updated_at.
      await query(
        this.pool,
        `UPDATE post_types SET ${setClauses.join(', ')} WHERE slug = $${params.length}`,
        params,
      );
    }
    return (await this.findBySlug(slug))!;
  }
}

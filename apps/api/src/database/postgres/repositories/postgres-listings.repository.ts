/**
 * PostgresListingsRepository — implémentation SQL de ListingsRepository.
 *
 * Parité STRICTE avec MockListingsRepository (mock/mock-repositories.ts) :
 * mêmes contrôles structurels et messages d'erreur (FK owner / catégorie /
 * sous-catégorie / tags, UNIQUE url_slug, cohérence value_kind/value_max,
 * exchange_prefs non vide), mêmes tris (created_at DESC, tie-break id — ordre
 * STABLE), mêmes filtres publics/propriétaire/admin, même pagination
 * PagedResult, création ATOMIQUE (annonce + médias + tags dans une transaction),
 * lectures PAR LOT anti N+1.
 *
 * Les RÈGLES MÉTIER (photo obligatoire pour un bien, catégorie 'forbidden'
 * refusée, commune du référentiel, cohérence category/subcategory) vivent au
 * SERVICE (phase suivante) : ici on reproduit uniquement ce que garantit le
 * SCHÉMA, exactement comme le mock.
 *
 * Géométrie (voir CONVENTION dans pg-helpers.ts) : lecture via ST_Y/ST_X
 * (fragment SQL_LISTING_COLUMNS), écriture via
 * ST_SetSRID(ST_MakePoint(lng, lat), 4326).
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { Listing, ListingMedia, ListingStatus } from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  AdminListListingsParams,
  CreateListingInput,
  ListingsRepository,
  ListOwnerListingsParams,
  ListPublicListingsParams,
  PagedResult,
  UpdateListingPatch,
} from '../../repositories/interfaces';
import {
  query,
  rowToListing,
  rowToListingMedia,
  SQL_LISTING_COLUMNS,
  withTransaction,
} from '../pg-helpers';

@Injectable()
export class PostgresListingsRepository implements ListingsRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<Listing | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_LISTING_COLUMNS} FROM listings l WHERE l.id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToListing(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Listing[]> {
    // Chargement PAR LOT (cartes de conversations — CP2.3) : ids inconnus
    // ignorés, ordre non garanti (mock : WHERE id = ANY, mêmes règles).
    if (ids.length === 0) {
      return [];
    }
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_LISTING_COLUMNS} FROM listings l WHERE l.id = ANY($1)`,
      [[...new Set(ids)]],
    );
    return rows.map(rowToListing);
  }

  async findByUrlSlug(urlSlug: string): Promise<Listing | null> {
    // url_slug est UNIQUE : au plus une ligne.
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_LISTING_COLUMNS} FROM listings l WHERE l.url_slug = $1`,
      [urlSlug],
    );
    return rows.length > 0 ? rowToListing(rows[0]) : null;
  }

  async create(input: CreateListingInput): Promise<Listing> {
    // Contrôles structurels AVANT écriture, avec les MÊMES messages que le mock
    // (FK owner, FK catégorie, FK sous-catégorie, UNIQUE url_slug, cohérence
    // valeur, exchange_prefs, FK tags) — erreurs claires en français plutôt que
    // les codes SQL bruts (23503 / 23505).
    const owner = await query(this.pool, 'SELECT 1 FROM users WHERE id = $1', [
      input.ownerId,
    ]);
    if (owner.rowCount === 0) {
      throw new Error(`Propriétaire introuvable : ${input.ownerId}.`);
    }
    const category = await query(
      this.pool,
      'SELECT 1 FROM listing_categories WHERE slug = $1',
      [input.categorySlug],
    );
    if (category.rowCount === 0) {
      throw new Error(
        `Catégorie inconnue : « ${input.categorySlug} » (FK listing_categories).`,
      );
    }
    const subcategory = await query(
      this.pool,
      'SELECT 1 FROM listing_subcategories WHERE slug = $1',
      [input.subcategorySlug],
    );
    if (subcategory.rowCount === 0) {
      throw new Error(
        `Sous-catégorie inconnue : « ${input.subcategorySlug} » (FK listing_subcategories).`,
      );
    }
    if (await this.findByUrlSlug(input.urlSlug)) {
      throw new Error(
        `url_slug déjà utilisé : « ${input.urlSlug} » (contrainte UNIQUE).`,
      );
    }
    // Cohérence value_kind / value_max (miroir de listings_value_kind_max_ck).
    if (input.valueMin < 0) {
      throw new Error('value_min doit être >= 0.');
    }
    if (input.valueKind === 'fixed' && input.valueMax != null) {
      throw new Error("value_kind='fixed' interdit une value_max.");
    }
    if (input.valueKind === 'range') {
      if (input.valueMax == null) {
        throw new Error("value_kind='range' exige une value_max.");
      }
      if (input.valueMax < input.valueMin) {
        throw new Error('value_max doit être >= value_min (fourchette).');
      }
    }
    // exchange_prefs non vide (miroir de listings_exchange_prefs_nonempty_ck).
    if (input.exchangePrefs.length === 0) {
      throw new Error(
        'exchange_prefs doit être un sous-ensemble non vide (goods/services/money/open).',
      );
    }
    // Tags : chacun doit exister (FK listing_tags). Dédoublonnés (PK composite).
    const tagSlugs = [...new Set(input.tagSlugs ?? [])];
    for (const tagSlug of tagSlugs) {
      const tag = await query(
        this.pool,
        'SELECT 1 FROM listing_tags WHERE slug = $1',
        [tagSlug],
      );
      if (tag.rowCount === 0) {
        throw new Error(`Tag inconnu : « ${tagSlug} » (FK listing_tags).`);
      }
    }

    const location = input.location ?? null;
    const valueMax = input.valueKind === 'range' ? input.valueMax! : null;

    // Annonce + médias + tags créés ATOMIQUEMENT (équivalent transaction mock).
    return withTransaction(this.pool, async (client) => {
      // $1..$11 fixes, puis lng/lat conditionnels pour la géométrie.
      const insertParams: unknown[] = [
        input.ownerId,
        input.listingType,
        input.title,
        input.description,
        input.categorySlug,
        input.subcategorySlug,
        input.valueKind,
        input.valueMin,
        valueMax,
        input.currency ?? 'EUR',
        input.city,
      ];
      let locationSql: string;
      if (location === null) {
        locationSql = 'NULL';
      } else {
        insertParams.push(location.lng, location.lat);
        locationSql = `ST_SetSRID(ST_MakePoint($${insertParams.length - 1}, $${insertParams.length}), 4326)`;
      }
      // external_links jsonb + url_slug ajoutés APRÈS (positions dynamiques).
      insertParams.push(
        JSON.stringify(input.externalLinks ?? []),
        input.exchangePrefs,
        input.urlSlug,
      );
      const externalLinksPh = `$${insertParams.length - 2}`;
      const exchangePrefsPh = `$${insertParams.length - 1}`;
      const urlSlugPh = `$${insertParams.length}`;

      const inserted = await client.query(
        `INSERT INTO listings (
           owner_id, listing_type, title, description,
           category_slug, subcategory_slug,
           value_kind, value_min, value_max, currency, city,
           location, external_links, exchange_prefs, url_slug, status
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6,
           $7, $8, $9, $10, $11,
           ${locationSql}, ${externalLinksPh}::jsonb, ${exchangePrefsPh}, ${urlSlugPh}, 'active'
         )
         RETURNING id`,
        insertParams,
      );
      const listingId = inserted.rows[0].id as string;

      // Médias : position par défaut = index dans le tableau fourni (mock).
      const media = input.media ?? [];
      for (let index = 0; index < media.length; index++) {
        const spec = media[index];
        await client.query(
          `INSERT INTO listing_media (
             listing_id, media_type, url, thumbnail_url, width, height, position
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            listingId,
            spec.mediaType,
            spec.url,
            spec.thumbnailUrl ?? null,
            spec.width ?? null,
            spec.height ?? null,
            spec.position ?? index,
          ],
        );
      }

      // Tags : PK composite (listing_id, tag_slug), déjà dédoublonnés.
      for (const tagSlug of tagSlugs) {
        await client.query(
          `INSERT INTO listing_tag_map (listing_id, tag_slug) VALUES ($1, $2)`,
          [listingId, tagSlug],
        );
      }

      // Relecture dans la même transaction (lat/lng recalculés).
      return this.selectByIdInClient(client, listingId);
    });
  }

  async update(id: string, patch: UpdateListingPatch): Promise<Listing> {
    const existing = await this.findById(id);
    if (existing === null) {
      throw new Error(`Annonce introuvable : ${id}.`);
    }
    // Cohérence FK si la catégorie/sous-catégorie change (mêmes messages que
    // le mock).
    if (patch.categorySlug !== undefined) {
      const c = await query(
        this.pool,
        'SELECT 1 FROM listing_categories WHERE slug = $1',
        [patch.categorySlug],
      );
      if (c.rowCount === 0) {
        throw new Error(
          `Catégorie inconnue : « ${patch.categorySlug} » (FK listing_categories).`,
        );
      }
    }
    if (patch.subcategorySlug !== undefined) {
      const s = await query(
        this.pool,
        'SELECT 1 FROM listing_subcategories WHERE slug = $1',
        [patch.subcategorySlug],
      );
      if (s.rowCount === 0) {
        throw new Error(
          `Sous-catégorie inconnue : « ${patch.subcategorySlug} » (FK listing_subcategories).`,
        );
      }
    }

    // applyPatch : on calcule l'état APRÈS patch (colonnes non fournies =
    // inchangées, `null` légitime pour valueMax/location), on valide la
    // cohérence value_kind/value_max et exchange_prefs EXACTEMENT comme le mock,
    // puis on écrit en une seule UPDATE.
    const nextValueKind = patch.valueKind ?? existing.valueKind;
    const nextValueMin =
      patch.valueMin !== undefined ? patch.valueMin : existing.valueMin;
    // valueMax : patch fourni (nombre ou null) sinon valeur existante.
    let nextValueMax =
      patch.valueMax !== undefined ? patch.valueMax : existing.valueMax;
    const nextExchangePrefs =
      patch.exchangePrefs !== undefined
        ? patch.exchangePrefs
        : existing.exchangePrefs;

    if (nextValueKind === 'fixed') {
      // Fixed : la value_max est forcée à NULL (mock).
      nextValueMax = null;
    } else if (nextValueMax == null || nextValueMax < nextValueMin) {
      throw new Error(
        "value_kind='range' exige value_max >= value_min après mise à jour.",
      );
    }
    if (nextExchangePrefs.length === 0) {
      throw new Error('exchange_prefs doit rester non vide.');
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let n = 1;

    if (patch.title !== undefined) {
      sets.push(`title = $${n++}`);
      params.push(patch.title);
    }
    if (patch.description !== undefined) {
      sets.push(`description = $${n++}`);
      params.push(patch.description);
    }
    if (patch.categorySlug !== undefined) {
      sets.push(`category_slug = $${n++}`);
      params.push(patch.categorySlug);
    }
    if (patch.subcategorySlug !== undefined) {
      sets.push(`subcategory_slug = $${n++}`);
      params.push(patch.subcategorySlug);
    }
    if (patch.valueKind !== undefined) {
      sets.push(`value_kind = $${n++}`);
      params.push(patch.valueKind);
    }
    if (patch.valueMin !== undefined) {
      sets.push(`value_min = $${n++}`);
      params.push(patch.valueMin);
    }
    // value_max : on écrit la valeur DÉRIVÉE (forcée à NULL en 'fixed'). On ne
    // touche la colonne que si la valeur effective change par rapport à
    // l'existant, pour rester au plus près de la sémantique applyPatch du mock
    // (fixed => NULL même sans patch.valueMax explicite).
    if (nextValueMax !== existing.valueMax) {
      sets.push(`value_max = $${n++}`);
      params.push(nextValueMax);
    }
    if (patch.currency !== undefined) {
      sets.push(`currency = $${n++}`);
      params.push(patch.currency);
    }
    if (patch.city !== undefined) {
      sets.push(`city = $${n++}`);
      params.push(patch.city);
    }
    if (patch.exchangePrefs !== undefined) {
      sets.push(`exchange_prefs = $${n++}`);
      params.push(patch.exchangePrefs);
    }
    if (patch.externalLinks !== undefined) {
      sets.push(`external_links = $${n++}::jsonb`);
      params.push(JSON.stringify(patch.externalLinks));
    }
    if (patch.location !== undefined) {
      if (patch.location === null) {
        sets.push('location = NULL');
      } else {
        sets.push(
          `location = ST_SetSRID(ST_MakePoint($${n++}, $${n++}), 4326)`,
        );
        params.push(patch.location.lng, patch.location.lat);
      }
    }

    if (sets.length > 0) {
      // updated_at géré par le trigger listings_set_updated_at.
      params.push(id);
      await query(
        this.pool,
        `UPDATE listings SET ${sets.join(', ')} WHERE id = $${n}`,
        params,
      );
    }
    // Relecture (l'annonce existe forcément).
    return (await this.findById(id)) as Listing;
  }

  async setTags(id: string, tagSlugs: string[]): Promise<void> {
    // Remplacement intégral des tags (PATCH tags par le propriétaire) — parité
    // stricte avec le mock : l'annonce doit exister, chaque slug doit exister
    // (FK listing_tags, même message), opération ATOMIQUE (transaction).
    const existing = await query(
      this.pool,
      'SELECT 1 FROM listings WHERE id = $1',
      [id],
    );
    if (existing.rowCount === 0) {
      throw new Error(`Annonce introuvable : ${id}.`);
    }
    const unique = [...new Set(tagSlugs)];
    for (const tagSlug of unique) {
      const tag = await query(
        this.pool,
        'SELECT 1 FROM listing_tags WHERE slug = $1',
        [tagSlug],
      );
      if (tag.rowCount === 0) {
        throw new Error(`Tag inconnu : « ${tagSlug} » (FK listing_tags).`);
      }
    }
    await withTransaction(this.pool, async (client) => {
      await client.query('DELETE FROM listing_tag_map WHERE listing_id = $1', [
        id,
      ]);
      for (const tagSlug of unique) {
        await client.query(
          `INSERT INTO listing_tag_map (listing_id, tag_slug) VALUES ($1, $2)`,
          [id, tagSlug],
        );
      }
    });
  }

  async setStatus(id: string, status: ListingStatus): Promise<Listing> {
    // Soft-delete : deleted_at posé quand status = 'deleted', remis à NULL sinon
    // (miroir du mock). updated_at via trigger.
    const { rowCount } = await query(
      this.pool,
      `UPDATE listings
          SET status = $1,
              deleted_at = CASE WHEN $1 = 'deleted' THEN now() ELSE NULL END
        WHERE id = $2`,
      [status, id],
    );
    if (rowCount === 0) {
      throw new Error(`Annonce introuvable : ${id}.`);
    }
    return (await this.findById(id)) as Listing;
  }

  async listPublic(
    params: ListPublicListingsParams,
  ): Promise<PagedResult<Listing>> {
    // Annuaire public : annonces 'active' uniquement. Filtres facultatifs,
    // tri created_at DESC tie-break id (ordre STABLE).
    const conditions: string[] = [`l.status = 'active'`];
    const values: unknown[] = [];
    let n = 1;

    if (params.family !== undefined) {
      conditions.push(`l.listing_type = $${n++}`);
      values.push(params.family);
    }
    if (params.categorySlug !== undefined) {
      conditions.push(`l.category_slug = $${n++}`);
      values.push(params.categorySlug);
    }
    if (params.subcategorySlug !== undefined) {
      conditions.push(`l.subcategory_slug = $${n++}`);
      values.push(params.subcategorySlug);
    }
    if (params.city !== undefined) {
      // Égalité insensible à la casse (mock : city.toLowerCase() === needle
      // avec needle = params.city.trim().toLowerCase()).
      conditions.push(`lower(l.city) = lower($${n++})`);
      values.push(params.city.trim());
    }
    if (params.valueMin !== undefined) {
      // Borne basse : value_min >= plancher (mock).
      conditions.push(`l.value_min >= $${n++}`);
      values.push(params.valueMin);
    }
    if (params.valueMax !== undefined) {
      // Borne haute : valeur haute effective (value_max si fourchette, sinon
      // value_min) <= plafond (mock : (valueMax ?? valueMin) <= plafond).
      conditions.push(`COALESCE(l.value_max, l.value_min) <= $${n++}`);
      values.push(params.valueMax);
    }
    if (params.tagSlugs !== undefined && params.tagSlugs.length > 0) {
      // L'annonce doit porter TOUS les tags demandés (mock : every ∈ set).
      // Comptage des tags demandés effectivement présents = longueur demandée.
      conditions.push(
        `(SELECT count(DISTINCT tm.tag_slug) FROM listing_tag_map tm
            WHERE tm.listing_id = l.id AND tm.tag_slug = ANY($${n})) = $${n + 1}`,
      );
      values.push(params.tagSlugs, params.tagSlugs.length);
      n += 2;
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      // ILIKE %needle% sur titre / description (mock : includes en minuscules).
      const ph = `$${n++}`;
      conditions.push(`(l.title ILIKE ${ph} OR l.description ILIKE ${ph})`);
      values.push(`%${params.search.trim()}%`);
    }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;
    return this.pagedQuery(whereSql, values, n, params.limit, params.offset);
  }

  async listByOwner(
    ownerId: string,
    params: ListOwnerListingsParams,
  ): Promise<PagedResult<Listing>> {
    // Annonces d'un propriétaire, filtrées par statuts (absent = tous) et par
    // famille (sections Services / Biens du profil — CP2.2, miroir du mock),
    // antéchronologique tie-break id.
    const conditions: string[] = [`l.owner_id = $1`];
    const values: unknown[] = [ownerId];
    let n = 2;
    if (params.statuses !== undefined) {
      conditions.push(`l.status = ANY($${n++})`);
      values.push(params.statuses);
    }
    if (params.family !== undefined) {
      conditions.push(`l.listing_type = $${n++}`);
      values.push(params.family);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;
    return this.pagedQuery(whereSql, values, n, params.limit, params.offset);
  }

  async listAdmin(
    params: AdminListListingsParams,
  ): Promise<PagedResult<Listing>> {
    // Liste BACKOFFICE : tous statuts par défaut (y compris 'deleted' — audit).
    // JOIN listing_categories pour flaggedOnly (moderation_level) ; JOIN users
    // pour la recherche sur le nom du propriétaire. Tri created_at DESC / id.
    const conditions: string[] = [];
    const values: unknown[] = [];
    let n = 1;

    if (params.family !== undefined) {
      conditions.push(`l.listing_type = $${n++}`);
      values.push(params.family);
    }
    if (params.categorySlug !== undefined) {
      conditions.push(`l.category_slug = $${n++}`);
      values.push(params.categorySlug);
    }
    if (params.status !== undefined) {
      conditions.push(`l.status = $${n++}`);
      values.push(params.status);
    }
    if (params.flaggedOnly !== undefined) {
      // « Marquée » = catégorie de niveau sensitive/forbidden (mock : level
      // !== 'standard'). La catégorie existe toujours (FK) ; on lit son niveau
      // via cat.moderation_level (JOIN présent ci-dessous).
      if (params.flaggedOnly) {
        conditions.push(`cat.moderation_level <> 'standard'`);
      } else {
        conditions.push(`cat.moderation_level = 'standard'`);
      }
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      // ILIKE %needle% sur titre / description / nom du propriétaire.
      const ph = `$${n++}`;
      conditions.push(
        `(l.title ILIKE ${ph} OR l.description ILIKE ${ph} ` +
          `OR coalesce(owner.display_name, '') ILIKE ${ph})`,
      );
      values.push(`%${params.search.trim()}%`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    // JOIN systématiques (users pour la recherche, listing_categories pour le
    // flag). Les deux sont des FK NOT NULL : le JOIN ne perd aucune ligne.
    const joinSql = `
      JOIN users owner ON owner.id = l.owner_id
      JOIN listing_categories cat ON cat.slug = l.category_slug`;

    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n FROM listings l ${joinSql} ${whereSql}`,
      values,
    );

    const limitPh = `$${n++}`;
    const offsetPh = `$${n++}`;
    const pageParams = [...values, params.limit, params.offset];
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_LISTING_COLUMNS}
         FROM listings l ${joinSql}
        ${whereSql}
        ORDER BY l.created_at DESC, l.id
        LIMIT ${limitPh} OFFSET ${offsetPh}`,
      pageParams,
    );

    return {
      items: rows.map(rowToListing),
      total: Number(totalRes.rows[0].n),
    };
  }

  async listMediaByListingIds(listingIds: string[]): Promise<ListingMedia[]> {
    // Lecture PAR LOT (évite les N+1) — position ASC puis created_at ASC
    // (mock : position ASC, byCreatedAtAsc). Tableau vide : court-circuit.
    if (listingIds.length === 0) {
      return [];
    }
    const { rows } = await query(
      this.pool,
      `SELECT id, listing_id, media_type, url, thumbnail_url,
              width, height, position, created_at
         FROM listing_media
        WHERE listing_id = ANY($1)
        ORDER BY position ASC, created_at ASC`,
      [listingIds],
    );
    return rows.map(rowToListingMedia);
  }

  async listTagsByListingIds(
    listingIds: string[],
  ): Promise<Record<string, string[]>> {
    // Slugs de tags PAR LOT : { listingId → slugs[] } (slugs triés). Les
    // annonces sans tag sont ABSENTES du résultat (mock). Tableau vide :
    // court-circuit.
    if (listingIds.length === 0) {
      return {};
    }
    const { rows } = await query(
      this.pool,
      `SELECT listing_id, tag_slug
         FROM listing_tag_map
        WHERE listing_id = ANY($1)
        ORDER BY listing_id, tag_slug ASC`,
      [listingIds],
    );
    const result: Record<string, string[]> = {};
    for (const row of rows) {
      const listingId = row.listing_id as string;
      (result[listingId] ??= []).push(row.tag_slug as string);
    }
    return result;
  }

  /**
   * Exécute la requête paginée (page + total) sur `listings l` avec la clause
   * WHERE fournie. `nextParamIndex` = prochain numéro de placeholder libre
   * (après les params du WHERE). Tri created_at DESC, tie-break id (STABLE).
   * Factorise listPublic et listByOwner (mêmes tri/pagination).
   */
  private async pagedQuery(
    whereSql: string,
    whereValues: unknown[],
    nextParamIndex: number,
    limit: number,
    offset: number,
  ): Promise<PagedResult<Listing>> {
    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n FROM listings l ${whereSql}`,
      whereValues,
    );
    const limitPh = `$${nextParamIndex}`;
    const offsetPh = `$${nextParamIndex + 1}`;
    const pageParams = [...whereValues, limit, offset];
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_LISTING_COLUMNS}
         FROM listings l
        ${whereSql}
        ORDER BY l.created_at DESC, l.id
        LIMIT ${limitPh} OFFSET ${offsetPh}`,
      pageParams,
    );
    return {
      items: rows.map(rowToListing),
      total: Number(totalRes.rows[0].n),
    };
  }

  /**
   * Relit une annonce par id via un client de TRANSACTION (utilisé par create,
   * pour rester dans la même transaction). L'annonce existe forcément (on vient
   * de l'insérer).
   */
  private async selectByIdInClient(
    client: PoolClient,
    id: string,
  ): Promise<Listing> {
    const { rows } = await client.query(
      `SELECT ${SQL_LISTING_COLUMNS} FROM listings l WHERE l.id = $1`,
      [id],
    );
    return rowToListing(rows[0]);
  }
}

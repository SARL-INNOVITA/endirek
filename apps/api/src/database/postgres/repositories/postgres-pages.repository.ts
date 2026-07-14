/**
 * PostgresPagesRepository — implémentation SQL de PagesRepository
 * (Lot 3 — pages restaurants & entreprises, D69-D76).
 *
 * Parité STRICTE avec MockPagesRepository (mock/mock-repositories.ts) :
 * mêmes contrôles structurels et messages d'erreur, mêmes tris (tie-break id
 * — ordre STABLE), lectures PAR LOT anti N+1, compteurs calculés À LA
 * LECTURE (abonnés = comptes ACTIFS uniquement), écritures multi-tables en
 * transaction (remplacement des horaires, upsert de menu, suppression douce
 * d'un plat + retrait des menus).
 *
 * Géométrie (voir CONVENTION dans pg-helpers.ts) : lecture via ST_Y/ST_X
 * (fragment SQL_PAGE_COLUMNS), écriture via
 * ST_SetSRID(ST_MakePoint(lng, lat), 4326).
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  Dish,
  Page,
  PageContentStatus,
  PageDocument,
  PageEvent,
  PageHour,
  PageOffer,
  PageStatus,
} from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  AdminListPagesParams,
  CreateDishInput,
  CreatePageDocumentInput,
  CreatePageEventInput,
  CreatePageInput,
  CreatePageOfferInput,
  ListOwnerPagesParams,
  PagedResult,
  PageHourSpec,
  PageMenuWithDishes,
  PagesRepository,
  UpdateDishPatch,
  UpdatePageEventPatch,
  UpdatePageOfferPatch,
  UpdatePagePatch,
} from '../../repositories/interfaces';
import {
  query,
  rowToDish,
  rowToPage,
  rowToPageDocument,
  rowToPageEvent,
  rowToPageHour,
  rowToPageMenu,
  rowToPageOffer,
  SQL_DISH_COLUMNS,
  SQL_PAGE_COLUMNS,
  SQL_PAGE_DOCUMENT_COLUMNS,
  SQL_PAGE_EVENT_COLUMNS,
  SQL_PAGE_HOUR_COLUMNS,
  SQL_PAGE_MENU_COLUMNS,
  SQL_PAGE_OFFER_COLUMNS,
  withTransaction,
} from '../pg-helpers';

@Injectable()
export class PostgresPagesRepository implements PagesRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  // ── Pages ──────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Page | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_COLUMNS} FROM pages pa WHERE pa.id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToPage(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Page[]> {
    // Lecture PAR LOT (posts de page d'un feed — évite les N+1) : ids
    // inconnus ignorés, ordre non garanti (mock : WHERE id = ANY).
    if (ids.length === 0) {
      return [];
    }
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_COLUMNS} FROM pages pa WHERE pa.id = ANY($1)`,
      [ids],
    );
    return rows.map(rowToPage);
  }

  async findByUrlSlug(urlSlug: string): Promise<Page | null> {
    // url_slug est UNIQUE : au plus une ligne.
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_COLUMNS} FROM pages pa WHERE pa.url_slug = $1`,
      [urlSlug],
    );
    return rows.length > 0 ? rowToPage(rows[0]) : null;
  }

  async create(input: CreatePageInput): Promise<Page> {
    // Contrôles structurels AVANT écriture, mêmes messages que le mock.
    const owner = await query(this.pool, 'SELECT 1 FROM users WHERE id = $1', [
      input.ownerId,
    ]);
    if (owner.rowCount === 0) {
      throw new Error(`Propriétaire introuvable : ${input.ownerId}.`);
    }
    if (await this.findByUrlSlug(input.urlSlug)) {
      throw new Error(
        `url_slug déjà utilisé : « ${input.urlSlug} » (contrainte UNIQUE).`,
      );
    }

    const location = input.location ?? null;
    // Placeholders calculés au fil des params (géométrie optionnelle —
    // pattern posts/seeder). ORDRE longitude d'abord.
    const params: unknown[] = [
      input.ownerId,
      input.pageType,
      input.name,
      input.urlSlug,
      input.bio ?? '',
      input.avatarUrl ?? null,
      input.coverUrl ?? null,
      input.city,
    ];
    let locationSql = 'NULL';
    if (location !== null) {
      params.push(location.lng, location.lat);
      locationSql = `ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length}), 4326)`;
    }
    params.push(input.phone ?? null);
    const phonePh = `$${params.length}`;
    params.push(input.attributes ?? []);
    const attributesPh = `$${params.length}`;

    const inserted = await query(
      this.pool,
      `INSERT INTO pages (
         owner_id, page_type, name, url_slug, bio, avatar_url, cover_url,
         city, location, phone, attributes
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, ${locationSql}, ${phonePh}, ${attributesPh}
       )
       RETURNING id`,
      params,
    );
    // Relecture par le chemin standard (lat/lng recalculés).
    return (await this.findById(inserted.rows[0].id as string)) as Page;
  }

  async update(id: string, patch: UpdatePagePatch): Promise<Page> {
    const existing = await this.findById(id);
    if (existing === null) {
      throw new Error(`Page introuvable : ${id}.`);
    }

    // applyPatch : seules les clés FOURNIES (valeur !== undefined) entrent
    // dans le SET ; `null` reste une remise à NULL légitime.
    const sets: string[] = [];
    const params: unknown[] = [];
    let n = 1;

    if (patch.name !== undefined) {
      sets.push(`name = $${n++}`);
      params.push(patch.name);
    }
    if (patch.bio !== undefined) {
      sets.push(`bio = $${n++}`);
      params.push(patch.bio);
    }
    if (patch.avatarUrl !== undefined) {
      sets.push(`avatar_url = $${n++}`);
      params.push(patch.avatarUrl);
    }
    if (patch.coverUrl !== undefined) {
      sets.push(`cover_url = $${n++}`);
      params.push(patch.coverUrl);
    }
    if (patch.city !== undefined) {
      sets.push(`city = $${n++}`);
      params.push(patch.city);
    }
    if (patch.phone !== undefined) {
      sets.push(`phone = $${n++}`);
      params.push(patch.phone);
    }
    if (patch.attributes !== undefined) {
      sets.push(`attributes = $${n++}`);
      params.push(patch.attributes);
    }
    if (patch.vacationUntil !== undefined) {
      sets.push(`vacation_until = $${n++}`);
      params.push(patch.vacationUntil);
    }
    if (patch.vacationMessage !== undefined) {
      sets.push(`vacation_message = $${n++}`);
      params.push(patch.vacationMessage);
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
      // updated_at est géré par le trigger pages_set_updated_at.
      params.push(id);
      await query(
        this.pool,
        `UPDATE pages SET ${sets.join(', ')} WHERE id = $${n}`,
        params,
      );
    }
    return (await this.findById(id)) as Page;
  }

  async setStatus(id: string, status: PageStatus): Promise<Page> {
    // deleted_at posé au soft-delete (miroir du mock) ; updated_at via trigger.
    const { rowCount } = await query(
      this.pool,
      `UPDATE pages
          SET status = $1,
              deleted_at = CASE WHEN $1 = 'deleted' THEN now() ELSE deleted_at END
        WHERE id = $2`,
      [status, id],
    );
    if (rowCount === 0) {
      throw new Error(`Page introuvable : ${id}.`);
    }
    return (await this.findById(id)) as Page;
  }

  async setVerified(id: string, verified: boolean): Promise<Page> {
    // Idempotent — reposer le même badge est sans effet.
    const { rowCount } = await query(
      this.pool,
      'UPDATE pages SET verified = $1 WHERE id = $2',
      [verified, id],
    );
    if (rowCount === 0) {
      throw new Error(`Page introuvable : ${id}.`);
    }
    return (await this.findById(id)) as Page;
  }

  async listByOwner(
    ownerId: string,
    params: ListOwnerPagesParams,
  ): Promise<Page[]> {
    // De la plus ancienne à la plus récente (ordre de création — la première
    // page du compte reste en tête), tie-break id : ordre STABLE.
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_COLUMNS}
         FROM pages pa
        WHERE pa.owner_id = $1 AND pa.status = ANY($2)
        ORDER BY pa.created_at ASC, pa.id`,
      [ownerId, params.statuses],
    );
    return rows.map(rowToPage);
  }

  async listAdmin(params: AdminListPagesParams): Promise<PagedResult<Page>> {
    // Liste BACKOFFICE : tous statuts par défaut, JOIN users pour la
    // recherche sur le nom du propriétaire, filtres type/statut/vérifiée/
    // flaggedOnly, ILIKE nom/commune/propriétaire, antéchronologique
    // tie-break id (ordre STABLE) — miroir du mock.
    const conditions: string[] = [];
    const values: unknown[] = [];
    let n = 1;

    if (params.pageType !== undefined) {
      conditions.push(`pa.page_type = $${n++}`);
      values.push(params.pageType);
    }
    if (params.status !== undefined) {
      conditions.push(`pa.status = $${n++}`);
      values.push(params.status);
    }
    if (params.verified !== undefined) {
      conditions.push(`pa.verified = $${n++}`);
      values.push(params.verified);
    }
    if (params.flaggedOnly === true) {
      // Au moins un signalement OUVERT ciblant la page (miroir annonces).
      conditions.push(
        `EXISTS (SELECT 1 FROM reports r
                  WHERE r.target_type = 'page'
                    AND r.status = 'open'
                    AND r.target_id = pa.id)`,
      );
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      const ph = `$${n++}`;
      conditions.push(
        `(pa.name ILIKE ${ph} OR pa.city ILIKE ${ph} ` +
          `OR coalesce(owner.display_name, '') ILIKE ${ph})`,
      );
      values.push(`%${params.search.trim()}%`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromSql = `
         FROM pages pa
         JOIN users owner ON owner.id = pa.owner_id`;

    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n ${fromSql} ${whereSql}`,
      values,
    );
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_COLUMNS}
        ${fromSql}
        ${whereSql}
        ORDER BY pa.created_at DESC, pa.id
        LIMIT $${n} OFFSET $${n + 1}`,
      [...values, params.limit, params.offset],
    );
    return {
      items: rows.map(rowToPage),
      total: Number(totalRes.rows[0].n),
    };
  }

  // ── Abonnés (D74) ──────────────────────────────────────────────────────────

  async follow(pageId: string, userId: string): Promise<void> {
    // Mêmes contrôles/messages que le mock, puis INSERT idempotent
    // (ON CONFLICT DO NOTHING sur la PK composite).
    const page = await query(this.pool, 'SELECT 1 FROM pages WHERE id = $1', [
      pageId,
    ]);
    if (page.rowCount === 0) {
      throw new Error(`Page introuvable : ${pageId} (FK pages).`);
    }
    const user = await query(this.pool, 'SELECT 1 FROM users WHERE id = $1', [
      userId,
    ]);
    if (user.rowCount === 0) {
      throw new Error(`Utilisateur introuvable : ${userId}.`);
    }
    await query(
      this.pool,
      `INSERT INTO page_follows (page_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (page_id, user_id) DO NOTHING`,
      [pageId, userId],
    );
  }

  async unfollow(pageId: string, userId: string): Promise<void> {
    // Idempotent : DELETE sans erreur si absent.
    await query(
      this.pool,
      'DELETE FROM page_follows WHERE page_id = $1 AND user_id = $2',
      [pageId, userId],
    );
  }

  async isFollowing(pageId: string, userId: string): Promise<boolean> {
    const { rowCount } = await query(
      this.pool,
      'SELECT 1 FROM page_follows WHERE page_id = $1 AND user_id = $2',
      [pageId, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async listFollowedPageIds(userId: string): Promise<string[]> {
    const { rows } = await query(
      this.pool,
      'SELECT page_id FROM page_follows WHERE user_id = $1',
      [userId],
    );
    return rows.map((row) => row.page_id as string);
  }

  async followersCountsByPageIds(
    pageIds: string[],
  ): Promise<Record<string, number>> {
    // Compteur PAR page EN UN APPEL (anti N+1) — abonnés au compte ACTIF
    // uniquement (miroir des compteurs follow) ; les pages sans abonné sont
    // ABSENTES du résultat.
    if (pageIds.length === 0) {
      return {};
    }
    const { rows } = await query(
      this.pool,
      `SELECT pf.page_id, count(*)::int AS n
         FROM page_follows pf
         JOIN users u ON u.id = pf.user_id AND u.status = 'active'
        WHERE pf.page_id = ANY($1)
        GROUP BY pf.page_id`,
      [pageIds],
    );
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.page_id as string] = Number(row.n);
    }
    return result;
  }

  // ── Horaires (D70) ─────────────────────────────────────────────────────────

  async replaceHours(pageId: string, hours: PageHourSpec[]): Promise<void> {
    const page = await query(this.pool, 'SELECT 1 FROM pages WHERE id = $1', [
      pageId,
    ]);
    if (page.rowCount === 0) {
      throw new Error(`Page introuvable : ${pageId} (FK pages).`);
    }
    // Remplacement ATOMIQUE : DELETE puis ré-INSERT dans une transaction
    // (position par défaut = index du tableau — miroir du mock).
    await withTransaction(this.pool, async (client) => {
      await client.query('DELETE FROM page_hours WHERE page_id = $1', [
        pageId,
      ]);
      for (let index = 0; index < hours.length; index++) {
        const spec = hours[index];
        await client.query(
          `INSERT INTO page_hours (page_id, weekday, opens_minute, closes_minute, position)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            pageId,
            spec.weekday,
            spec.opensMinute,
            spec.closesMinute,
            spec.position ?? index,
          ],
        );
      }
    });
  }

  async listHoursByPageIds(
    pageIds: string[],
  ): Promise<Record<string, PageHour[]>> {
    // Plages PAR page EN UN APPEL, triées weekday puis opensMinute (tie-break
    // id) ; les pages sans plage sont ABSENTES du résultat.
    if (pageIds.length === 0) {
      return {};
    }
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_HOUR_COLUMNS}
         FROM page_hours h
        WHERE h.page_id = ANY($1)
        ORDER BY h.weekday ASC, h.opens_minute ASC, h.id`,
      [pageIds],
    );
    const result: Record<string, PageHour[]> = {};
    for (const row of rows) {
      const hour = rowToPageHour(row);
      (result[hour.pageId] ??= []).push(hour);
    }
    return result;
  }

  // ── Documents « Nos cartes » (D71) ─────────────────────────────────────────

  async createDocument(input: CreatePageDocumentInput): Promise<PageDocument> {
    const page = await query(this.pool, 'SELECT 1 FROM pages WHERE id = $1', [
      input.pageId,
    ]);
    if (page.rowCount === 0) {
      throw new Error(`Page introuvable : ${input.pageId} (FK pages).`);
    }
    // Position = max des positions existantes + 1 (ordre d'ajout — mock).
    const { rows } = await query(
      this.pool,
      `INSERT INTO page_documents (page_id, label, url, file_size_bytes, position)
       VALUES ($1, $2, $3, $4,
               (SELECT COALESCE(MAX(position), -1) + 1
                  FROM page_documents WHERE page_id = $1))
       RETURNING ${SQL_PAGE_DOCUMENT_COLUMNS
         .replaceAll('pd.', '')
         .replaceAll('\n', ' ')}`,
      [input.pageId, input.label, input.url, input.fileSizeBytes],
    );
    return rowToPageDocument(rows[0]);
  }

  async findDocumentById(id: string): Promise<PageDocument | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_DOCUMENT_COLUMNS} FROM page_documents pd WHERE pd.id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToPageDocument(rows[0]) : null;
  }

  async deleteDocument(id: string): Promise<void> {
    // Suppression DÉFINITIVE et idempotente (simple ligne d'attachement).
    await query(this.pool, 'DELETE FROM page_documents WHERE id = $1', [id]);
  }

  async listDocumentsByPageIds(
    pageIds: string[],
  ): Promise<Record<string, PageDocument[]>> {
    if (pageIds.length === 0) {
      return {};
    }
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_DOCUMENT_COLUMNS}
         FROM page_documents pd
        WHERE pd.page_id = ANY($1)
        ORDER BY pd.position ASC, pd.created_at ASC, pd.id`,
      [pageIds],
    );
    const result: Record<string, PageDocument[]> = {};
    for (const row of rows) {
      const document = rowToPageDocument(row);
      (result[document.pageId] ??= []).push(document);
    }
    return result;
  }

  // ── Plats (D71) ────────────────────────────────────────────────────────────

  async createDish(input: CreateDishInput): Promise<Dish> {
    const page = await query(this.pool, 'SELECT 1 FROM pages WHERE id = $1', [
      input.pageId,
    ]);
    if (page.rowCount === 0) {
      throw new Error(`Page introuvable : ${input.pageId} (FK pages).`);
    }
    if (
      (input.priceTakeawayCents ?? null) === null &&
      (input.priceDineInCents ?? null) === null
    ) {
      throw new Error(
        'Un plat exige au moins un prix : à emporter ou sur place (CHECK).',
      );
    }
    // Position par défaut = max + 1 (ordre d'ajout — mock), sinon celle
    // fournie par l'appelant.
    const params: unknown[] = [
      input.pageId,
      input.name,
      input.description ?? '',
      input.imageUrl ?? null,
      input.priceTakeawayCents ?? null,
      input.priceDineInCents ?? null,
    ];
    let positionSql = `(SELECT COALESCE(MAX(position), -1) + 1
                  FROM dishes WHERE page_id = $1)`;
    if (input.position !== undefined) {
      params.push(input.position);
      positionSql = `$${params.length}`;
    }
    const { rows } = await query(
      this.pool,
      `INSERT INTO dishes (
         page_id, name, description, image_url,
         price_takeaway_cents, price_dinein_cents, position
       ) VALUES ($1, $2, $3, $4, $5, $6, ${positionSql})
       RETURNING ${SQL_DISH_COLUMNS
         .replaceAll('di.', '')
         .replaceAll('\n', ' ')}`,
      params,
    );
    return rowToDish(rows[0]);
  }

  async findDishById(id: string): Promise<Dish | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DISH_COLUMNS} FROM dishes di WHERE di.id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToDish(rows[0]) : null;
  }

  async findDishesByIds(ids: string[]): Promise<Dish[]> {
    if (ids.length === 0) {
      return [];
    }
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DISH_COLUMNS} FROM dishes di WHERE di.id = ANY($1)`,
      [ids],
    );
    return rows.map(rowToDish);
  }

  async updateDish(id: string, patch: UpdateDishPatch): Promise<Dish> {
    const existing = await this.findDishById(id);
    if (existing === null) {
      throw new Error(`Plat introuvable : ${id}.`);
    }
    // Garde « au moins un prix » sur l'état RÉSULTANT (miroir du mock —
    // défense en profondeur du CHECK dishes_price_present_ck).
    const nextTakeaway =
      patch.priceTakeawayCents !== undefined
        ? patch.priceTakeawayCents
        : existing.priceTakeawayCents;
    const nextDineIn =
      patch.priceDineInCents !== undefined
        ? patch.priceDineInCents
        : existing.priceDineInCents;
    if (nextTakeaway === null && nextDineIn === null) {
      throw new Error(
        'Un plat exige au moins un prix : à emporter ou sur place (CHECK).',
      );
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let n = 1;
    if (patch.name !== undefined) {
      sets.push(`name = $${n++}`);
      params.push(patch.name);
    }
    if (patch.description !== undefined) {
      sets.push(`description = $${n++}`);
      params.push(patch.description);
    }
    if (patch.imageUrl !== undefined) {
      sets.push(`image_url = $${n++}`);
      params.push(patch.imageUrl);
    }
    if (patch.priceTakeawayCents !== undefined) {
      sets.push(`price_takeaway_cents = $${n++}`);
      params.push(patch.priceTakeawayCents);
    }
    if (patch.priceDineInCents !== undefined) {
      sets.push(`price_dinein_cents = $${n++}`);
      params.push(patch.priceDineInCents);
    }
    if (patch.position !== undefined) {
      sets.push(`position = $${n++}`);
      params.push(patch.position);
    }
    if (sets.length > 0) {
      // updated_at via trigger dishes_set_updated_at.
      params.push(id);
      await query(
        this.pool,
        `UPDATE dishes SET ${sets.join(', ')} WHERE id = $${n}`,
        params,
      );
    }
    return (await this.findDishById(id)) as Dish;
  }

  async softDeleteDish(id: string): Promise<Dish> {
    const existing = await this.findDishById(id);
    if (existing === null) {
      throw new Error(`Plat introuvable : ${id}.`);
    }
    // ATOMIQUEMENT : suppression douce + retrait de TOUS les menus programmés
    // qui référencent le plat (transaction — D71).
    await withTransaction(this.pool, async (client) => {
      await client.query(`UPDATE dishes SET status = 'deleted' WHERE id = $1`, [
        id,
      ]);
      await client.query('DELETE FROM page_menu_items WHERE dish_id = $1', [
        id,
      ]);
    });
    return (await this.findDishById(id)) as Dish;
  }

  async listDishes(pageId: string): Promise<Dish[]> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DISH_COLUMNS}
         FROM dishes di
        WHERE di.page_id = $1 AND di.status = 'active'
        ORDER BY di.position ASC, di.created_at ASC, di.id`,
      [pageId],
    );
    return rows.map(rowToDish);
  }

  // ── Menus programmés (D71) ─────────────────────────────────────────────────

  async upsertMenu(
    pageId: string,
    menuDate: string,
    dishIds: string[],
  ): Promise<PageMenuWithDishes | null> {
    const page = await query(this.pool, 'SELECT 1 FROM pages WHERE id = $1', [
      pageId,
    ]);
    if (page.rowCount === 0) {
      throw new Error(`Page introuvable : ${pageId} (FK pages).`);
    }
    for (const dishId of dishIds) {
      const dish = await query(
        this.pool,
        'SELECT 1 FROM dishes WHERE id = $1',
        [dishId],
      );
      if (dish.rowCount === 0) {
        throw new Error(`Plat introuvable : ${dishId} (FK dishes).`);
      }
    }

    return withTransaction(this.pool, async (client) => {
      // [] = suppression du menu du jour (les items partent en CASCADE).
      if (dishIds.length === 0) {
        await client.query(
          'DELETE FROM page_menus WHERE page_id = $1 AND menu_date = $2',
          [pageId, menuDate],
        );
        return null;
      }
      // Upsert du menu (UNIQUE (page_id, menu_date)) — updated_at posé par le
      // trigger sur le conflit (DO UPDATE force la ligne à « bouger »).
      const upserted = await client.query(
        `INSERT INTO page_menus (page_id, menu_date)
         VALUES ($1, $2)
         ON CONFLICT (page_id, menu_date)
         DO UPDATE SET menu_date = EXCLUDED.menu_date
         RETURNING id`,
        [pageId, menuDate],
      );
      const menuId = upserted.rows[0].id as string;
      // Remplacement ATOMIQUE des items (ordre = index du tableau).
      await client.query('DELETE FROM page_menu_items WHERE menu_id = $1', [
        menuId,
      ]);
      for (let index = 0; index < dishIds.length; index++) {
        await client.query(
          `INSERT INTO page_menu_items (menu_id, dish_id, position)
           VALUES ($1, $2, $3)`,
          [menuId, dishIds[index], index],
        );
      }
      return this.selectMenuInClient(client, menuId);
    });
  }

  async listMenusWithDishes(
    pageId: string,
    fromDate: string,
    toDate: string,
  ): Promise<PageMenuWithDishes[]> {
    // Bornes INCLUSES ; les jours sans menu sont ABSENTS du résultat
    // (l'appelant complète les trous) — tri par date croissante, tie-break id.
    const menusRes = await query(
      this.pool,
      `SELECT ${SQL_PAGE_MENU_COLUMNS}
         FROM page_menus pm
        WHERE pm.page_id = $1
          AND pm.menu_date >= $2::date AND pm.menu_date <= $3::date
        ORDER BY pm.menu_date ASC, pm.id`,
      [pageId, fromDate, toDate],
    );
    const menus = menusRes.rows.map(rowToPageMenu);
    if (menus.length === 0) {
      return [];
    }
    // Plats des menus EN UN APPEL (anti N+1) : items ordonnés par position,
    // plats 'deleted' exclus (défense en profondeur — D71 les retire déjà).
    const { rows } = await query(
      this.pool,
      `SELECT i.menu_id, i.position AS item_position, ${SQL_DISH_COLUMNS}
         FROM page_menu_items i
         JOIN dishes di ON di.id = i.dish_id AND di.status = 'active'
        WHERE i.menu_id = ANY($1)
        ORDER BY i.position ASC, i.id`,
      [menus.map((m) => m.id)],
    );
    const dishesByMenuId: Record<string, Dish[]> = {};
    for (const row of rows) {
      (dishesByMenuId[row.menu_id as string] ??= []).push(rowToDish(row));
    }
    return menus.map((menu) => ({
      menu,
      dishes: dishesByMenuId[menu.id] ?? [],
    }));
  }

  /** Relit un menu + ses plats via le client de TRANSACTION (upsertMenu). */
  private async selectMenuInClient(
    client: PoolClient,
    menuId: string,
  ): Promise<PageMenuWithDishes> {
    const menuRes = await client.query(
      `SELECT ${SQL_PAGE_MENU_COLUMNS} FROM page_menus pm WHERE pm.id = $1`,
      [menuId],
    );
    const menu = rowToPageMenu(menuRes.rows[0]);
    const itemsRes = await client.query(
      `SELECT ${SQL_DISH_COLUMNS}
         FROM page_menu_items i
         JOIN dishes di ON di.id = i.dish_id AND di.status = 'active'
        WHERE i.menu_id = $1
        ORDER BY i.position ASC, i.id`,
      [menuId],
    );
    return { menu, dishes: itemsRes.rows.map(rowToDish) };
  }

  // ── Offres (D72) ───────────────────────────────────────────────────────────

  async createOffer(input: CreatePageOfferInput): Promise<PageOffer> {
    const page = await query(this.pool, 'SELECT 1 FROM pages WHERE id = $1', [
      input.pageId,
    ]);
    if (page.rowCount === 0) {
      throw new Error(`Page introuvable : ${input.pageId} (FK pages).`);
    }
    const { rows } = await query(
      this.pool,
      `INSERT INTO page_offers (page_id, title, description, image_url, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SQL_PAGE_OFFER_COLUMNS
         .replaceAll('po.', '')
         .replaceAll('\n', ' ')}`,
      [
        input.pageId,
        input.title,
        input.description ?? '',
        input.imageUrl ?? null,
        input.startsAt ?? null,
        input.endsAt ?? null,
      ],
    );
    return rowToPageOffer(rows[0]);
  }

  async findOfferById(id: string): Promise<PageOffer | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_OFFER_COLUMNS} FROM page_offers po WHERE po.id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToPageOffer(rows[0]) : null;
  }

  async updateOffer(
    id: string,
    patch: UpdatePageOfferPatch,
  ): Promise<PageOffer> {
    const existing = await this.findOfferById(id);
    if (existing === null) {
      throw new Error(`Offre introuvable : ${id}.`);
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
    if (patch.imageUrl !== undefined) {
      sets.push(`image_url = $${n++}`);
      params.push(patch.imageUrl);
    }
    if (patch.startsAt !== undefined) {
      sets.push(`starts_at = $${n++}`);
      params.push(patch.startsAt);
    }
    if (patch.endsAt !== undefined) {
      sets.push(`ends_at = $${n++}`);
      params.push(patch.endsAt);
    }
    if (sets.length > 0) {
      // updated_at via trigger page_offers_set_updated_at.
      params.push(id);
      await query(
        this.pool,
        `UPDATE page_offers SET ${sets.join(', ')} WHERE id = $${n}`,
        params,
      );
    }
    return (await this.findOfferById(id)) as PageOffer;
  }

  async setOfferStatus(
    id: string,
    status: PageContentStatus,
  ): Promise<PageOffer> {
    const { rows } = await query(
      this.pool,
      `UPDATE page_offers SET status = $2
        WHERE id = $1
        RETURNING ${SQL_PAGE_OFFER_COLUMNS
          .replaceAll('po.', '')
          .replaceAll('\n', ' ')}`,
      [id, status],
    );
    if (rows.length === 0) {
      throw new Error(`Offre introuvable : ${id}.`);
    }
    return rowToPageOffer(rows[0]);
  }

  async listOffers(pageId: string): Promise<PageOffer[]> {
    // Offres 'active', antéchronologiques (tie-break id — miroir du mock).
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_OFFER_COLUMNS}
         FROM page_offers po
        WHERE po.page_id = $1 AND po.status = 'active'
        ORDER BY po.created_at DESC, po.id`,
      [pageId],
    );
    return rows.map(rowToPageOffer);
  }

  // ── Événements (D72) ───────────────────────────────────────────────────────

  async createEvent(input: CreatePageEventInput): Promise<PageEvent> {
    const page = await query(this.pool, 'SELECT 1 FROM pages WHERE id = $1', [
      input.pageId,
    ]);
    if (page.rowCount === 0) {
      throw new Error(`Page introuvable : ${input.pageId} (FK pages).`);
    }
    const { rows } = await query(
      this.pool,
      `INSERT INTO page_events (page_id, title, description, image_url, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SQL_PAGE_EVENT_COLUMNS
         .replaceAll('pe.', '')
         .replaceAll('\n', ' ')}`,
      [
        input.pageId,
        input.title,
        input.description ?? '',
        input.imageUrl ?? null,
        input.startsAt,
        input.endsAt ?? null,
      ],
    );
    return rowToPageEvent(rows[0]);
  }

  async findEventById(id: string): Promise<PageEvent | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_EVENT_COLUMNS} FROM page_events pe WHERE pe.id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToPageEvent(rows[0]) : null;
  }

  async updateEvent(
    id: string,
    patch: UpdatePageEventPatch,
  ): Promise<PageEvent> {
    const existing = await this.findEventById(id);
    if (existing === null) {
      throw new Error(`Événement introuvable : ${id}.`);
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
    if (patch.imageUrl !== undefined) {
      sets.push(`image_url = $${n++}`);
      params.push(patch.imageUrl);
    }
    if (patch.startsAt !== undefined) {
      sets.push(`starts_at = $${n++}`);
      params.push(patch.startsAt);
    }
    if (patch.endsAt !== undefined) {
      sets.push(`ends_at = $${n++}`);
      params.push(patch.endsAt);
    }
    if (sets.length > 0) {
      // updated_at via trigger page_events_set_updated_at.
      params.push(id);
      await query(
        this.pool,
        `UPDATE page_events SET ${sets.join(', ')} WHERE id = $${n}`,
        params,
      );
    }
    return (await this.findEventById(id)) as PageEvent;
  }

  async setEventStatus(
    id: string,
    status: PageContentStatus,
  ): Promise<PageEvent> {
    const { rows } = await query(
      this.pool,
      `UPDATE page_events SET status = $2
        WHERE id = $1
        RETURNING ${SQL_PAGE_EVENT_COLUMNS
          .replaceAll('pe.', '')
          .replaceAll('\n', ' ')}`,
      [id, status],
    );
    if (rows.length === 0) {
      throw new Error(`Événement introuvable : ${id}.`);
    }
    return rowToPageEvent(rows[0]);
  }

  async listEvents(pageId: string): Promise<PageEvent[]> {
    // startsAt CROISSANT : le prochain événement d'abord (tie-break id).
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_PAGE_EVENT_COLUMNS}
         FROM page_events pe
        WHERE pe.page_id = $1 AND pe.status = 'active'
        ORDER BY pe.starts_at ASC, pe.id`,
      [pageId],
    );
    return rows.map(rowToPageEvent);
  }

  // ── Compteurs backoffice ───────────────────────────────────────────────────

  async countContents(pageId: string): Promise<{
    dishes: number;
    documents: number;
    menus: number;
    offers: number;
    events: number;
  }> {
    // Une seule requête de sous-SELECT scalaires (pattern logBootSummary).
    const { rows } = await query(
      this.pool,
      `SELECT
         (SELECT count(*) FROM dishes
           WHERE page_id = $1 AND status = 'active')     AS dishes,
         (SELECT count(*) FROM page_documents
           WHERE page_id = $1)                           AS documents,
         (SELECT count(*) FROM page_menus
           WHERE page_id = $1)                           AS menus,
         (SELECT count(*) FROM page_offers
           WHERE page_id = $1 AND status = 'active')     AS offers,
         (SELECT count(*) FROM page_events
           WHERE page_id = $1 AND status = 'active')     AS events`,
      [pageId],
    );
    const row = rows[0];
    return {
      dishes: Number(row.dishes),
      documents: Number(row.documents),
      menus: Number(row.menus),
      offers: Number(row.offers),
      events: Number(row.events),
    };
  }
}

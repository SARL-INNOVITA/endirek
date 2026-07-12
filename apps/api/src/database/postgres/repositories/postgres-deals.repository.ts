/**
 * PostgresDealsRepository — implémentation SQL de DealsRepository
 * (Lot 2 — CP2.4).
 *
 * Parité STRICTE avec MockDealsRepository (mock/mock-repositories.ts) :
 * mêmes contrôles structurels et messages d'erreur (FK annonce/participants/
 * conversation, parties distinctes, avis unique par (deal, évaluateur),
 * « honoré avant validation », introuvables), mêmes tris (deals : updatedAt
 * DESC tie id ; éléments : position/createdAt/id ; ajustements : createdAt
 * DESC ; notes : chronologiques ; avis reçus : createdAt DESC), mêmes
 * moyennes d'avis ARRONDIES à 2 décimales (ROUND(...,2) ↔ Math.round côté
 * mock), écritures multi-tables ATOMIQUES (deal+items+steps, replaceItems),
 * honor/validate IDEMPOTENTS.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  Deal,
  DealAdjustment,
  DealItem,
  DealItemStep,
  DealNote,
  DealReview,
} from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  AdminListDealsParams,
  CreateDealAdjustmentInput,
  CreateDealInput,
  CreateDealItemSpec,
  CreateDealReviewInput,
  DealReviewAggregates,
  DealsRepository,
  ListDealsParams,
  PagedResult,
  PageParams,
  UpdateDealItemPatch,
  UpdateDealPatch,
} from '../../repositories/interfaces';
import {
  query,
  rowToDeal,
  rowToDealAdjustment,
  rowToDealItem,
  rowToDealItemStep,
  rowToDealNote,
  rowToDealReview,
  SQL_DEAL_COLUMNS,
  SQL_DEAL_ITEM_COLUMNS,
  SQL_DEAL_STEP_COLUMNS,
  withTransaction,
} from '../pg-helpers';

/** Correspondance clé de patch (camelCase) → colonne SQL (snake_case). */
const DEAL_PATCH_COLUMNS: Record<keyof UpdateDealPatch, string> = {
  status: 'status',
  dueDate: 'due_date',
  conversationId: 'conversation_id',
  cancellationRequestedBy: 'cancellation_requested_by',
  disputedBy: 'disputed_by',
  disputeReason: 'dispute_reason',
  disputeResolvedBy: 'dispute_resolved_by',
  disputeResolvedAt: 'dispute_resolved_at',
  disputeResolution: 'dispute_resolution',
  disputeResolutionNote: 'dispute_resolution_note',
  acceptedAt: 'accepted_at',
  completedAt: 'completed_at',
  closedAt: 'closed_at',
};

@Injectable()
export class PostgresDealsRepository implements DealsRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<Deal | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DEAL_COLUMNS} FROM deals d WHERE d.id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToDeal(rows[0]) : null;
  }

  async create(input: CreateDealInput): Promise<Deal> {
    // Contrôles structurels AVANT écriture, mêmes messages que le mock.
    const listing = await query(
      this.pool,
      'SELECT 1 FROM listings WHERE id = $1',
      [input.listingId],
    );
    if (listing.rowCount === 0) {
      throw new Error(
        `Annonce introuvable : ${input.listingId} (FK listings).`,
      );
    }
    for (const userId of [input.proposerId, input.recipientId]) {
      const user = await query(
        this.pool,
        'SELECT 1 FROM users WHERE id = $1',
        [userId],
      );
      if (user.rowCount === 0) {
        throw new Error(`Utilisateur introuvable : ${userId}.`);
      }
    }
    if (input.proposerId === input.recipientId) {
      throw new Error('Un deal exige deux parties distinctes (CHECK).');
    }
    if (input.conversationId !== null) {
      const conversation = await query(
        this.pool,
        'SELECT 1 FROM conversations WHERE id = $1',
        [input.conversationId],
      );
      if (conversation.rowCount === 0) {
        throw new Error(
          `Conversation introuvable : ${input.conversationId} (FK conversations).`,
        );
      }
    }

    // Deal + éléments + sous-éléments ATOMIQUES.
    return withTransaction(this.pool, async (client) => {
      const inserted = await client.query(
        `INSERT INTO deals
           (listing_id, conversation_id, proposer_id, recipient_id, due_date)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          input.listingId,
          input.conversationId,
          input.proposerId,
          input.recipientId,
          input.dueDate ?? null,
        ],
      );
      const dealId = inserted.rows[0].id as string;
      for (let index = 0; index < input.items.length; index++) {
        await this.insertItemInClient(client, dealId, input.items[index], index);
      }
      const { rows } = await client.query(
        `SELECT ${SQL_DEAL_COLUMNS} FROM deals d WHERE d.id = $1`,
        [dealId],
      );
      return rowToDeal(rows[0]);
    });
  }

  async update(id: string, patch: UpdateDealPatch): Promise<Deal> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Deal introuvable : ${id}.`);
    }
    // applyPatch : clés undefined ignorées, null = remise à NULL légitime.
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, column] of Object.entries(DEAL_PATCH_COLUMNS) as Array<
      [keyof UpdateDealPatch, string]
    >) {
      const value = patch[key];
      if (value === undefined) {
        continue;
      }
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    }
    if (sets.length > 0) {
      params.push(id);
      await query(
        this.pool,
        `UPDATE deals SET ${sets.join(', ')} WHERE id = $${params.length}`,
        params,
      );
    }
    return (await this.findById(id)) as Deal;
  }

  async listByParticipant(
    userId: string,
    params: ListDealsParams,
  ): Promise<PagedResult<Deal>> {
    const conditions = [`(d.proposer_id = $1 OR d.recipient_id = $1)`];
    const values: unknown[] = [userId];
    if (params.status !== undefined) {
      values.push(params.status);
      conditions.push(`d.status = $${values.length}`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;
    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n FROM deals d ${whereSql}`,
      values,
    );
    const pageParams = [...values, params.limit, params.offset];
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DEAL_COLUMNS}
         FROM deals d
        ${whereSql}
        ORDER BY d.updated_at DESC, d.id
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      pageParams,
    );
    return {
      items: rows.map(rowToDeal),
      total: Number(totalRes.rows[0].n),
    };
  }

  async listAdmin(params: AdminListDealsParams): Promise<PagedResult<Deal>> {
    // Liste BACKOFFICE (CP2.5 — D66) : tous statuts, convention des listes
    // admin (created_at DESC, tie-break id). Recherche insensible à la casse
    // sur le nom d'une des parties ou le titre de l'annonce (JOIN users ×2 +
    // listings — miroir du mock) ; une saisie entièrement numérique matche
    // AUSSI le numéro exact du deal.
    const conditions: string[] = [];
    const values: unknown[] = [];
    let n = 1;
    if (params.status !== undefined) {
      conditions.push(`d.status = $${n++}`);
      values.push(params.status);
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      const needle = params.search.trim();
      const searchParts = [
        `up.display_name ILIKE $${n}`,
        `ur.display_name ILIKE $${n}`,
        `l.title ILIKE $${n}`,
      ];
      values.push(`%${needle}%`);
      n++;
      if (/^\d+$/.test(needle)) {
        searchParts.push(`d.deal_number = $${n++}`);
        values.push(Number(needle));
      }
      conditions.push(`(${searchParts.join(' OR ')})`);
    }
    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromSql = `
         FROM deals d
         JOIN users up ON up.id = d.proposer_id
         JOIN users ur ON ur.id = d.recipient_id
         JOIN listings l ON l.id = d.listing_id`;
    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n ${fromSql} ${whereSql}`,
      values,
    );
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DEAL_COLUMNS}
        ${fromSql}
        ${whereSql}
        ORDER BY d.created_at DESC, d.id
        LIMIT $${n} OFFSET $${n + 1}`,
      [...values, params.limit, params.offset],
    );
    return {
      items: rows.map(rowToDeal),
      total: Number(totalRes.rows[0].n),
    };
  }

  async findOpenBetween(
    listingId: string,
    userA: string,
    userB: string,
  ): Promise<Deal | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DEAL_COLUMNS}
         FROM deals d
        WHERE d.listing_id = $1
          AND d.status IN ('proposed', 'active')
          AND ((d.proposer_id = $2 AND d.recipient_id = $3)
            OR (d.proposer_id = $3 AND d.recipient_id = $2))
        ORDER BY d.created_at DESC, d.id
        LIMIT 1`,
      [listingId, userA, userB],
    );
    return rows.length > 0 ? rowToDeal(rows[0]) : null;
  }

  async findOpenByConversation(conversationId: string): Promise<Deal | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DEAL_COLUMNS}
         FROM deals d
        WHERE d.conversation_id = $1
          AND d.status IN ('proposed', 'active')
        ORDER BY d.created_at DESC, d.id
        LIMIT 1`,
      [conversationId],
    );
    return rows.length > 0 ? rowToDeal(rows[0]) : null;
  }

  async countCompletedByParticipant(userId: string): Promise<number> {
    const { rows } = await query(
      this.pool,
      `SELECT count(*)::int AS n
         FROM deals d
        WHERE d.status = 'completed'
          AND (d.proposer_id = $1 OR d.recipient_id = $1)`,
      [userId],
    );
    return Number(rows[0].n);
  }

  async listCompletedByParticipant(
    userId: string,
    params: PageParams,
  ): Promise<PagedResult<Deal>> {
    const whereSql = `WHERE d.status = 'completed'
          AND (d.proposer_id = $1 OR d.recipient_id = $1)`;
    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n FROM deals d ${whereSql}`,
      [userId],
    );
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DEAL_COLUMNS}
         FROM deals d
        ${whereSql}
        ORDER BY d.completed_at DESC, d.id
        LIMIT $2 OFFSET $3`,
      [userId, params.limit, params.offset],
    );
    return {
      items: rows.map(rowToDeal),
      total: Number(totalRes.rows[0].n),
    };
  }

  // ── Éléments & sous-éléments ───────────────────────────────────────────────

  async listItems(dealId: string): Promise<DealItem[]> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DEAL_ITEM_COLUMNS}
         FROM deal_items i
        WHERE i.deal_id = $1
        ORDER BY i.position ASC, i.created_at ASC, i.id`,
      [dealId],
    );
    return rows.map(rowToDealItem);
  }

  async listItemsByDealIds(
    dealIds: string[],
  ): Promise<Record<string, DealItem[]>> {
    if (dealIds.length === 0) {
      return {};
    }
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DEAL_ITEM_COLUMNS}
         FROM deal_items i
        WHERE i.deal_id = ANY($1)
        ORDER BY i.position ASC, i.created_at ASC, i.id`,
      [dealIds],
    );
    const result: Record<string, DealItem[]> = {};
    for (const row of rows) {
      const item = rowToDealItem(row);
      (result[item.dealId] ??= []).push(item);
    }
    return result;
  }

  async findItemById(itemId: string): Promise<DealItem | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DEAL_ITEM_COLUMNS} FROM deal_items i WHERE i.id = $1`,
      [itemId],
    );
    return rows.length > 0 ? rowToDealItem(rows[0]) : null;
  }

  async listSteps(itemIds: string[]): Promise<DealItemStep[]> {
    if (itemIds.length === 0) {
      return [];
    }
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DEAL_STEP_COLUMNS}
         FROM deal_item_steps s
        WHERE s.item_id = ANY($1)
        ORDER BY s.position ASC, s.id`,
      [itemIds],
    );
    return rows.map(rowToDealItemStep);
  }

  async findStepById(stepId: string): Promise<DealItemStep | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_DEAL_STEP_COLUMNS} FROM deal_item_steps s WHERE s.id = $1`,
      [stepId],
    );
    return rows.length > 0 ? rowToDealItemStep(rows[0]) : null;
  }

  async replaceItems(
    dealId: string,
    items: CreateDealItemSpec[],
  ): Promise<void> {
    const deal = await query(this.pool, 'SELECT 1 FROM deals WHERE id = $1', [
      dealId,
    ]);
    if (deal.rowCount === 0) {
      throw new Error(`Deal introuvable : ${dealId}.`);
    }
    await withTransaction(this.pool, async (client) => {
      // DELETE CASCADE emporte les sous-éléments.
      await client.query('DELETE FROM deal_items WHERE deal_id = $1', [dealId]);
      for (let index = 0; index < items.length; index++) {
        await this.insertItemInClient(client, dealId, items[index], index);
      }
    });
  }

  async addItem(dealId: string, spec: CreateDealItemSpec): Promise<DealItem> {
    const deal = await query(this.pool, 'SELECT 1 FROM deals WHERE id = $1', [
      dealId,
    ]);
    if (deal.rowCount === 0) {
      throw new Error(`Deal introuvable : ${dealId}.`);
    }
    return withTransaction(this.pool, async (client) => {
      // Position : après le dernier élément existant (miroir du mock).
      const maxRes = await client.query(
        `SELECT COALESCE(MAX(position), -1) AS max FROM deal_items WHERE deal_id = $1`,
        [dealId],
      );
      const next = Number(maxRes.rows[0].max) + 1;
      const item = await this.insertItemInClient(
        client,
        dealId,
        { ...spec, position: spec.position ?? next },
        next,
      );
      return item;
    });
  }

  async updateItem(
    itemId: string,
    patch: UpdateDealItemPatch,
  ): Promise<DealItem> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.kind !== undefined) {
      params.push(patch.kind);
      sets.push(`kind = $${params.length}`);
    }
    if (patch.title !== undefined) {
      params.push(patch.title);
      sets.push(`title = $${params.length}`);
    }
    if (patch.description !== undefined) {
      params.push(patch.description);
      sets.push(`description = $${params.length}`);
    }
    if (patch.value !== undefined) {
      params.push(patch.value);
      sets.push(`value = $${params.length}`);
    }
    if (sets.length > 0) {
      params.push(itemId);
      const { rowCount } = await query(
        this.pool,
        `UPDATE deal_items SET ${sets.join(', ')} WHERE id = $${params.length}`,
        params,
      );
      if (rowCount === 0) {
        throw new Error(`Élément introuvable : ${itemId}.`);
      }
    }
    const item = await this.findItemById(itemId);
    if (!item) {
      throw new Error(`Élément introuvable : ${itemId}.`);
    }
    return item;
  }

  async removeItem(itemId: string): Promise<void> {
    const { rowCount } = await query(
      this.pool,
      'DELETE FROM deal_items WHERE id = $1',
      [itemId],
    );
    if (rowCount === 0) {
      throw new Error(`Élément introuvable : ${itemId}.`);
    }
  }

  async honorStep(stepId: string, at: Date): Promise<DealItemStep> {
    // Idempotent : ne pose honored_at que s'il est NULL.
    const { rowCount } = await query(
      this.pool,
      `UPDATE deal_item_steps
          SET honored_at = COALESCE(honored_at, $2)
        WHERE id = $1`,
      [stepId, at],
    );
    if (rowCount === 0) {
      throw new Error(`Sous-élément introuvable : ${stepId}.`);
    }
    return (await this.findStepById(stepId)) as DealItemStep;
  }

  async validateStep(stepId: string, at: Date): Promise<DealItemStep> {
    const step = await this.findStepById(stepId);
    if (!step) {
      throw new Error(`Sous-élément introuvable : ${stepId}.`);
    }
    if (step.honoredAt === null) {
      throw new Error(
        'Un sous-élément doit être honoré avant validation (CHECK).',
      );
    }
    await query(
      this.pool,
      `UPDATE deal_item_steps
          SET validated_at = COALESCE(validated_at, $2)
        WHERE id = $1`,
      [stepId, at],
    );
    return (await this.findStepById(stepId)) as DealItemStep;
  }

  // ── Ajustements ────────────────────────────────────────────────────────────

  async createAdjustment(
    input: CreateDealAdjustmentInput,
  ): Promise<DealAdjustment> {
    const deal = await query(this.pool, 'SELECT 1 FROM deals WHERE id = $1', [
      input.dealId,
    ]);
    if (deal.rowCount === 0) {
      throw new Error(`Deal introuvable : ${input.dealId}.`);
    }
    const { rows } = await query(
      this.pool,
      `INSERT INTO deal_adjustments
         (deal_id, proposed_by, kind, item_id, payload, description)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id, deal_id, proposed_by, kind, item_id, payload,
                 description, status, decided_at, created_at`,
      [
        input.dealId,
        input.proposedBy,
        input.kind,
        input.itemId ?? null,
        JSON.stringify(input.payload),
        input.description,
      ],
    );
    return rowToDealAdjustment(rows[0]);
  }

  async findAdjustmentById(id: string): Promise<DealAdjustment | null> {
    const { rows } = await query(
      this.pool,
      `SELECT id, deal_id, proposed_by, kind, item_id, payload,
              description, status, decided_at, created_at
         FROM deal_adjustments WHERE id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToDealAdjustment(rows[0]) : null;
  }

  async listAdjustments(dealId: string): Promise<DealAdjustment[]> {
    const { rows } = await query(
      this.pool,
      `SELECT id, deal_id, proposed_by, kind, item_id, payload,
              description, status, decided_at, created_at
         FROM deal_adjustments
        WHERE deal_id = $1
        ORDER BY created_at DESC, id`,
      [dealId],
    );
    return rows.map(rowToDealAdjustment);
  }

  async decideAdjustment(
    id: string,
    status: 'accepted' | 'rejected',
    at: Date,
  ): Promise<DealAdjustment> {
    const { rowCount } = await query(
      this.pool,
      `UPDATE deal_adjustments
          SET status = $2, decided_at = $3
        WHERE id = $1`,
      [id, status, at],
    );
    if (rowCount === 0) {
      throw new Error(`Ajustement introuvable : ${id}.`);
    }
    return (await this.findAdjustmentById(id)) as DealAdjustment;
  }

  // ── Notes de suivi ─────────────────────────────────────────────────────────

  async createNote(input: {
    dealId: string;
    authorId: string;
    body: string;
  }): Promise<DealNote> {
    const deal = await query(this.pool, 'SELECT 1 FROM deals WHERE id = $1', [
      input.dealId,
    ]);
    if (deal.rowCount === 0) {
      throw new Error(`Deal introuvable : ${input.dealId}.`);
    }
    const { rows } = await query(
      this.pool,
      `INSERT INTO deal_notes (deal_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, deal_id, author_id, body, created_at`,
      [input.dealId, input.authorId, input.body],
    );
    return rowToDealNote(rows[0]);
  }

  async listNotes(dealId: string): Promise<DealNote[]> {
    const { rows } = await query(
      this.pool,
      `SELECT id, deal_id, author_id, body, created_at
         FROM deal_notes
        WHERE deal_id = $1
        ORDER BY created_at ASC, id`,
      [dealId],
    );
    return rows.map(rowToDealNote);
  }

  // ── Avis ───────────────────────────────────────────────────────────────────

  async createReview(input: CreateDealReviewInput): Promise<DealReview> {
    const deal = await query(this.pool, 'SELECT 1 FROM deals WHERE id = $1', [
      input.dealId,
    ]);
    if (deal.rowCount === 0) {
      throw new Error(`Deal introuvable : ${input.dealId}.`);
    }
    const existing = await query(
      this.pool,
      `SELECT 1 FROM deal_reviews WHERE deal_id = $1 AND reviewer_id = $2`,
      [input.dealId, input.reviewerId],
    );
    if ((existing.rowCount ?? 0) > 0) {
      throw new Error(
        'Avis déjà déposé pour ce deal par cet évaluateur (contrainte UNIQUE).',
      );
    }
    if (input.reviewerId === input.revieweeId) {
      throw new Error('Un avis exige deux parties distinctes (CHECK).');
    }
    const { rows } = await query(
      this.pool,
      `INSERT INTO deal_reviews
         (deal_id, reviewer_id, reviewee_id,
          rating_honesty, rating_conformity, rating_kindness, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, deal_id, reviewer_id, reviewee_id,
                 rating_honesty, rating_conformity, rating_kindness,
                 comment, created_at`,
      [
        input.dealId,
        input.reviewerId,
        input.revieweeId,
        input.ratingHonesty,
        input.ratingConformity,
        input.ratingKindness,
        input.comment ?? null,
      ],
    );
    return rowToDealReview(rows[0]);
  }

  async listReviewsByDeal(dealId: string): Promise<DealReview[]> {
    const { rows } = await query(
      this.pool,
      `SELECT id, deal_id, reviewer_id, reviewee_id,
              rating_honesty, rating_conformity, rating_kindness,
              comment, created_at
         FROM deal_reviews
        WHERE deal_id = $1
        ORDER BY created_at ASC, id`,
      [dealId],
    );
    return rows.map(rowToDealReview);
  }

  async listReviewsForUser(
    revieweeId: string,
    params: PageParams,
  ): Promise<PagedResult<DealReview>> {
    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n FROM deal_reviews WHERE reviewee_id = $1`,
      [revieweeId],
    );
    const { rows } = await query(
      this.pool,
      `SELECT id, deal_id, reviewer_id, reviewee_id,
              rating_honesty, rating_conformity, rating_kindness,
              comment, created_at
         FROM deal_reviews
        WHERE reviewee_id = $1
        ORDER BY created_at DESC, id
        LIMIT $2 OFFSET $3`,
      [revieweeId, params.limit, params.offset],
    );
    return {
      items: rows.map(rowToDealReview),
      total: Number(totalRes.rows[0].n),
    };
  }

  async reviewAggregates(revieweeId: string): Promise<DealReviewAggregates> {
    // Moyennes ARRONDIES à 2 décimales — parité stricte avec le mock.
    const { rows } = await query(
      this.pool,
      `SELECT count(*)::int AS n,
              ROUND(AVG(rating_honesty)::numeric, 2)::float AS avg_honesty,
              ROUND(AVG(rating_conformity)::numeric, 2)::float AS avg_conformity,
              ROUND(AVG(rating_kindness)::numeric, 2)::float AS avg_kindness
         FROM deal_reviews
        WHERE reviewee_id = $1`,
      [revieweeId],
    );
    const row = rows[0];
    const count = Number(row.n);
    return {
      count,
      avgHonesty: count === 0 ? null : Number(row.avg_honesty),
      avgConformity: count === 0 ? null : Number(row.avg_conformity),
      avgKindness: count === 0 ? null : Number(row.avg_kindness),
    };
  }

  // ── Aides privées ──────────────────────────────────────────────────────────

  /** Insère un élément + ses sous-éléments dans la transaction courante
   * (le service garantit steps ≥ 1). Même message FK que le mock. */
  private async insertItemInClient(
    client: PoolClient,
    dealId: string,
    spec: CreateDealItemSpec,
    fallbackPosition: number,
  ): Promise<DealItem> {
    const user = await client.query('SELECT 1 FROM users WHERE id = $1', [
      spec.providerId,
    ]);
    if (user.rowCount === 0) {
      throw new Error(`Utilisateur introuvable : ${spec.providerId}.`);
    }
    const inserted = await client.query(
      `INSERT INTO deal_items
         (deal_id, provider_id, kind, title, description, value, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SQL_DEAL_ITEM_COLUMNS.replaceAll('i.', '').replaceAll('\n', ' ')}`,
      [
        dealId,
        spec.providerId,
        spec.kind,
        spec.title,
        spec.description ?? '',
        spec.value,
        spec.position ?? fallbackPosition,
      ],
    );
    const item = rowToDealItem(inserted.rows[0]);
    for (let index = 0; index < spec.steps.length; index++) {
      await client.query(
        `INSERT INTO deal_item_steps (item_id, label, position)
         VALUES ($1, $2, $3)`,
        [item.id, spec.steps[index], index],
      );
    }
    return item;
  }
}

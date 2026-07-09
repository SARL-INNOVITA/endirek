/**
 * PostgresNotificationsRepository — implémentation SQL de
 * NotificationsRepository. Comportement OBSERVABLE identique au driver mock
 * (MockNotificationsRepository) : listes antéchronologiques paginées, markRead
 * idempotent (readAt = now si null), unreadCount = COUNT WHERE read_at IS NULL.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { Notification } from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  CreateNotificationInput,
  NotificationsRepository,
} from '../../repositories/interfaces';
import { query, rowToNotification } from '../pg-helpers';

/** Colonnes de `notifications` (aucune géométrie). */
const SQL_NOTIFICATION_COLUMNS = `
  id, user_id, type, payload, read_at, created_at
`.trim();

@Injectable()
export class PostgresNotificationsRepository
  implements NotificationsRepository
{
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    // Existence du destinataire (même message que le mock).
    const user = await query(this.pool, `SELECT 1 FROM users WHERE id = $1`, [
      input.userId,
    ]);
    if (user.rows.length === 0) {
      throw new Error(`Utilisateur introuvable : ${input.userId}.`);
    }
    // payload {} par défaut, readAt null — mêmes défauts que le mock.
    const res = await query(
      this.pool,
      `INSERT INTO notifications (user_id, type, payload)
       VALUES ($1, $2, $3::jsonb)
       RETURNING ${SQL_NOTIFICATION_COLUMNS}`,
      [input.userId, input.type, JSON.stringify(input.payload ?? {})],
    );
    return rowToNotification(res.rows[0]);
  }

  async findById(id: string): Promise<Notification | null> {
    const res = await query(
      this.pool,
      `SELECT ${SQL_NOTIFICATION_COLUMNS} FROM notifications WHERE id = $1`,
      [id],
    );
    return res.rows.length > 0 ? rowToNotification(res.rows[0]) : null;
  }

  async listByUser(
    userId: string,
    params: { limit: number; offset: number },
  ): Promise<Notification[]> {
    // Antéchronologique, paginée. Tie-break id pour un ordre stable entre pages
    // (created_at seul suffit côté mock, mais l'index (user_id, created_at DESC)
    // n'impose pas d'ordre entre ex æquo : on stabilise).
    const res = await query(
      this.pool,
      `SELECT ${SQL_NOTIFICATION_COLUMNS} FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC, id
        LIMIT $2 OFFSET $3`,
      [userId, params.limit, params.offset],
    );
    return res.rows.map(rowToNotification);
  }

  async markRead(id: string): Promise<void> {
    // Idempotent : ne repositionne readAt que s'il est encore NULL (préserve
    // l'horodatage de première lecture) — miroir exact du mock.
    await query(
      this.pool,
      `UPDATE notifications SET read_at = now() WHERE id = $1 AND read_at IS NULL`,
      [id],
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await query(
      this.pool,
      `UPDATE notifications SET read_at = now()
        WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
  }

  async unreadCount(userId: string): Promise<number> {
    const res = await query<{ count: string }>(
      this.pool,
      `SELECT count(*)::int AS count FROM notifications
        WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return Number(res.rows[0].count);
  }
}

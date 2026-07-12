/**
 * PostgresConversationsRepository — implémentation SQL de
 * ConversationsRepository (Lot 2 — CP2.3).
 *
 * Parité STRICTE avec MockConversationsRepository (mock/mock-repositories.ts) :
 * mêmes contrôles structurels et messages d'erreur (FK annonce/participants,
 * participants distincts, unicité (listing, initiateur), conversation
 * introuvable), même tri des listes (activité décroissante =
 * COALESCE(last_message_at, created_at) DESC, tie-break id), mêmes définitions
 * de « non lu » (message de l'AUTRE participant postérieur à MON jalon de
 * lecture — jalon NULL = tout est non lu), lectures PAR LOT anti N+1,
 * `createMessage` ATOMIQUE (INSERT du message + last_message_at dans une
 * transaction).
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import {
  Conversation,
  Message,
  MessageStatus,
} from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  AdminListConversationsParams,
  ConversationsRepository,
  CreateConversationInput,
  CreateMessageInput,
  PagedResult,
  PageParams,
} from '../../repositories/interfaces';
import {
  query,
  rowToConversation,
  rowToMessage,
  SQL_CONVERSATION_COLUMNS,
  SQL_MESSAGE_COLUMNS,
  withTransaction,
} from '../pg-helpers';

/** Jalon de lecture du participant $n dans une conversation `c` — NULL est
 * remplacé par -infinity : « jamais lu » = tout message est postérieur. */
function lastReadSql(userPlaceholder: string): string {
  return `COALESCE(
    CASE WHEN c.initiator_id = ${userPlaceholder}
         THEN c.initiator_last_read_at
         ELSE c.owner_last_read_at END,
    '-infinity'::timestamptz)`;
}

@Injectable()
export class PostgresConversationsRepository
  implements ConversationsRepository
{
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<Conversation | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_CONVERSATION_COLUMNS} FROM conversations c WHERE c.id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToConversation(rows[0]) : null;
  }

  async findByListingAndInitiator(
    listingId: string,
    initiatorId: string,
  ): Promise<Conversation | null> {
    // (listing_id, initiator_id) est UNIQUE : au plus une ligne.
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_CONVERSATION_COLUMNS}
         FROM conversations c
        WHERE c.listing_id = $1 AND c.initiator_id = $2`,
      [listingId, initiatorId],
    );
    return rows.length > 0 ? rowToConversation(rows[0]) : null;
  }

  async create(input: CreateConversationInput): Promise<Conversation> {
    // Contrôles structurels AVANT écriture, avec les MÊMES messages que le
    // mock (erreurs claires plutôt que les codes SQL bruts 23503/23505/23514).
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
    for (const userId of [input.initiatorId, input.ownerId]) {
      const user = await query(
        this.pool,
        'SELECT 1 FROM users WHERE id = $1',
        [userId],
      );
      if (user.rowCount === 0) {
        throw new Error(`Utilisateur introuvable : ${userId}.`);
      }
    }
    if (input.initiatorId === input.ownerId) {
      throw new Error(
        'Une conversation exige deux participants distincts (CHECK).',
      );
    }
    if (
      await this.findByListingAndInitiator(input.listingId, input.initiatorId)
    ) {
      throw new Error(
        'Conversation déjà existante pour cette annonce et ce demandeur (contrainte UNIQUE).',
      );
    }

    const { rows } = await query(
      this.pool,
      `INSERT INTO conversations (listing_id, initiator_id, owner_id)
       VALUES ($1, $2, $3)
       RETURNING ${SQL_CONVERSATION_COLUMNS
         .replaceAll('c.', '')
         .replaceAll('\n', ' ')}`,
      [input.listingId, input.initiatorId, input.ownerId],
    );
    return rowToConversation(rows[0]);
  }

  async listByParticipant(
    userId: string,
    params: PageParams,
  ): Promise<PagedResult<Conversation>> {
    // Tri par ACTIVITÉ décroissante (mock : lastMessageAt ?? createdAt),
    // tie-break id — ordre STABLE entre pages.
    const whereSql = `WHERE (c.initiator_id = $1 OR c.owner_id = $1)`;
    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n FROM conversations c ${whereSql}`,
      [userId],
    );
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_CONVERSATION_COLUMNS}
         FROM conversations c
        ${whereSql}
        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id
        LIMIT $2 OFFSET $3`,
      [userId, params.limit, params.offset],
    );
    return {
      items: rows.map(rowToConversation),
      total: Number(totalRes.rows[0].n),
    };
  }

  async countUnreadConversations(userId: string): Promise<number> {
    // Conversations du participant contenant AU MOINS un message non lu
    // (mock : hasUnread par conversation).
    const { rows } = await query(
      this.pool,
      `SELECT count(*)::int AS n
         FROM conversations c
        WHERE (c.initiator_id = $1 OR c.owner_id = $1)
          AND EXISTS (
            SELECT 1 FROM messages m
             WHERE m.conversation_id = c.id
               AND m.sender_id <> $1
               AND m.created_at > ${lastReadSql('$1')}
          )`,
      [userId],
    );
    return Number(rows[0].n);
  }

  async unreadCountsByConversationIds(
    conversationIds: string[],
    userId: string,
  ): Promise<Record<string, number>> {
    // Non-lus PAR conversation EN UN APPEL (anti N+1) ; les conversations
    // sans non-lu sont ABSENTES du résultat (mock). Tableau vide : court-circuit.
    if (conversationIds.length === 0) {
      return {};
    }
    const { rows } = await query(
      this.pool,
      `SELECT m.conversation_id, count(*)::int AS n
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE m.conversation_id = ANY($1)
          AND m.sender_id <> $2
          AND m.created_at > ${lastReadSql('$2')}
        GROUP BY m.conversation_id`,
      [conversationIds, userId],
    );
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.conversation_id as string] = Number(row.n);
    }
    return result;
  }

  async lastMessagesByConversationIds(
    conversationIds: string[],
  ): Promise<Record<string, Message>> {
    // Dernier message PAR conversation EN UN APPEL — DISTINCT ON, tri
    // created_at DESC tie-break id (miroir du mock). Tableau vide : court-circuit.
    if (conversationIds.length === 0) {
      return {};
    }
    const { rows } = await query(
      this.pool,
      `SELECT DISTINCT ON (m.conversation_id) ${SQL_MESSAGE_COLUMNS}
         FROM messages m
        WHERE m.conversation_id = ANY($1)
        ORDER BY m.conversation_id, m.created_at DESC, m.id`,
      [conversationIds],
    );
    const result: Record<string, Message> = {};
    for (const row of rows) {
      result[row.conversation_id as string] = rowToMessage(row);
    }
    return result;
  }

  async markRead(
    conversationId: string,
    userId: string,
    at: Date,
  ): Promise<void> {
    // Pose le jalon du BON participant (mock : initiator sinon owner).
    // L'appartenance a déjà été vérifiée par le service.
    const { rowCount } = await query(
      this.pool,
      `UPDATE conversations c
          SET initiator_last_read_at = CASE WHEN c.initiator_id = $2 THEN $3
                                            ELSE c.initiator_last_read_at END,
              owner_last_read_at     = CASE WHEN c.initiator_id = $2 THEN c.owner_last_read_at
                                            ELSE $3 END
        WHERE c.id = $1`,
      [conversationId, userId, at],
    );
    if (rowCount === 0) {
      throw new Error(`Conversation introuvable : ${conversationId}.`);
    }
  }

  async createMessage(input: CreateMessageInput): Promise<Message> {
    // Mêmes pré-contrôles/messages que le mock.
    const conversation = await query(
      this.pool,
      'SELECT 1 FROM conversations WHERE id = $1',
      [input.conversationId],
    );
    if (conversation.rowCount === 0) {
      throw new Error(`Conversation introuvable : ${input.conversationId}.`);
    }
    const sender = await query(
      this.pool,
      'SELECT 1 FROM users WHERE id = $1',
      [input.senderId],
    );
    if (sender.rowCount === 0) {
      throw new Error(`Utilisateur introuvable : ${input.senderId}.`);
    }

    // INSERT du message + last_message_at posé ATOMIQUEMENT (décision D63 :
    // seul horodatage dénormalisé à l'écriture, même transaction).
    return withTransaction(this.pool, async (client) => {
      const inserted = await client.query(
        `INSERT INTO messages (conversation_id, sender_id, body)
         VALUES ($1, $2, $3)
         RETURNING ${SQL_MESSAGE_COLUMNS
           .replaceAll('m.', '')
           .replaceAll('\n', ' ')}`,
        [input.conversationId, input.senderId, input.body],
      );
      const message = rowToMessage(inserted.rows[0]);
      await client.query(
        `UPDATE conversations SET last_message_at = $2 WHERE id = $1`,
        [input.conversationId, message.createdAt],
      );
      return message;
    });
  }

  async listMessages(
    conversationId: string,
    params: PageParams,
  ): Promise<PagedResult<Message>> {
    // Du PLUS RÉCENT au plus ancien, tie-break id (mock) — le client inverse.
    // Les messages 'hidden' SONT inclus (D67 : pagination et non-lus
    // inchangés, le corps est remplacé par le SERVICE pour les participants).
    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n FROM messages m WHERE m.conversation_id = $1`,
      [conversationId],
    );
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_MESSAGE_COLUMNS}
         FROM messages m
        WHERE m.conversation_id = $1
        ORDER BY m.created_at DESC, m.id
        LIMIT $2 OFFSET $3`,
      [conversationId, params.limit, params.offset],
    );
    return {
      items: rows.map(rowToMessage),
      total: Number(totalRes.rows[0].n),
    };
  }

  // ── Backoffice (CP2.5 — D67) ───────────────────────────────────────────────

  async listAdmin(
    params: AdminListConversationsParams,
  ): Promise<PagedResult<Conversation>> {
    // TOUTES les conversations, même tri par ACTIVITÉ que listByParticipant
    // (mock : lastMessageAt ?? createdAt DESC, tie-break id). Recherche
    // insensible à la casse sur le nom affiché d'un participant ou le titre
    // de l'annonce liée (JOIN users ×2 + listings — miroir du mock).
    const conditions: string[] = [];
    const values: unknown[] = [];
    let n = 1;
    if (params.search !== undefined && params.search.trim() !== '') {
      conditions.push(
        `(ui.display_name ILIKE $${n} OR uo.display_name ILIKE $${n} OR l.title ILIKE $${n})`,
      );
      values.push(`%${params.search.trim()}%`);
      n++;
    }
    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromSql = `
         FROM conversations c
         JOIN users ui ON ui.id = c.initiator_id
         JOIN users uo ON uo.id = c.owner_id
         JOIN listings l ON l.id = c.listing_id`;
    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n ${fromSql} ${whereSql}`,
      values,
    );
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_CONVERSATION_COLUMNS}
        ${fromSql}
        ${whereSql}
        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id
        LIMIT $${n} OFFSET $${n + 1}`,
      [...values, params.limit, params.offset],
    );
    return {
      items: rows.map(rowToConversation),
      total: Number(totalRes.rows[0].n),
    };
  }

  async findMessageById(id: string): Promise<Message | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_MESSAGE_COLUMNS} FROM messages m WHERE m.id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToMessage(rows[0]) : null;
  }

  async setMessageStatus(id: string, status: MessageStatus): Promise<Message> {
    // Idempotent — reposer le même statut est sans effet (même message
    // d'erreur que le mock si le message n'existe pas).
    const { rows } = await query(
      this.pool,
      `UPDATE messages SET status = $2
        WHERE id = $1
        RETURNING ${SQL_MESSAGE_COLUMNS
          .replaceAll('m.', '')
          .replaceAll('\n', ' ')}`,
      [id, status],
    );
    if (rows.length === 0) {
      throw new Error(`Message introuvable : ${id}.`);
    }
    return rowToMessage(rows[0]);
  }
}

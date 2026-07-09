/**
 * PostgresReactionsRepository — implémentation SQL de ReactionsRepository.
 *
 * Comportement OBSERVABLE identique au driver mock (mock-repositories.ts,
 * MockReactionsRepository) :
 *  - listActiveTypes lit la palette pilotable (reaction_types, is_active) triée
 *    par position — la validation des emojis passe TOUJOURS par cette table ;
 *  - upsert reproduit la contrainte UNIQUE (user_id, target_type, target_id) via
 *    INSERT ... ON CONFLICT DO UPDATE SET emoji : changer d'emoji = update de la
 *    ligne existante (created_at conservé), pas de doublon. Les pré-contrôles
 *    (utilisateur existant, emoji connu) et leurs messages sont ceux du mock ;
 *  - remove est idempotent ;
 *  - listByTarget / listByUser sont antéchronologiques (tie-break `id` stable) ;
 *  - countsByEmoji / countsByEmojiForTargets / findViewerReactions agrègent en
 *    UNE requête (évite les N+1) ; les cibles sans réaction sont absentes.
 *
 * Les compteurs dénormalisés des cibles (reactionCount d'un post/commentaire)
 * ne sont PAS maintenus ici : ils sont recalculés à la lecture par les repos
 * Posts/Comments. SQL BRUT paramétré ($1, $2, ...).
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import {
  Reaction,
  ReactionTargetType,
  ReactionType,
} from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import { ReactionsRepository } from '../../repositories/interfaces';
import { query, rowToReaction, rowToReactionType } from '../pg-helpers';

/** Colonnes de `reactions` consommées par rowToReaction. */
const SQL_REACTION_COLUMNS = `
  id,
  user_id,
  target_type,
  target_id,
  emoji,
  created_at
`.trim();

@Injectable()
export class PostgresReactionsRepository implements ReactionsRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async listActiveTypes(): Promise<ReactionType[]> {
    // Palette pilotable par le backoffice (table reaction_types) : la validation
    // des emojis passe TOUJOURS par ici. Triée par position ; tie-break `emoji`
    // pour un ordre stable.
    const result = await query(
      this.pool,
      `SELECT emoji, label_fr, position, is_active
         FROM reaction_types
        WHERE is_active
        ORDER BY position ASC, emoji ASC`,
    );
    return result.rows.map(rowToReactionType);
  }

  async upsert(
    userId: string,
    targetType: ReactionTargetType,
    targetId: string,
    emoji: string,
  ): Promise<Reaction> {
    // Pré-contrôles miroir du mock (messages identiques). La FK
    // reactions.user_id → users et la FK emoji → reaction_types les
    // garantiraient aussi, mais on les explicite pour reproduire les messages.
    const user = await query(this.pool, `SELECT 1 FROM users WHERE id = $1`, [
      userId,
    ]);
    if (user.rowCount === 0) {
      throw new Error(`Utilisateur introuvable : ${userId}.`);
    }
    const type = await query(
      this.pool,
      `SELECT 1 FROM reaction_types WHERE emoji = $1`,
      [emoji],
    );
    if (type.rowCount === 0) {
      throw new Error(
        `Réaction inconnue : « ${emoji} » (FK reaction_types — palette pilotée par le backoffice).`,
      );
    }

    // UNIQUE (user_id, target_type, target_id) : une seule réaction par cible.
    // Changer d'emoji = UPDATE de la ligne existante (created_at inchangé, car
    // on ne touche que `emoji`) — miroir exact du mock.
    const result = await query(
      this.pool,
      `INSERT INTO reactions (user_id, target_type, target_id, emoji)
            VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, target_type, target_id)
       DO UPDATE SET emoji = EXCLUDED.emoji
         RETURNING ${SQL_REACTION_COLUMNS}`,
      [userId, targetType, targetId, emoji],
    );
    return rowToReaction(result.rows[0]);
  }

  async remove(
    userId: string,
    targetType: ReactionTargetType,
    targetId: string,
  ): Promise<void> {
    // Idempotent : supprimer une réaction inexistante ne fait rien.
    await query(
      this.pool,
      `DELETE FROM reactions
        WHERE user_id = $1 AND target_type = $2 AND target_id = $3`,
      [userId, targetType, targetId],
    );
  }

  async listByTarget(
    targetType: ReactionTargetType,
    targetId: string,
  ): Promise<Reaction[]> {
    // Antéchronologique ; tie-break `id` pour un ordre stable.
    const result = await query(
      this.pool,
      `SELECT ${SQL_REACTION_COLUMNS}
         FROM reactions
        WHERE target_type = $1 AND target_id = $2
        ORDER BY created_at DESC, id ASC`,
      [targetType, targetId],
    );
    return result.rows.map(rowToReaction);
  }

  async listByUser(userId: string): Promise<Reaction[]> {
    // Export RGPD : toutes les réactions émises par l'utilisateur,
    // antéchronologiques ; tie-break `id` pour un ordre stable.
    const result = await query(
      this.pool,
      `SELECT ${SQL_REACTION_COLUMNS}
         FROM reactions
        WHERE user_id = $1
        ORDER BY created_at DESC, id ASC`,
      [userId],
    );
    return result.rows.map(rowToReaction);
  }

  async countsByEmoji(
    targetType: ReactionTargetType,
    targetId: string,
  ): Promise<Record<string, number>> {
    // Agrégat { emoji → nombre } pour l'affichage des compteurs par emoji.
    const result = await query<{ emoji: string; n: string }>(
      this.pool,
      `SELECT emoji, count(*) AS n
         FROM reactions
        WHERE target_type = $1 AND target_id = $2
        GROUP BY emoji`,
      [targetType, targetId],
    );
    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.emoji] = Number(row.n);
    }
    return counts;
  }

  async countsByEmojiForTargets(
    targetType: ReactionTargetType,
    targetIds: string[],
  ): Promise<Record<string, Record<string, number>>> {
    // Agrégat PAR LOT (reactionsTop d'une page de feed) : un seul GROUP BY
    // target_id, emoji. Les cibles sans réaction sont absentes du résultat.
    const result: Record<string, Record<string, number>> = {};
    if (targetIds.length === 0) {
      return result;
    }
    const rows = await query<{ target_id: string; emoji: string; n: string }>(
      this.pool,
      `SELECT target_id, emoji, count(*) AS n
         FROM reactions
        WHERE target_type = $1 AND target_id = ANY($2)
        GROUP BY target_id, emoji`,
      [targetType, targetIds],
    );
    for (const row of rows.rows) {
      const counts = (result[row.target_id] ??= {});
      counts[row.emoji] = Number(row.n);
    }
    return result;
  }

  async findViewerReactions(
    userId: string,
    targetType: ReactionTargetType,
    targetIds: string[],
  ): Promise<Record<string, string>> {
    // Réactions du viewer PAR LOT (viewerReaction d'une page de feed) :
    // { targetId → emoji }. Les cibles non réagies sont absentes. La contrainte
    // UNIQUE (user_id, target_type, target_id) garantit au plus une ligne/cible.
    const result: Record<string, string> = {};
    if (targetIds.length === 0) {
      return result;
    }
    const rows = await query<{ target_id: string; emoji: string }>(
      this.pool,
      `SELECT target_id, emoji
         FROM reactions
        WHERE user_id = $1 AND target_type = $2 AND target_id = ANY($3)`,
      [userId, targetType, targetIds],
    );
    for (const row of rows.rows) {
      result[row.target_id] = row.emoji;
    }
    return result;
  }
}

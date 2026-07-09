/**
 * PostgresCommentsRepository — implémentation SQL de CommentsRepository.
 *
 * Comportement OBSERVABLE identique au driver mock (mock-repositories.ts,
 * MockCommentsRepository) :
 *  - reactionCount est CALCULÉ À LA LECTURE via une sous-requête corrélée sur
 *    reactions (target_type='comment') — jamais maintenu à l'écriture ;
 *  - listByPost / listByAuthor trient par created_at croissant (fils de
 *    commentaires / export RGPD), tie-break `id` pour un ordre STABLE ;
 *  - create applique l'OPTION A (profondeur ≤ 1) avec des messages d'erreur
 *    identiques AU CARACTÈRE PRÈS à ceux du mock : la depth est calculée depuis
 *    le parent (0 = commentaire principal, 1 = réponse), et toute réponse à une
 *    réponse est refusée ;
 *  - setStatus s'appuie sur le trigger comments_set_updated_at pour updated_at.
 *
 * SQL BRUT paramétré ($1, $2, ...) — aucune interpolation de valeur.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { Comment, CommentStatus } from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  CommentsRepository,
  CreateCommentInput,
} from '../../repositories/interfaces';
import { query, rowToComment, withTransaction } from '../pg-helpers';

/**
 * Colonnes de `comments` (alias de table `c`) + reactionCount calculé à la
 * lecture. La sous-requête corrélée compte les réactions dont la cible est CE
 * commentaire (target_type='comment') — miroir EXACT de
 * recomputeCommentCounters du mock (toutes les réactions, sans filtre de
 * statut). `reaction_count` est consommé tel quel par rowToComment.
 */
const SQL_COMMENT_SELECT = `
  c.id,
  c.post_id,
  c.author_id,
  c.parent_comment_id,
  c.depth,
  c.body,
  c.status,
  (
    SELECT count(*)
    FROM reactions r
    WHERE r.target_type = 'comment' AND r.target_id = c.id
  ) AS reaction_count,
  c.created_at,
  c.updated_at
`.trim();

@Injectable()
export class PostgresCommentsRepository implements CommentsRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<Comment | null> {
    const result = await query(
      this.pool,
      `SELECT ${SQL_COMMENT_SELECT} FROM comments c WHERE c.id = $1`,
      [id],
    );
    return result.rows.length > 0 ? rowToComment(result.rows[0]) : null;
  }

  async listByPost(postId: string): Promise<Comment[]> {
    // Tous les commentaires d'un post, du plus ancien au plus récent (miroir de
    // l'index (post_id, created_at)). Tie-break `id` pour un ordre stable.
    const result = await query(
      this.pool,
      `SELECT ${SQL_COMMENT_SELECT}
         FROM comments c
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC, c.id ASC`,
      [postId],
    );
    return result.rows.map(rowToComment);
  }

  async listByAuthor(authorId: string): Promise<Comment[]> {
    // Export RGPD : tous les commentaires de l'auteur (tous statuts),
    // chronologiques. Tie-break `id` pour un ordre stable.
    const result = await query(
      this.pool,
      `SELECT ${SQL_COMMENT_SELECT}
         FROM comments c
        WHERE c.author_id = $1
        ORDER BY c.created_at ASC, c.id ASC`,
      [authorId],
    );
    return result.rows.map(rowToComment);
  }

  async create(input: CreateCommentInput): Promise<Comment> {
    const parentCommentId = input.parentCommentId ?? null;

    // Écriture multi-étapes (contrôles FK + calcul de depth + INSERT) dans une
    // TRANSACTION : l'insertion voit un état cohérent du parent et du post.
    return withTransaction(this.pool, async (client) => {
      // FK author_id → users (message miroir du mock, contrôlé explicitement
      // pour ne pas dépendre de l'ordre des contraintes SQL).
      const post = await client.query(
        `SELECT id FROM posts WHERE id = $1`,
        [input.postId],
      );
      if (post.rowCount === 0) {
        throw new Error(`Publication introuvable : ${input.postId}.`);
      }
      const author = await client.query(
        `SELECT id FROM users WHERE id = $1`,
        [input.authorId],
      );
      if (author.rowCount === 0) {
        throw new Error(`Auteur introuvable : ${input.authorId}.`);
      }

      let depth: 0 | 1 = 0;
      if (parentCommentId !== null) {
        const parent = await client.query<{
          post_id: string;
          parent_comment_id: string | null;
        }>(
          `SELECT post_id, parent_comment_id FROM comments WHERE id = $1`,
          [parentCommentId],
        );
        if (parent.rowCount === 0) {
          throw new Error(
            `Commentaire parent introuvable : ${parentCommentId}.`,
          );
        }
        const parentRow = parent.rows[0];
        if (parentRow.post_id !== input.postId) {
          throw new Error(
            'Le commentaire parent appartient à une autre publication.',
          );
        }
        // Option A (décision produit validée) : depth 0 = commentaire principal,
        // depth 1 = réponse. On REFUSE toute réponse à une réponse au Lot 1.
        if (parentRow.parent_comment_id !== null) {
          throw new Error(
            'Impossible de répondre à une réponse : la profondeur des commentaires ' +
              'est limitée à 1 au Lot 1 (option A — répondre au commentaire principal).',
          );
        }
        depth = 1;
      }

      // status/reaction_count laissés aux valeurs par défaut du schéma ; la
      // sous-requête relira reaction_count = 0 pour un commentaire neuf.
      const inserted = await client.query(
        `INSERT INTO comments (post_id, author_id, parent_comment_id, depth, body)
              VALUES ($1, $2, $3, $4, $5)
           RETURNING
             id,
             post_id,
             author_id,
             parent_comment_id,
             depth,
             body,
             status,
             (
               SELECT count(*)
               FROM reactions r
               WHERE r.target_type = 'comment' AND r.target_id = comments.id
             ) AS reaction_count,
             created_at,
             updated_at`,
        [input.postId, input.authorId, parentCommentId, depth, input.body],
      );
      return rowToComment(inserted.rows[0]);
    });
  }

  async setStatus(id: string, status: CommentStatus): Promise<Comment> {
    // updated_at est posé par le trigger comments_set_updated_at (BEFORE UPDATE).
    const result = await query(
      this.pool,
      `UPDATE comments
          SET status = $2
        WHERE id = $1
      RETURNING
        id,
        post_id,
        author_id,
        parent_comment_id,
        depth,
        body,
        status,
        (
          SELECT count(*)
          FROM reactions r
          WHERE r.target_type = 'comment' AND r.target_id = comments.id
        ) AS reaction_count,
        created_at,
        updated_at`,
      [id, status],
    );
    if (result.rows.length === 0) {
      throw new Error(`Commentaire introuvable : ${id}.`);
    }
    return rowToComment(result.rows[0]);
  }
}

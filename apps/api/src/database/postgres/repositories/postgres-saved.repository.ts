/**
 * PostgresSavedRepository — implémentation SQL de SavedRepository.
 *
 * Parité stricte avec MockSavedRepository (mock/mock-repositories.ts) :
 * - getOrCreateDefaultCollection : une seule collection is_default par user
 *   (index UNIQUE partiel saved_collections_owner_default_key) ; concurrence
 *   gérée par ON CONFLICT DO NOTHING puis relecture ;
 * - save : idempotent (PK (collection_id, post_id) → ON CONFLICT DO NOTHING) ;
 * - listSavedPosts : posts d'une collection, du plus récemment sauvegardé au
 *   plus ancien (saved_posts.created_at DESC), sans filtre de statut ;
 * - listSavedPostsByUser : PagedResult toutes collections, plus récent d'abord,
 *   SEULS les posts 'active' dans items ET total, dédoublonné par post.
 *
 * Les Post retournés portent les compteurs dénormalisés CALCULÉS À LA LECTURE
 * (sous-requêtes) — même sémantique que la spec Posts et que recomputePostCounters
 * du mock : reactionCount = réactions de la cible ; commentCount = commentaires
 * 'active' ; saveCount = lignes saved_posts.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { Post, SavedCollection } from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  PagedResult,
  PageParams,
  SavedRepository,
} from '../../repositories/interfaces';
import {
  query,
  rowToPost,
  rowToSavedCollection,
  SQL_POST_COLUMNS,
  withTransaction,
} from '../pg-helpers';

/** Nom de la collection de sauvegarde créée par défaut (miroir du mock). */
const DEFAULT_COLLECTION_NAME = 'Général';

/**
 * Sous-requêtes de compteurs dénormalisés d'un post (alias de table `p`),
 * calculées à la lecture — même sémantique que recomputePostCounters du mock.
 * `share_count` reste une colonne de base (exposée par SQL_POST_COLUMNS).
 */
const SQL_POST_COUNTERS = `
  (SELECT count(*) FROM reactions r
     WHERE r.target_type = 'post' AND r.target_id = p.id) AS reaction_count,
  (SELECT count(*) FROM comments cm
     WHERE cm.post_id = p.id AND cm.status = 'active') AS comment_count,
  (SELECT count(*) FROM saved_posts sp
     WHERE sp.post_id = p.id) AS save_count
`.trim();

@Injectable()
export class PostgresSavedRepository implements SavedRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  /**
   * Retourne la collection par défaut « Général » du propriétaire, en la
   * créant si absente. Une seule par user (index UNIQUE partiel WHERE
   * is_default) : la création passe par ON CONFLICT DO NOTHING pour absorber
   * une éventuelle course, puis on relit la ligne existante. Tout se joue dans
   * une transaction pour rester cohérent sous concurrence.
   */
  async getOrCreateDefaultCollection(
    ownerId: string,
  ): Promise<SavedCollection> {
    return withTransaction(this.pool, async (client) => {
      // Le mock lève « Utilisateur introuvable » si l'owner n'existe pas
      // (miroir de la FK owner_id → users). On reproduit le message exact.
      const owner = await client.query(
        'SELECT 1 FROM users WHERE id = $1',
        [ownerId],
      );
      if (owner.rowCount === 0) {
        throw new Error(`Utilisateur introuvable : ${ownerId}.`);
      }

      // Collection is_default déjà présente ?
      const existing = await client.query(
        `SELECT id, owner_id, name, is_default, created_at
           FROM saved_collections
          WHERE owner_id = $1 AND is_default = true
          LIMIT 1`,
        [ownerId],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        return rowToSavedCollection(existing.rows[0]);
      }

      // Création idempotente : si une requête concurrente vient de créer la
      // collection par défaut, l'index UNIQUE partiel déclenche ON CONFLICT
      // DO NOTHING (aucune ligne renvoyée), et la relecture ci-dessous la sert.
      const inserted = await client.query(
        `INSERT INTO saved_collections (owner_id, name, is_default)
              VALUES ($1, $2, true)
         ON CONFLICT (owner_id) WHERE is_default DO NOTHING
           RETURNING id, owner_id, name, is_default, created_at`,
        [ownerId, DEFAULT_COLLECTION_NAME],
      );
      if (inserted.rowCount && inserted.rowCount > 0) {
        return rowToSavedCollection(inserted.rows[0]);
      }

      // Course perdue : la collection existe désormais, on la relit.
      const reread = await client.query(
        `SELECT id, owner_id, name, is_default, created_at
           FROM saved_collections
          WHERE owner_id = $1 AND is_default = true
          LIMIT 1`,
        [ownerId],
      );
      return rowToSavedCollection(reread.rows[0]);
    });
  }

  /**
   * Collections d'un propriétaire : la collection par défaut d'abord, puis les
   * autres par ancienneté (created_at ASC) — tri identique au mock.
   */
  async listCollections(ownerId: string): Promise<SavedCollection[]> {
    const result = await query(
      this.pool,
      `SELECT id, owner_id, name, is_default, created_at
         FROM saved_collections
        WHERE owner_id = $1
        ORDER BY is_default DESC, created_at ASC`,
      [ownerId],
    );
    return result.rows.map(rowToSavedCollection);
  }

  /**
   * Idempotent : PK (collection_id, post_id) + ON CONFLICT DO NOTHING. Comme le
   * mock, on vérifie d'abord l'existence de la collection et du post (FK) pour
   * lever les mêmes messages d'erreur.
   */
  async save(collectionId: string, postId: string): Promise<void> {
    const collection = await query(
      this.pool,
      'SELECT 1 FROM saved_collections WHERE id = $1',
      [collectionId],
    );
    if (collection.rowCount === 0) {
      throw new Error(`Collection introuvable : ${collectionId}.`);
    }
    const post = await query(this.pool, 'SELECT 1 FROM posts WHERE id = $1', [
      postId,
    ]);
    if (post.rowCount === 0) {
      throw new Error(`Publication introuvable : ${postId}.`);
    }
    await query(
      this.pool,
      `INSERT INTO saved_posts (collection_id, post_id)
            VALUES ($1, $2)
       ON CONFLICT (collection_id, post_id) DO NOTHING`,
      [collectionId, postId],
    );
  }

  /** Retire un post d'une collection (no-op si absent — comme le mock). */
  async unsave(collectionId: string, postId: string): Promise<void> {
    await query(
      this.pool,
      'DELETE FROM saved_posts WHERE collection_id = $1 AND post_id = $2',
      [collectionId, postId],
    );
  }

  /**
   * Posts d'une collection, du plus récemment sauvegardé au plus ancien
   * (saved_posts.created_at DESC). Comme le mock, AUCUN filtre de statut ici :
   * on sert tous les posts encore présents (l'ON DELETE CASCADE de saved_posts
   * garantit qu'un post supprimé physiquement ne laisse pas de lien orphelin ;
   * un post seulement 'hidden'/'deleted' reste servi, miroir du mock).
   */
  async listSavedPosts(collectionId: string): Promise<Post[]> {
    const result = await query(
      this.pool,
      `SELECT ${SQL_POST_COLUMNS},
              ${SQL_POST_COUNTERS}
         FROM saved_posts sp
         JOIN posts p ON p.id = sp.post_id
        WHERE sp.collection_id = $1
        ORDER BY sp.created_at DESC`,
      [collectionId],
    );
    return result.rows.map(rowToPost);
  }

  /**
   * Page des posts enregistrés par un utilisateur, TOUTES collections
   * confondues, du plus récemment enregistré au plus ancien. Seuls les posts
   * encore 'active' comptent (exclus de items ET de total). Dédoublonné par
   * post : un même post enregistré dans plusieurs collections (lots futurs)
   * n'apparaît qu'une fois, à sa sauvegarde la plus récente.
   */
  async listSavedPostsByUser(
    userId: string,
    params: PageParams,
  ): Promise<PagedResult<Post>> {
    // On agrège d'abord, par post, la date de sauvegarde la PLUS récente parmi
    // les collections de l'utilisateur (dédoublonnage), en ne gardant que les
    // posts 'active'. Le tri antéchronologique porte sur cette date agrégée ;
    // tie-break p.id pour un ordre stable entre deux pages.
    const base = `
      FROM saved_posts sp
      JOIN saved_collections sc ON sc.id = sp.collection_id
      JOIN posts p ON p.id = sp.post_id
     WHERE sc.owner_id = $1 AND p.status = 'active'
    `;

    const totalResult = await query(
      this.pool,
      `SELECT count(DISTINCT p.id) AS total ${base}`,
      [userId],
    );
    const total = Number(totalResult.rows[0]?.total ?? 0);

    const result = await query(
      this.pool,
      `SELECT ${SQL_POST_COLUMNS},
              ${SQL_POST_COUNTERS},
              max(sp.created_at) AS saved_at
         ${base}
        GROUP BY p.id
        ORDER BY saved_at DESC, p.id
        LIMIT $2 OFFSET $3`,
      [userId, params.limit, params.offset],
    );
    return { items: result.rows.map(rowToPost), total };
  }

  /** Le post est-il enregistré dans AU MOINS une collection de l'utilisateur ? */
  async isSaved(userId: string, postId: string): Promise<boolean> {
    const result = await query(
      this.pool,
      `SELECT 1
         FROM saved_posts sp
         JOIN saved_collections sc ON sc.id = sp.collection_id
        WHERE sc.owner_id = $1 AND sp.post_id = $2
        LIMIT 1`,
      [userId, postId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Filtre PAR LOT (viewerSaved d'une page de feed) : parmi `postIds`, ceux
   * enregistrés dans une collection de l'utilisateur — une seule requête
   * (WHERE post_id = ANY($2)).
   */
  async filterSavedPostIds(
    userId: string,
    postIds: string[],
  ): Promise<string[]> {
    if (postIds.length === 0) {
      return [];
    }
    const result = await query<{ post_id: string }>(
      this.pool,
      `SELECT DISTINCT sp.post_id
         FROM saved_posts sp
         JOIN saved_collections sc ON sc.id = sp.collection_id
        WHERE sc.owner_id = $1 AND sp.post_id = ANY($2::uuid[])`,
      [userId, postIds],
    );
    return result.rows.map((row) => row.post_id);
  }
}

/**
 * PostgresPostsRepository — implémentation SQL de PostsRepository.
 *
 * Parité STRICTE avec MockPostsRepository (mock/mock-repositories.ts) :
 * mêmes tris, filtres, pagination, idempotence, messages d'erreur et règles.
 *
 * Compteurs DÉNORMALISÉS calculés À LA LECTURE par sous-requêtes corrélées
 * (jamais maintenus à l'écriture) — sémantique reprise du mock :
 *   - reaction_count : réactions dont target_type = 'post' et target_id = p.id ;
 *   - comment_count  : commentaires du post au statut 'active' ;
 *   - save_count     : lignes saved_posts référençant le post ;
 *   - share_count    : colonne posts.share_count (toujours 0 au Lot 1).
 *
 * Géométrie (voir CONVENTION dans pg-helpers.ts) : lecture via ST_Y/ST_X
 * (fragment SQL_POST_COLUMNS), écriture via ST_SetSRID(ST_MakePoint(lng,lat),4326),
 * bbox via ST_MakeEnvelope(minLng,minLat,maxLng,maxLat,4326) && location.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { Post, PostMedia, PostStatus } from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  AdminListPostsParams,
  CreatePostInput,
  ListAuthorPostsParams,
  ListFeedParams,
  ListMapMarkersParams,
  PagedResult,
  PostsRepository,
  UpdatePostPatch,
} from '../../repositories/interfaces';
import {
  query,
  rowToPost,
  rowToPostMedia,
  SQL_POST_COLUMNS,
  withTransaction,
} from '../pg-helpers';

/**
 * Sous-requêtes corrélées des compteurs dénormalisés (alias de table `p`).
 * Calculés À LA LECTURE : aucun compteur n'est maintenu à l'écriture, on
 * reproduit ainsi la sémantique EXACTE du mock (recomptage systématique).
 */
const SQL_POST_COUNTERS = `
  (SELECT count(*) FROM reactions r
     WHERE r.target_type = 'post' AND r.target_id = p.id) AS reaction_count,
  (SELECT count(*) FROM comments c
     WHERE c.post_id = p.id AND c.status = 'active') AS comment_count,
  (SELECT count(*) FROM saved_posts sp
     WHERE sp.post_id = p.id) AS save_count
`.trim();

/**
 * Liste de colonnes complète d'un post pour un SELECT dans `posts p` :
 * colonnes de base (fragment partagé) + compteurs calculés à la lecture.
 * `share_count` est déjà exposé par SQL_POST_COLUMNS (colonne réelle).
 */
const SQL_POST_SELECTION = `${SQL_POST_COLUMNS},\n  ${SQL_POST_COUNTERS}`;

@Injectable()
export class PostgresPostsRepository implements PostsRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<Post | null> {
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_POST_SELECTION} FROM posts p WHERE p.id = $1`,
      [id],
    );
    return rows.length > 0 ? rowToPost(rows[0]) : null;
  }

  async findByUrlSlug(urlSlug: string): Promise<Post | null> {
    // url_slug est UNIQUE : au plus une ligne.
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_POST_SELECTION} FROM posts p WHERE p.url_slug = $1`,
      [urlSlug],
    );
    return rows.length > 0 ? rowToPost(rows[0]) : null;
  }

  async create(input: CreatePostInput): Promise<Post> {
    // Contrôles de cohérence AVANT écriture, avec les MÊMES messages que le
    // mock (FK author_id, FK type_slug, UNIQUE url_slug). On les vérifie
    // explicitement pour produire une erreur claire en français plutôt que
    // de laisser remonter l'erreur SQL brute (23503 / 23505).
    const author = await query(
      this.pool,
      'SELECT 1 FROM users WHERE id = $1',
      [input.authorId],
    );
    if (author.rowCount === 0) {
      throw new Error(`Auteur introuvable : ${input.authorId}.`);
    }
    const type = await query(
      this.pool,
      'SELECT 1 FROM post_types WHERE slug = $1',
      [input.typeSlug],
    );
    if (type.rowCount === 0) {
      throw new Error(
        `Type de publication inconnu : « ${input.typeSlug} » (FK post_types).`,
      );
    }
    if (await this.findByUrlSlug(input.urlSlug)) {
      throw new Error(
        `url_slug déjà utilisé : « ${input.urlSlug} » (contrainte UNIQUE).`,
      );
    }
    if (input.pageId != null) {
      // FK pages (Lot 3 — D73) : même message que le mock.
      const page = await query(this.pool, 'SELECT 1 FROM pages WHERE id = $1', [
        input.pageId,
      ]);
      if (page.rowCount === 0) {
        throw new Error(`Page introuvable : ${input.pageId} (FK pages).`);
      }
    }

    const location = input.location ?? null;

    // Post + médias créés ATOMIQUEMENT (équivalent transaction du mock).
    const post = await withTransaction(this.pool, async (client) => {
      // Placeholders calculés au fil des params (la géométrie est optionnelle :
      // lng/lat ne sont poussés que si location non nulle — pattern seeder).
      const insertParams: unknown[] = [
        input.authorId,
        input.pageId ?? null,
        input.typeSlug,
        input.title ?? null,
        input.body,
        input.city ?? null,
      ];
      // location écrite via ST_SetSRID(ST_MakePoint(lng, lat), 4326) — ORDRE
      // longitude d'abord ; NULL si absente (post feed-only).
      let locationSql = 'NULL';
      if (location !== null) {
        insertParams.push(location.lng, location.lat);
        locationSql = `ST_SetSRID(ST_MakePoint($${insertParams.length - 1}, $${insertParams.length}), 4326)`;
      }
      insertParams.push(input.urlSlug);
      const slugPh = `$${insertParams.length}`;
      insertParams.push(input.mapExpiresAt ?? null);
      const mapExpPh = `$${insertParams.length}`;
      insertParams.push(input.mapVisibleFrom ?? null);
      const mapFromPh = `$${insertParams.length}`;

      const inserted = await client.query(
        `INSERT INTO posts (
           author_id, page_id, type_slug, title, body, city,
           location, url_slug, map_expires_at, map_visible_from,
           visibility, status
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           ${locationSql}, ${slugPh}, ${mapExpPh}, ${mapFromPh},
           'public', 'active'
         )
         RETURNING id`,
        insertParams,
      );
      const postId = inserted.rows[0].id as string;

      // Médias : position par défaut = index dans le tableau fourni (mock).
      const media = input.media ?? [];
      for (let index = 0; index < media.length; index++) {
        const spec = media[index];
        await client.query(
          `INSERT INTO post_media (
             post_id, media_type, url, thumbnail_url, width, height, position
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            postId,
            spec.mediaType,
            spec.url,
            spec.thumbnailUrl ?? null,
            spec.width ?? null,
            spec.height ?? null,
            spec.position ?? index,
          ],
        );
      }

      // Relecture du post inséré (lat/lng recalculés + compteurs à 0).
      return this.selectByIdInClient(client, postId);
    });

    return post;
  }

  async update(id: string, patch: UpdatePostPatch): Promise<Post> {
    const existing = await this.findById(id);
    if (existing === null) {
      throw new Error(`Publication introuvable : ${id}.`);
    }

    // applyPatch : seules les clés FOURNIES (valeur !== undefined) entrent dans
    // le SET (miroir de la sémantique SQL « colonne absente = inchangée »).
    // `null` reste une valeur légitime (remise à NULL d'une colonne nullable).
    const sets: string[] = [];
    const params: unknown[] = [];
    let n = 1;

    if (patch.title !== undefined) {
      sets.push(`title = $${n++}`);
      params.push(patch.title);
    }
    if (patch.body !== undefined) {
      sets.push(`body = $${n++}`);
      params.push(patch.body);
    }
    if (patch.city !== undefined) {
      sets.push(`city = $${n++}`);
      params.push(patch.city);
    }
    if (patch.mapExpiresAt !== undefined) {
      sets.push(`map_expires_at = $${n++}`);
      params.push(patch.mapExpiresAt);
    }
    if (patch.location !== undefined) {
      // location peut être remise à NULL, ou posée via ST_MakePoint(lng, lat).
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
      // updated_at est géré par le trigger posts_set_updated_at.
      params.push(id);
      await query(
        this.pool,
        `UPDATE posts SET ${sets.join(', ')} WHERE id = $${n}`,
        params,
      );
    }

    // Relecture (compteurs + lat/lng) — le post existe forcément.
    return (await this.findById(id)) as Post;
  }

  async setStatus(id: string, status: PostStatus): Promise<Post> {
    // updated_at via trigger (le mock fait db.touch).
    const { rowCount } = await query(
      this.pool,
      'UPDATE posts SET status = $1 WHERE id = $2',
      [status, id],
    );
    if (rowCount === 0) {
      throw new Error(`Publication introuvable : ${id}.`);
    }
    return (await this.findById(id)) as Post;
  }

  async countByAuthor(authorId: string): Promise<number> {
    // Alimente postsCount des profils : posts 'active' de l'auteur. Les posts
    // de PAGE sont exclus (Lot 3 — D73 : ils vivent sur la page).
    const { rows } = await query(
      this.pool,
      `SELECT count(*) AS n FROM posts
         WHERE author_id = $1 AND page_id IS NULL AND status = 'active'`,
      [authorId],
    );
    return Number(rows[0].n);
  }

  async countByPage(pageId: string): Promise<number> {
    // Publications 'active' d'une PAGE (Lot 3 — D73).
    const { rows } = await query(
      this.pool,
      `SELECT count(*) AS n FROM posts
         WHERE page_id = $1 AND status = 'active'`,
      [pageId],
    );
    return Number(rows[0].n);
  }

  async listByAuthor(authorId: string): Promise<Post[]> {
    // Export RGPD : TOUS les statuts, antéchronologique.
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_POST_SELECTION}
         FROM posts p
        WHERE p.author_id = $1
        ORDER BY p.created_at DESC`,
      [authorId],
    );
    return rows.map(rowToPost);
  }

  async listByAuthorPaged(
    authorId: string,
    params: ListAuthorPostsParams,
  ): Promise<PagedResult<Post>> {
    // Filtre statuts, antéchronologique, tie-break id (ordre STABLE entre
    // deux pages). status = ANY($2) reproduit le Set des statuts du mock.
    // Les posts de PAGE sont exclus des listes de profil (Lot 3 — D73).
    const items = await query(
      this.pool,
      `SELECT ${SQL_POST_SELECTION}
         FROM posts p
        WHERE p.author_id = $1 AND p.page_id IS NULL AND p.status = ANY($2)
        ORDER BY p.created_at DESC, p.id
        LIMIT $3 OFFSET $4`,
      [authorId, params.statuses, params.limit, params.offset],
    );
    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n FROM posts
         WHERE author_id = $1 AND page_id IS NULL AND status = ANY($2)`,
      [authorId, params.statuses],
    );
    return {
      items: items.rows.map(rowToPost),
      total: Number(totalRes.rows[0].n),
    };
  }

  async listByPagePaged(
    pageId: string,
    params: ListAuthorPostsParams,
  ): Promise<PagedResult<Post>> {
    // Publications d'une PAGE (Lot 3 — D73) — même sémantique que
    // listByAuthorPaged (statuts filtrés, antéchronologique, tie-break id).
    const items = await query(
      this.pool,
      `SELECT ${SQL_POST_SELECTION}
         FROM posts p
        WHERE p.page_id = $1 AND p.status = ANY($2)
        ORDER BY p.created_at DESC, p.id
        LIMIT $3 OFFSET $4`,
      [pageId, params.statuses, params.limit, params.offset],
    );
    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n FROM posts
         WHERE page_id = $1 AND status = ANY($2)`,
      [pageId, params.statuses],
    );
    return {
      items: items.rows.map(rowToPost),
      total: Number(totalRes.rows[0].n),
    };
  }

  async listFeed(params: ListFeedParams): Promise<Post[]> {
    // Feed : posts 'active', antéchronologique, curseur beforeCreatedAt
    // (strictement antérieurs), filtres optionnels typeSlugs / authorIds.
    const conditions: string[] = [`p.status = 'active'`];
    const values: unknown[] = [];
    let n = 1;

    if (params.beforeCreatedAt !== undefined) {
      conditions.push(`p.created_at < $${n++}`);
      values.push(params.beforeCreatedAt);
    }
    if (params.typeSlugs !== undefined && params.typeSlugs.length > 0) {
      conditions.push(`p.type_slug = ANY($${n++})`);
      values.push(params.typeSlugs);
    }
    if (params.authorIds !== undefined && params.authorIds.length > 0) {
      conditions.push(`p.author_id = ANY($${n++})`);
      values.push(params.authorIds);
    }

    values.push(params.limit);
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_POST_SELECTION}
         FROM posts p
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.created_at DESC
        LIMIT $${n}`,
      values,
    );
    return rows.map(rowToPost);
  }

  async listActiveWindow(limit: number): Promise<Post[]> {
    // Fenêtre du scoring : N posts 'active' les plus récents, tie-break id
    // pour un ordre STABLE entre deux appels (mock : created_at DESC, id).
    // Les posts d'une page NON ACTIVE sont exclus (Lot 3 — D69 : page
    // masquée = contenus retirés du flux) — miroir de isPageVisible du mock.
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_POST_SELECTION}
         FROM posts p
        WHERE p.status = 'active'
          AND (p.page_id IS NULL OR EXISTS (
                SELECT 1 FROM pages pa
                 WHERE pa.id = p.page_id AND pa.status = 'active'))
        ORDER BY p.created_at DESC, p.id
        LIMIT $1`,
      [limit],
    );
    return rows.map(rowToPost);
  }

  async listMapMarkers(params: ListMapMarkersParams): Promise<Post[]> {
    // Marqueurs carte : status 'active' ET location non nulle ET
    // map_expires_at > now, dans la bbox demandée (toute l'île si absente),
    // filtre catégories = typeSlugs. Antéchronologique (mock : byCreatedAtDesc).
    const conditions: string[] = [
      `p.status = 'active'`,
      `p.location IS NOT NULL`,
      // map_expires_at strictement postérieur à `now` (mock : <= now exclu).
      `p.map_expires_at > $1`,
      // Visibilité différée (Lot 3 — D73) : un post d'événement n'apparaît
      // sur la carte qu'à partir de map_visible_from (J-3).
      `(p.map_visible_from IS NULL OR p.map_visible_from <= $1)`,
      // Page masquée/supprimée = contenus retirés de la carte (Lot 3 — D69).
      `(p.page_id IS NULL OR EXISTS (
          SELECT 1 FROM pages pa
           WHERE pa.id = p.page_id AND pa.status = 'active'))`,
    ];
    const values: unknown[] = [params.now];
    let n = 2;

    if (params.categories !== undefined && params.categories.length > 0) {
      conditions.push(`p.type_slug = ANY($${n++})`);
      values.push(params.categories);
    }
    if (params.bbox !== undefined) {
      // ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326) && location.
      conditions.push(
        `ST_MakeEnvelope($${n}, $${n + 1}, $${n + 2}, $${n + 3}, 4326) && p.location`,
      );
      values.push(
        params.bbox.minLng,
        params.bbox.minLat,
        params.bbox.maxLng,
        params.bbox.maxLat,
      );
      n += 4;
    }

    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_POST_SELECTION}
         FROM posts p
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.created_at DESC`,
      values,
    );
    return rows.map(rowToPost);
  }

  async listAdmin(params: AdminListPostsParams): Promise<PagedResult<Post>> {
    // Liste BACKOFFICE : tous statuts par défaut (y compris 'deleted' —
    // audit), JOIN users pour la recherche sur le nom d'auteur, filtres
    // typeSlug / status / mapVisible, recherche ILIKE title/body/displayName,
    // antéchronologique tie-break id (ordre STABLE).
    const conditions: string[] = [];
    const values: unknown[] = [];
    let n = 1;

    if (params.typeSlug !== undefined) {
      conditions.push(`p.type_slug = $${n++}`);
      values.push(params.typeSlug);
    }
    if (params.status !== undefined) {
      conditions.push(`p.status = $${n++}`);
      values.push(params.status);
    }
    if (params.mapVisible !== undefined) {
      // Visible sur la carte = status 'active' ET location non nulle ET
      // map_expires_at > now (mock). `now` injecté comme paramètre pour un
      // comportement déterministe au sein de la requête.
      const visibleExpr =
        `(p.status = 'active' AND p.location IS NOT NULL ` +
        `AND p.map_expires_at IS NOT NULL AND p.map_expires_at > $${n++})`;
      conditions.push(params.mapVisible ? visibleExpr : `NOT ${visibleExpr}`);
      values.push(new Date());
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      // ILIKE %needle% sur title / body / nom d'auteur (insensible à la casse).
      // Le mock compare en minuscules avec includes() ; ILIKE en est le miroir.
      const ph = `$${n++}`;
      conditions.push(
        `(coalesce(p.title, '') ILIKE ${ph} ` +
          `OR p.body ILIKE ${ph} ` +
          `OR coalesce(author.display_name, '') ILIKE ${ph})`,
      );
      values.push(`%${params.search.trim()}%`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Requête de comptage (même JOIN + mêmes filtres, sans LIMIT/OFFSET).
    const totalRes = await query(
      this.pool,
      `SELECT count(*) AS n
         FROM posts p
         JOIN users author ON author.id = p.author_id
        ${whereSql}`,
      values,
    );

    // Page : LIMIT/OFFSET ajoutés APRÈS les filtres.
    const limitPh = `$${n++}`;
    const offsetPh = `$${n++}`;
    const pageParams = [...values, params.limit, params.offset];
    const { rows } = await query(
      this.pool,
      `SELECT ${SQL_POST_SELECTION}
         FROM posts p
         JOIN users author ON author.id = p.author_id
        ${whereSql}
        ORDER BY p.created_at DESC, p.id
        LIMIT ${limitPh} OFFSET ${offsetPh}`,
      pageParams,
    );

    return {
      items: rows.map(rowToPost),
      total: Number(totalRes.rows[0].n),
    };
  }

  async listMediaByPostIds(postIds: string[]): Promise<PostMedia[]> {
    // Lecture PAR LOT (évite les N+1) — tri par position croissante puis
    // created_at croissant (mock : position ASC, byCreatedAtAsc). Tableau
    // vide : on court-circuite (ANY(ARRAY vide) est inutile).
    if (postIds.length === 0) {
      return [];
    }
    const { rows } = await query(
      this.pool,
      `SELECT id, post_id, media_type, url, thumbnail_url,
              width, height, position, created_at
         FROM post_media
        WHERE post_id = ANY($1)
        ORDER BY position ASC, created_at ASC`,
      [postIds],
    );
    return rows.map(rowToPostMedia);
  }

  /**
   * Relit un post par id via un client de TRANSACTION (utilisé par create,
   * pour rester dans la même transaction). Mêmes colonnes + compteurs que les
   * lectures du pool. Le post existe forcément (on vient de l'insérer).
   */
  private async selectByIdInClient(
    client: PoolClient,
    id: string,
  ): Promise<Post> {
    const { rows } = await client.query(
      `SELECT ${SQL_POST_SELECTION} FROM posts p WHERE p.id = $1`,
      [id],
    );
    return rowToPost(rows[0]);
  }
}

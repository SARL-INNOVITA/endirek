/**
 * PostgresUsersRepository — implémentation SQL de UsersRepository (utilisateurs
 * ET follows). Comportement OBSERVABLE identique au driver mock
 * (mock-repositories.ts, MockUsersRepository) : mêmes tris, filtres,
 * idempotence, messages d'erreur et sémantique des compteurs.
 *
 * COMPTEURS CALCULÉS À LA LECTURE (jamais maintenus à l'écriture) :
 *   - followersCount = nombre de comptes ACTIFS qui suivent l'utilisateur ;
 *   - followingCount = nombre de comptes ACTIFS que l'utilisateur suit.
 * C'est EXACTEMENT la sémantique de MockDatabaseService.recomputeUserFollowCounts
 * (les liens vers des comptes non 'active' ne sont pas comptés). Les compteurs
 * valent donc toujours la longueur des listes publiques listFollowers/
 * listFollowing (qui, elles aussi, ne servent que les comptes actifs).
 *
 * Géométrie : lecture via ST_Y(location) AS lat / ST_X(location) AS lng
 * (fragment SQL_USER_COLUMNS) ; écriture via ST_SetSRID(ST_MakePoint(lng,lat),
 * 4326). Les écritures qui touchent la location re-SELECT la ligne pour
 * reconstruire lat/lng + compteurs par le même chemin de lecture.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { User } from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  CreateUserInput,
  ListUsersParams,
  PagedResult,
  PageParams,
  UpdateUserPatch,
  UsersRepository,
} from '../../repositories/interfaces';
import {
  geoPointToSql,
  query,
  rowToUser,
  SQL_USER_COLUMNS,
} from '../pg-helpers';

/**
 * Sous-requêtes de compteurs (alias de table `u`). followersCount/followingCount
 * ne comptent QUE les liens vers des comptes 'active' — miroir exact du mock.
 */
const SQL_USER_FOLLOW_COUNTS = `
  (SELECT count(*)::int
     FROM follows f
     JOIN users fu ON fu.id = f.follower_id
    WHERE f.followed_id = u.id AND fu.status = 'active') AS followers_count,
  (SELECT count(*)::int
     FROM follows f
     JOIN users fu ON fu.id = f.followed_id
    WHERE f.follower_id = u.id AND fu.status = 'active') AS following_count
`.trim();

/** SELECT complet d'un utilisateur (colonnes de base + compteurs à la lecture). */
const SQL_SELECT_USER = `
  SELECT ${SQL_USER_COLUMNS},
         ${SQL_USER_FOLLOW_COUNTS}
    FROM users u
`.trim();

/** Correspondance clé de patch (camelCase) → colonne SQL (snake_case). */
const USER_PATCH_COLUMNS: Record<keyof UpdateUserPatch, string> = {
  email: 'email',
  passwordHash: 'password_hash',
  displayName: 'display_name',
  avatarUrl: 'avatar_url',
  coverUrl: 'cover_url',
  bio: 'bio',
  city: 'city',
  dealplaceSeeking: 'dealplace_seeking',
  location: 'location',
  settings: 'settings',
  role: 'role',
  status: 'status',
};

@Injectable()
export class PostgresUsersRepository implements UsersRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const res = await query(this.pool, `${SQL_SELECT_USER} WHERE u.id = $1`, [
      id,
    ]);
    return res.rows.length > 0 ? rowToUser(res.rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    // Chargement par lot (auteurs d'une page de feed) : les ids inconnus sont
    // ignorés silencieusement — équivalent WHERE id = ANY($1). L'ordre de
    // retour n'est pas garanti (contrat interface).
    if (ids.length === 0) {
      return [];
    }
    const res = await query(
      this.pool,
      `${SQL_SELECT_USER} WHERE u.id = ANY($1)`,
      [ids],
    );
    return res.rows.map(rowToUser);
  }

  async findByEmail(email: string): Promise<User | null> {
    // Miroir de l'index UNIQUE sur lower(email) : recherche insensible à la casse.
    const res = await query(
      this.pool,
      `${SQL_SELECT_USER} WHERE lower(u.email) = lower($1)`,
      [email],
    );
    return res.rows.length > 0 ? rowToUser(res.rows[0]) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    // Contrôle d'unicité en amont (même message d'erreur que le mock). L'index
    // UNIQUE lower(email) reste le garde-fou ultime en cas de concurrence.
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new Error(
        `Un compte existe déjà avec l'email « ${input.email} » (unicité insensible à la casse).`,
      );
    }

    // Défauts identiques au mock : bio '', settings {}, role 'user',
    // status 'active'. La location est optionnelle (géométrie ou NULL).
    const location = input.location ?? null;
    const params: unknown[] = [
      input.email,
      input.passwordHash,
      input.displayName,
      input.avatarUrl ?? null,
      input.coverUrl ?? null,
      input.bio ?? '',
      input.city ?? null,
    ];
    let geo = 'NULL';
    if (location !== null) {
      params.push(location.lng, location.lat);
      geo = geoPointToSql(`$${params.length - 1}`, `$${params.length}`);
    }
    params.push(JSON.stringify(input.settings ?? {}), input.role ?? 'user');
    const settingsPlaceholder = `$${params.length - 1}`;
    const rolePlaceholder = `$${params.length}`;

    const res = await query<{ id: string }>(
      this.pool,
      `INSERT INTO users
         (email, password_hash, display_name, avatar_url, cover_url, bio, city,
          location, settings, role, status)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, ${geo},
          ${settingsPlaceholder}::jsonb, ${rolePlaceholder}, 'active')
       RETURNING id`,
      params,
    );
    // Re-SELECT par le chemin de lecture standard (reconstruit lat/lng + compteurs).
    return (await this.findById(res.rows[0].id))!;
  }

  async update(id: string, patch: UpdateUserPatch): Promise<User> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Utilisateur introuvable : ${id}.`);
    }
    // Contrôle d'unicité UNIQUEMENT si l'email fait partie du patch (undefined =
    // colonne non modifiée) — même sémantique et même message que le mock.
    if (patch.email !== undefined) {
      const other = await this.findByEmail(patch.email);
      if (other && other.id !== id) {
        throw new Error(
          `Un autre compte utilise déjà l'email « ${patch.email} ».`,
        );
      }
    }

    // applyPatch : on ignore les clés à valeur undefined (colonne inchangée) ;
    // null reste une valeur légitime (remise à NULL d'une colonne nullable).
    const setClauses: string[] = [];
    const params: unknown[] = [];
    for (const [key, column] of Object.entries(USER_PATCH_COLUMNS) as Array<
      [keyof UpdateUserPatch, string]
    >) {
      const value = patch[key];
      if (value === undefined) {
        continue;
      }
      if (key === 'location') {
        const loc = value as { lat: number; lng: number } | null;
        if (loc === null) {
          setClauses.push(`location = NULL`);
        } else {
          params.push(loc.lng, loc.lat);
          setClauses.push(
            `location = ${geoPointToSql(`$${params.length - 1}`, `$${params.length}`)}`,
          );
        }
      } else if (key === 'settings') {
        params.push(JSON.stringify(value));
        setClauses.push(`settings = $${params.length}::jsonb`);
      } else {
        params.push(value);
        setClauses.push(`${column} = $${params.length}`);
      }
    }

    if (setClauses.length > 0) {
      params.push(id);
      // Le trigger set_updated_at() maintient updated_at (pas de SET manuel).
      await query(
        this.pool,
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
        params,
      );
    }
    return (await this.findById(id))!;
  }

  async softDelete(id: string): Promise<void> {
    // Suppression douce RGPD : status 'deleted' + deletedAt = now. Les lignes de
    // `follows` sont CONSERVÉES (trace RGPD/audit) ; comme les compteurs sont
    // calculés à la lecture avec le filtre status='active', le passage en
    // 'deleted' décompte automatiquement `id` chez ses contreparties (aucun
    // recompute à propager, contrairement au mock qui matérialise les compteurs).
    const res = await query(
      this.pool,
      `UPDATE users SET status = 'deleted', deleted_at = now() WHERE id = $1`,
      [id],
    );
    if ((res.rowCount ?? 0) === 0) {
      throw new Error(`Utilisateur introuvable : ${id}.`);
    }
  }

  async follow(followerId: string, followedId: string): Promise<void> {
    if (followerId === followedId) {
      throw new Error(
        'Un utilisateur ne peut pas se suivre lui-même (CHECK follower_id <> followed_id).',
      );
    }
    // Existence des deux comptes (même message que le mock).
    const users = await query<{ id: string; status: string }>(
      this.pool,
      `SELECT id, status FROM users WHERE id = ANY($1)`,
      [[followerId, followedId]],
    );
    const byId = new Map(users.rows.map((r) => [r.id, r.status]));
    if (!byId.has(followerId) || !byId.has(followedId)) {
      throw new Error('Follow impossible : utilisateur introuvable.');
    }
    // Politique « on ne suit pas un compte non actif » (défense en profondeur,
    // miroir du mock).
    if (byId.get(followedId) !== 'active') {
      throw new Error(
        "Follow impossible : le compte cible n'est pas actif (supprimé ou suspendu).",
      );
    }
    // Idempotent : INSERT ... ON CONFLICT DO NOTHING (PK composite).
    await query(
      this.pool,
      `INSERT INTO follows (follower_id, followed_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, followed_id) DO NOTHING`,
      [followerId, followedId],
    );
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    // Idempotent : supprime le lien s'il existe, ne fait rien sinon.
    await query(
      this.pool,
      `DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2`,
      [followerId, followedId],
    );
  }

  async isFollowing(followerId: string, followedId: string): Promise<boolean> {
    const res = await query(
      this.pool,
      `SELECT 1 FROM follows WHERE follower_id = $1 AND followed_id = $2`,
      [followerId, followedId],
    );
    return res.rows.length > 0;
  }

  async listFollowedIds(userId: string): Promise<string[]> {
    // Ids des comptes suivis par userId (construction du feed « suivis »).
    // Le mock ne filtre pas par statut ici et conserve l'ordre d'insertion des
    // liens : on trie donc par created_at croissant pour un ordre déterministe.
    const res = await query<{ followed_id: string }>(
      this.pool,
      `SELECT followed_id FROM follows WHERE follower_id = $1 ORDER BY created_at, followed_id`,
      [userId],
    );
    return res.rows.map((r) => r.followed_id);
  }

  /**
   * Page d'utilisateurs à partir de liens de suivi, du plus récent au plus
   * ancien, en ne retenant que les comptes ACTIFS ; `total` compte ces mêmes
   * comptes actifs (miroir exact de MockUsersRepository.pageFollowUsers).
   *
   * `linkColumn` = colonne des liens qui référence l'AUTRE compte (le compte à
   * paginer) : 'follower_id' pour listFollowers, 'followed_id' pour listFollowing.
   * `pivotColumn` = colonne fixée à `userId`.
   */
  private async pageFollowUsers(
    userId: string,
    linkColumn: 'follower_id' | 'followed_id',
    pivotColumn: 'follower_id' | 'followed_id',
    params: PageParams,
  ): Promise<PagedResult<User>> {
    // total = comptes actifs uniquement (JOIN + filtre status), tri du lien le
    // plus récent au plus ancien (f.created_at DESC), pagination LIMIT/OFFSET.
    const rowsRes = await query(
      this.pool,
      `SELECT ${SQL_USER_COLUMNS},
              ${SQL_USER_FOLLOW_COUNTS}
         FROM follows f
         JOIN users u ON u.id = f.${linkColumn}
        WHERE f.${pivotColumn} = $1 AND u.status = 'active'
        ORDER BY f.created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, params.limit, params.offset],
    );
    const totalRes = await query<{ total: string }>(
      this.pool,
      `SELECT count(*)::int AS total
         FROM follows f
         JOIN users u ON u.id = f.${linkColumn}
        WHERE f.${pivotColumn} = $1 AND u.status = 'active'`,
      [userId],
    );
    return {
      items: rowsRes.rows.map(rowToUser),
      total: Number(totalRes.rows[0].total),
    };
  }

  listFollowers(
    userId: string,
    params: PageParams,
  ): Promise<PagedResult<User>> {
    // Followers = comptes qui suivent userId : le lien à paginer est follower_id,
    // le pivot est followed_id.
    return this.pageFollowUsers(userId, 'follower_id', 'followed_id', params);
  }

  listFollowing(
    userId: string,
    params: PageParams,
  ): Promise<PagedResult<User>> {
    // Following = comptes suivis par userId : le lien à paginer est followed_id,
    // le pivot est follower_id.
    return this.pageFollowUsers(userId, 'followed_id', 'follower_id', params);
  }

  async list(params: ListUsersParams): Promise<PagedResult<User>> {
    // Filtres status/role, recherche insensible à la casse sur displayName OU
    // email (ILIKE), tri antéchronologique, pagination. Même sémantique que le
    // mock (search vide/whitespace ignoré).
    const where: string[] = [];
    const filterParams: unknown[] = [];
    if (params.status !== undefined) {
      filterParams.push(params.status);
      where.push(`u.status = $${filterParams.length}`);
    }
    if (params.role !== undefined) {
      filterParams.push(params.role);
      where.push(`u.role = $${filterParams.length}`);
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      // includes(needle) côté mock ⇒ ILIKE '%needle%' (insensible à la casse).
      filterParams.push(`%${params.search.trim()}%`);
      where.push(
        `(u.display_name ILIKE $${filterParams.length} OR u.email ILIKE $${filterParams.length})`,
      );
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const totalRes = await query<{ total: string }>(
      this.pool,
      `SELECT count(*)::int AS total FROM users u ${whereSql}`,
      filterParams,
    );

    const pageParams = [...filterParams, params.limit, params.offset];
    const rowsRes = await query(
      this.pool,
      `${SQL_SELECT_USER} ${whereSql}
        ORDER BY u.created_at DESC
        LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      pageParams,
    );
    return {
      items: rowsRes.rows.map(rowToUser),
      total: Number(totalRes.rows[0].total),
    };
  }
}

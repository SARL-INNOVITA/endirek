/**
 * PostgresDatabaseService — cycle de vie de la connexion PostgreSQL du driver.
 *
 * Pendant du MockDatabaseService pour le driver postgres. Ne détient PAS les
 * données (elles vivent en base) : il gère la CONNECTIVITÉ et le SEED au boot.
 *
 * onModuleInit :
 *  1. ping (`SELECT 1`) — échoue tôt et clairement si le conteneur Docker n'est
 *     pas là (message explicite) ;
 *  2. si database.mockSeed (DB_MOCK_SEED, défaut true) ET la table users est
 *     VIDE, lance PostgresSeeder.seed() (insertion idempotente et atomique) ;
 *  3. log de disponibilité analogue au mock (comptes RÉELS lus en SQL).
 *
 * onModuleDestroy : ferme le pool (`pool.end()`).
 *
 * Le pool est exposé aux repositories via le token POSTGRES_POOL (injecté
 * directement dans leurs constructeurs) ; ce service n'a donc pas à le
 * ré-exposer, mais le garde pour ses propres requêtes de boot.
 */

import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DatabaseConfig } from '../../config/configuration';
import { POSTGRES_POOL } from '../database.tokens';
import { PostgresSeeder } from './postgres-seeder';

@Injectable()
export class PostgresDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PostgresDatabase');

  constructor(
    @Inject(POSTGRES_POOL) private readonly pool: Pool,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ping();

    const database = this.configService.getOrThrow<DatabaseConfig>('database');
    if (database.mockSeed && (await this.isUsersTableEmpty())) {
      await new PostgresSeeder(this.pool).seed();
    }

    await this.logBootSummary();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  /** Vérifie la connectivité (SELECT 1). Traduit l'échec en message clair. */
  private async ping(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        'Connexion PostgreSQL impossible (DB_DRIVER=postgres). Vérifiez que ' +
          'le conteneur Docker endirek-postgres est lancé et que les ' +
          'migrations sont appliquées (npm run db:migrate). Détail : ' +
          detail,
      );
    }
  }

  /** La table users est-elle vide ? (déclencheur du seed au premier boot). */
  private async isUsersTableEmpty(): Promise<boolean> {
    const res = await this.pool.query<{ empty: boolean }>(
      'SELECT NOT EXISTS (SELECT 1 FROM users) AS empty',
    );
    return res.rows[0]?.empty ?? true;
  }

  /**
   * Journal de démarrage analogue au mock : comptes réels lus en SQL, dont le
   * nombre de posts actuellement visibles sur la carte (mêmes critères que le
   * mock : location non nulle, status 'active', map_expires_at > now()).
   */
  private async logBootSummary(): Promise<void> {
    const res = await this.pool.query<{
      users: string;
      follows: string;
      posts: string;
      map_visible: string;
      comments: string;
      reactions: string;
      cameras: string;
      reports: string;
      notifications: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM users)         AS users,
         (SELECT COUNT(*) FROM follows)       AS follows,
         (SELECT COUNT(*) FROM posts)         AS posts,
         (SELECT COUNT(*) FROM posts
            WHERE location IS NOT NULL
              AND status = 'active'
              AND map_expires_at IS NOT NULL
              AND map_expires_at > now())     AS map_visible,
         (SELECT COUNT(*) FROM comments)      AS comments,
         (SELECT COUNT(*) FROM reactions)     AS reactions,
         (SELECT COUNT(*) FROM cameras)       AS cameras,
         (SELECT COUNT(*) FROM reports)       AS reports,
         (SELECT COUNT(*) FROM notifications) AS notifications`,
    );
    const r = res.rows[0];
    this.logger.log(
      `PostgreSQL prêt : connecté (${r.users} utilisateurs, ` +
        `${r.follows} follows, ` +
        `${r.posts} posts (dont ${r.map_visible} visibles carte), ` +
        `${r.comments} commentaires, ${r.reactions} réactions, ` +
        `${r.cameras} caméras, ${r.reports} signalements, ` +
        `${r.notifications} notifications)`,
    );
  }
}

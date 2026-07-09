/**
 * Provider du pool de connexions PostgreSQL (node-postgres).
 *
 * Une seule instance de `pg.Pool` est partagée par TOUS les repositories du
 * driver postgres et par PostgresDatabaseService : le pool gère lui-même la
 * réutilisation des connexions (pas de connexion par requête). Il est injecté
 * via le token POSTGRES_POOL et fermé proprement par
 * PostgresDatabaseService.onModuleDestroy() (pool.end()).
 *
 * Configuration (miroir de src/config/configuration.ts, groupe `database`) :
 * - DATABASE_URL PRIORITAIRE si non vide (chaîne de connexion complète) ;
 * - sinon champs individuels POSTGRES_HOST / PORT / DB / USER / PASSWORD.
 *
 * Aucun secret n'est codé en dur : tout vient de la config typée.
 */

import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolConfig } from 'pg';
import { DatabaseConfig } from '../../config/configuration';
import { POSTGRES_POOL } from '../database.tokens';

/**
 * Construit la configuration du pool depuis la config `database`.
 *
 * DATABASE_URL a la priorité (déploiement type « une seule variable ») ; en
 * son absence on retombe sur les champs individuels (dev local, docker-compose).
 * Les timeouts sont volontairement modérés : on veut échouer VITE et clairement
 * si le conteneur Docker n'est pas là plutôt que de bloquer le boot.
 */
export function buildPoolConfig(database: DatabaseConfig): PoolConfig {
  const base: PoolConfig = {
    // Nombre max de connexions simultanées dans le pool (suffisant pour l'API
    // du Lot 1 ; ajustable via l'environnement plus tard si besoin).
    max: 10,
    // Ferme une connexion inactive après 30 s (libère les ressources Docker).
    idleTimeoutMillis: 30_000,
    // Échoue au bout de 5 s si aucune connexion n'a pu être établie (conteneur
    // absent, mauvais host/port) : boot rapide et message d'erreur clair.
    connectionTimeoutMillis: 5_000,
  };

  const url = database.url?.trim();
  if (url) {
    // Chaîne de connexion complète : node-postgres parse l'URL lui-même.
    return { ...base, connectionString: url };
  }

  // Champs individuels (fallback dev local / docker-compose).
  return {
    ...base,
    host: database.host,
    port: database.port,
    database: database.name,
    user: database.user,
    password: database.password,
  };
}

/**
 * Provider NestJS du pool. La factory lit la config `database` et instancie un
 * unique `pg.Pool`. Le pool est « paresseux » côté node-postgres : la première
 * connexion réelle n'est ouverte qu'à la première requête (le ping de
 * PostgresDatabaseService.onModuleInit valide donc la connectivité au boot).
 */
export const postgresPoolProvider: Provider = {
  provide: POSTGRES_POOL,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Pool => {
    const database = configService.getOrThrow<DatabaseConfig>('database');
    return new Pool(buildPoolConfig(database));
  },
};

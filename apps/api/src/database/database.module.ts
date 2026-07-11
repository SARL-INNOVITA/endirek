/**
 * DatabaseModule — module global de la couche persistance.
 *
 * Lie chaque token de repository (database.tokens.ts) à l'implémentation du
 * driver actif. Deux drivers, comportement OBSERVABLE identique :
 *
 * - 'mock' (défaut) : repositories en mémoire au-dessus de MockDatabaseService,
 *   seed La Réunion chargé au boot si DB_MOCK_SEED=true. Aucune infrastructure
 *   requise — fallback de développement.
 * - 'postgres' : repositories SQL (pg) au-dessus d'un pg.Pool (POSTGRES_POOL) et
 *   de PostgresDatabaseService (ping + seed au boot). Nécessite le conteneur
 *   Docker et les migrations appliquées (npm run db:migrate).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CHOIX DU DRIVER AU CHARGEMENT DU MODULE
 * ─────────────────────────────────────────────────────────────────────────────
 * Le driver est lu DIRECTEMENT depuis process.env.DB_DRIVER au moment où ce
 * fichier construit sa liste de providers (et non via ConfigService, injecté
 * plus tard). C'est une décision de BOOTSTRAP D'INFRASTRUCTURE assumée : la
 * COMPOSITION du graphe d'injection (quels providers existent) doit être figée
 * avant que Nest n'instancie quoi que ce soit. Conséquence voulue : en driver
 * postgres, MockDatabaseService n'est même pas déclaré comme provider (jamais
 * instancié), et réciproquement le pool postgres n'existe pas en driver mock.
 * ConfigService reste la source de vérité pour tout le RESTE de la config
 * database (url, host, mockSeed...) — seul le choix structurel du driver est
 * pris ici, tôt.
 *
 * @Global() : les modules métier injectent les repositories via leurs tokens
 * sans importer DatabaseModule explicitement.
 */

import { Global, Module, Provider, Type } from '@nestjs/common';
import {
  ALL_REPOSITORY_TOKENS,
  CAMERAS_REPOSITORY,
  COMMENTS_REPOSITORY,
  CONVERSATIONS_REPOSITORY,
  DEALS_REPOSITORY,
  LISTING_TAXONOMY_REPOSITORY,
  LISTINGS_REPOSITORY,
  NOTIFICATIONS_REPOSITORY,
  POST_TYPES_REPOSITORY,
  POSTS_REPOSITORY,
  REACTIONS_REPOSITORY,
  REPORTS_REPOSITORY,
  SAVED_REPOSITORY,
  USERS_REPOSITORY,
} from './database.tokens';
import { MockDatabaseService } from './mock/mock-database.service';
import {
  MockCamerasRepository,
  MockCommentsRepository,
  MockConversationsRepository,
  MockDealsRepository,
  MockListingsRepository,
  MockListingTaxonomyRepository,
  MockNotificationsRepository,
  MockPostsRepository,
  MockPostTypesRepository,
  MockReactionsRepository,
  MockReportsRepository,
  MockSavedRepository,
  MockUsersRepository,
} from './mock/mock-repositories';
import { PostgresDatabaseService } from './postgres/postgres-database.service';
import { postgresPoolProvider } from './postgres/postgres-pool';
import { PostgresCamerasRepository } from './postgres/repositories/postgres-cameras.repository';
import { PostgresCommentsRepository } from './postgres/repositories/postgres-comments.repository';
import { PostgresConversationsRepository } from './postgres/repositories/postgres-conversations.repository';
import { PostgresDealsRepository } from './postgres/repositories/postgres-deals.repository';
import { PostgresListingsRepository } from './postgres/repositories/postgres-listings.repository';
import { PostgresListingTaxonomyRepository } from './postgres/repositories/postgres-listing-taxonomy.repository';
import { PostgresNotificationsRepository } from './postgres/repositories/postgres-notifications.repository';
import { PostgresPostTypesRepository } from './postgres/repositories/postgres-post-types.repository';
import { PostgresPostsRepository } from './postgres/repositories/postgres-posts.repository';
import { PostgresReactionsRepository } from './postgres/repositories/postgres-reactions.repository';
import { PostgresReportsRepository } from './postgres/repositories/postgres-reports.repository';
import { PostgresSavedRepository } from './postgres/repositories/postgres-saved.repository';
import { PostgresUsersRepository } from './postgres/repositories/postgres-users.repository';

/** Driver de persistance choisi au chargement du module (décision d'infra). */
const DB_DRIVER = (process.env.DB_DRIVER ?? 'mock').trim();

/** Associe un token de repository à sa classe d'implémentation (`useClass`). */
function bind(token: symbol, useClass: Type<unknown>): Provider {
  return { provide: token, useClass };
}

/**
 * Providers du driver MOCK : MockDatabaseService (service interne, jamais
 * exporté) + les 9 repositories mock liés à leurs tokens. Comportement ACTUEL
 * inchangé.
 */
const mockProviders: Provider[] = [
  MockDatabaseService,
  bind(USERS_REPOSITORY, MockUsersRepository),
  bind(POST_TYPES_REPOSITORY, MockPostTypesRepository),
  bind(POSTS_REPOSITORY, MockPostsRepository),
  bind(COMMENTS_REPOSITORY, MockCommentsRepository),
  bind(REACTIONS_REPOSITORY, MockReactionsRepository),
  bind(SAVED_REPOSITORY, MockSavedRepository),
  bind(CAMERAS_REPOSITORY, MockCamerasRepository),
  bind(REPORTS_REPOSITORY, MockReportsRepository),
  bind(NOTIFICATIONS_REPOSITORY, MockNotificationsRepository),
  bind(LISTING_TAXONOMY_REPOSITORY, MockListingTaxonomyRepository),
  bind(LISTINGS_REPOSITORY, MockListingsRepository),
  bind(CONVERSATIONS_REPOSITORY, MockConversationsRepository),
  bind(DEALS_REPOSITORY, MockDealsRepository),
];

/**
 * Providers du driver POSTGRES : le pool (POSTGRES_POOL), le service de cycle
 * de vie (ping + seed) et les 9 repositories SQL liés aux MÊMES tokens que le
 * mock. MockDatabaseService n'est PAS présent ici — jamais instancié.
 */
const postgresProviders: Provider[] = [
  postgresPoolProvider,
  PostgresDatabaseService,
  bind(USERS_REPOSITORY, PostgresUsersRepository),
  bind(POST_TYPES_REPOSITORY, PostgresPostTypesRepository),
  bind(POSTS_REPOSITORY, PostgresPostsRepository),
  bind(COMMENTS_REPOSITORY, PostgresCommentsRepository),
  bind(REACTIONS_REPOSITORY, PostgresReactionsRepository),
  bind(SAVED_REPOSITORY, PostgresSavedRepository),
  bind(CAMERAS_REPOSITORY, PostgresCamerasRepository),
  bind(REPORTS_REPOSITORY, PostgresReportsRepository),
  bind(NOTIFICATIONS_REPOSITORY, PostgresNotificationsRepository),
  bind(LISTING_TAXONOMY_REPOSITORY, PostgresListingTaxonomyRepository),
  bind(LISTINGS_REPOSITORY, PostgresListingsRepository),
  bind(CONVERSATIONS_REPOSITORY, PostgresConversationsRepository),
  bind(DEALS_REPOSITORY, PostgresDealsRepository),
];

/** Sélectionne les providers selon le driver ; échoue tôt et clairement sur un
 * driver inconnu (miroir du CHECK que faisait assertSupportedDriver). */
function selectProviders(driver: string): Provider[] {
  if (driver === 'mock') {
    return mockProviders;
  }
  if (driver === 'postgres') {
    return postgresProviders;
  }
  throw new Error(
    `DB_DRIVER inconnu : « ${driver} » (valeurs supportées : mock, postgres).`,
  );
}

@Global()
@Module({
  providers: selectProviders(DB_DRIVER),
  // ALL_REPOSITORY_TOKENS (database.tokens.ts) est la source unique de vérité
  // de la liste des repositories exposés au reste de l'application — identique
  // quel que soit le driver (les tokens ne bougent jamais).
  exports: [...ALL_REPOSITORY_TOKENS],
})
export class DatabaseModule {}

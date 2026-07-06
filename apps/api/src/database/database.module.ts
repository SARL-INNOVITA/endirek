/**
 * DatabaseModule — module global de la couche persistance.
 *
 * Lie chaque token de repository (database.tokens.ts) à l'implémentation du
 * driver actif, choisi via la configuration `database.driver` (DB_DRIVER) :
 *
 * - 'mock' (défaut) : repositories en mémoire au-dessus de MockDatabaseService,
 *   seed La Réunion chargé au boot si DB_MOCK_SEED=true. Aucune infrastructure
 *   requise — c'est le mode de développement tant que Docker est absent.
 * - 'postgres' : PAS ENCORE IMPLÉMENTÉ (étape 2 : le schéma SQL existe dans
 *   db/migrations/, mais aucun PostGIS ne tourne sans Docker). Tout démarrage
 *   avec DB_DRIVER=postgres échoue volontairement avec une erreur explicite,
 *   plutôt que de faire semblant de fonctionner.
 *
 * @Global() : les modules métier (étapes 3-6) injectent les repositories via
 * leurs tokens sans importer DatabaseModule explicitement.
 */

import { Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseConfig } from '../config/configuration';
import {
  ALL_REPOSITORY_TOKENS,
  CAMERAS_REPOSITORY,
  COMMENTS_REPOSITORY,
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
  MockNotificationsRepository,
  MockPostsRepository,
  MockPostTypesRepository,
  MockReactionsRepository,
  MockReportsRepository,
  MockSavedRepository,
  MockUsersRepository,
} from './mock/mock-repositories';

/**
 * Vérifie le driver configuré. Lève une erreur claire AU DÉMARRAGE si le
 * driver n'est pas utilisable — on échoue tôt et explicitement.
 */
function assertSupportedDriver(configService: ConfigService): void {
  const driver =
    configService.get<DatabaseConfig>('database')?.driver ?? 'mock';

  if (driver === 'mock') {
    return;
  }
  if (driver === 'postgres') {
    throw new Error(
      "Driver postgres non implémenté à l'étape 2 — installez Docker " +
        "(infra/docker-compose.yml) puis attendez l'implémentation du driver, " +
        'ou utilisez DB_DRIVER=mock.',
    );
  }
  throw new Error(
    `DB_DRIVER inconnu : « ${driver} » (valeurs supportées : mock, postgres).`,
  );
}

/**
 * Provider de repository : valide le driver puis instancie l'implémentation
 * mock. Quand le driver postgres existera, cette factory choisira entre les
 * deux implémentations — les tokens et les interfaces ne bougeront pas.
 */
function repositoryProvider(
  token: symbol,
  factory: (db: MockDatabaseService) => unknown,
): Provider {
  return {
    provide: token,
    inject: [ConfigService, MockDatabaseService],
    useFactory: (configService: ConfigService, db: MockDatabaseService) => {
      assertSupportedDriver(configService);
      return factory(db);
    },
  };
}

const repositoryProviders: Provider[] = [
  repositoryProvider(USERS_REPOSITORY, (db) => new MockUsersRepository(db)),
  repositoryProvider(
    POST_TYPES_REPOSITORY,
    (db) => new MockPostTypesRepository(db),
  ),
  repositoryProvider(POSTS_REPOSITORY, (db) => new MockPostsRepository(db)),
  repositoryProvider(
    COMMENTS_REPOSITORY,
    (db) => new MockCommentsRepository(db),
  ),
  repositoryProvider(
    REACTIONS_REPOSITORY,
    (db) => new MockReactionsRepository(db),
  ),
  repositoryProvider(SAVED_REPOSITORY, (db) => new MockSavedRepository(db)),
  repositoryProvider(CAMERAS_REPOSITORY, (db) => new MockCamerasRepository(db)),
  repositoryProvider(REPORTS_REPOSITORY, (db) => new MockReportsRepository(db)),
  repositoryProvider(
    NOTIFICATIONS_REPOSITORY,
    (db) => new MockNotificationsRepository(db),
  ),
];

@Global()
@Module({
  // MockDatabaseService est un provider INTERNE (jamais exporté) : le code
  // métier n'importe rien de mock/ et n'injecte que les tokens ci-dessous.
  providers: [MockDatabaseService, ...repositoryProviders],
  // ALL_REPOSITORY_TOKENS (database.tokens.ts) est la source unique de
  // vérité de la liste des repositories exposés au reste de l'application.
  exports: [...ALL_REPOSITORY_TOKENS],
})
export class DatabaseModule {}

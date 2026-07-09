/**
 * Vide les tables de DONNÉES du Lot 1 (hors tables de référence) dans le
 * conteneur Docker PostgreSQL, pour forcer un RE-SEED au prochain démarrage de
 * l'API en DB_DRIVER=postgres (le seed ne se lance que si `users` est vide).
 *
 * TRUNCATE ... RESTART IDENTITY CASCADE :
 *  - RESTART IDENTITY remet la séquence camera_number à 1 (le seeder la
 *    repositionnera de toute façon) ;
 *  - CASCADE couvre les FK entre tables de données.
 * NE TOUCHE PAS : post_types, reaction_types (référence, migration 0002) ni
 * spatial_ref_sys (PostGIS). N'installe rien : n'utilise que `docker`.
 *
 * Usage : npm run db:reset
 * Variables : PG_CONTAINER (défaut endirek-postgres), POSTGRES_USER/DB.
 */

import { execFileSync } from 'node:child_process';

const CONTAINER = process.env.PG_CONTAINER ?? 'endirek-postgres';
const DB_USER = process.env.POSTGRES_USER ?? 'endirek';
const DB_NAME = process.env.POSTGRES_DB ?? 'endirek';

// Tables de données (ordre indifférent grâce à CASCADE). Les tables de
// référence post_types / reaction_types sont VOLONTAIREMENT absentes.
const DATA_TABLES = [
  'notifications',
  'reports',
  'cameras',
  'saved_posts',
  'saved_collections',
  'reactions',
  'comments',
  'post_media',
  'posts',
  'follows',
  'users',
];

const sql = `TRUNCATE TABLE ${DATA_TABLES.join(', ')} RESTART IDENTITY CASCADE;`;

console.log(`Réinitialisation des données du conteneur « ${CONTAINER} »...`);
execFileSync(
  'docker',
  [
    'exec',
    CONTAINER,
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    DB_USER,
    '-d',
    DB_NAME,
    '-c',
    sql,
  ],
  { stdio: 'inherit' },
);
console.log(
  'Données vidées (référence conservée). Le prochain boot en DB_DRIVER=postgres re-seedera si DB_MOCK_SEED=true.',
);

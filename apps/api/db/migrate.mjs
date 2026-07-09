/**
 * Applique les migrations SQL du Lot 1 dans le conteneur Docker PostgreSQL.
 *
 * Stratégie : on copie chaque fichier .sql dans le conteneur puis on l'exécute
 * avec psql (-f), dans l'ordre lexicographique (0001, 0002, ...). Les deux
 * migrations sont REJOUABLES (0001 : CREATE TABLE — échoue si déjà présent, on
 * signale mais on n'interrompt pas ; 0002 : ON CONFLICT DO NOTHING). Ce script
 * n'installe RIEN : il n'utilise que `docker` (déjà requis pour le conteneur).
 *
 * Usage : npm run db:migrate            (depuis apps/api ou la racine)
 * Variables : PG_CONTAINER (défaut endirek-postgres), POSTGRES_USER/DB
 * (défaut endirek/endirek).
 */

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, 'migrations');

const CONTAINER = process.env.PG_CONTAINER ?? 'endirek-postgres';
const DB_USER = process.env.POSTGRES_USER ?? 'endirek';
const DB_NAME = process.env.POSTGRES_DB ?? 'endirek';

/** Exécute une commande docker en héritant de stdio (logs visibles). */
function docker(args) {
  return execFileSync('docker', args, { stdio: 'inherit' });
}

function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error('Aucune migration .sql trouvée dans', MIGRATIONS_DIR);
    process.exit(1);
  }

  console.log(
    `Migrations vers le conteneur « ${CONTAINER} » (base ${DB_NAME}) :`,
    files.join(', '),
  );

  for (const file of files) {
    const localPath = join(MIGRATIONS_DIR, file);
    const containerPath = `/tmp/${file}`;
    console.log(`\n=== ${file} ===`);
    // 1. Copier le fichier dans le conteneur.
    docker(['cp', localPath, `${CONTAINER}:${containerPath}`]);
    // 2. L'exécuter avec psql (-v ON_ERROR_STOP=1 pour échouer sur erreur SQL).
    docker([
      'exec',
      CONTAINER,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      DB_USER,
      '-d',
      DB_NAME,
      '-f',
      containerPath,
    ]);
  }

  console.log('\nMigrations appliquées.');
}

main();

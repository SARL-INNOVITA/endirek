# Base de données — ENDIREK (Lot 1)

Ce dossier contient le **schéma SQL source de vérité** de l'API : PostgreSQL 16 + PostGIS.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `migrations/0001_lot1_init.sql` | Extension PostGIS, fonction trigger `set_updated_at()`, les 13 tables du Lot 1 (index, contraintes, triggers). |
| `migrations/0002_reference_data.sql` | Données de référence pilotables backoffice : 5 `post_types` et 6 `reaction_types` (rejouable, `ON CONFLICT DO NOTHING`). |

La documentation détaillée du schéma (rôle de chaque table, décisions produit,
tables futures des lots suivants) se trouve dans [`docs/DATABASE.md`](../../../docs/DATABASE.md).

## Ordre d'application

Les migrations s'appliquent **dans l'ordre numérique** :

```bash
# En direct via psql (client en UTF-8 : les emojis de reaction_types l'exigent)
psql "$DATABASE_URL" -f apps/api/db/migrations/0001_lot1_init.sql
psql "$DATABASE_URL" -f apps/api/db/migrations/0002_reference_data.sql
```

Ou via le conteneur PostgreSQL une fois Docker installé (**depuis la racine du
monorepo** : le `-f infra/docker-compose.yml` cible le compose, et les chemins
SQL se résolvent depuis la racine) :

```bash
docker compose -f infra/docker-compose.yml exec -T postgres psql -U endirek -d endirek < apps/api/db/migrations/0001_lot1_init.sql
docker compose -f infra/docker-compose.yml exec -T postgres psql -U endirek -d endirek < apps/api/db/migrations/0002_reference_data.sql
```

Chaque fichier est encapsulé dans `BEGIN; … COMMIT;` : une erreur annule la
migration entière, on peut corriger et relancer proprement.

## Note honnête : validation différée

**Ces fichiers n'ont pas encore été exécutés contre un vrai PostgreSQL/PostGIS**,
car Docker est absent de la machine de développement actuelle. La syntaxe a été
relue avec soin, mais la validation réelle (application des migrations, vérification
des index et des triggers) sera faite **à l'installation de Docker**.

En attendant, l'API tourne avec `DB_DRIVER=mock` : l'adapter mock TypeScript
reflète fidèlement ce schéma (mêmes entités, mêmes règles métier, mêmes données
de référence) et sera remplacé par le driver PostgreSQL sans changer les
contrats des services.

## Rappels de conventions

- `snake_case` côté SQL, `camelCase` côté TypeScript.
- Clés primaires `uuid DEFAULT gen_random_uuid()` (natif PG16), horodatages `timestamptz`.
- Coordonnées `geometry(Point, 4326)` (longitude/latitude WGS84).
- Statuts en `TEXT` + `CHECK` (évolutifs), vocabulaires en tables de référence
  (`post_types`, `reaction_types`) pilotables par le backoffice.
- Les tables des lots futurs (pages, listings, conversations, messages, deals,
  news, menus restaurants, premium…) sont **documentées mais pas créées**.

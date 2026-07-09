# infra/ — Infrastructure de développement (PostgreSQL/PostGIS)

Ce dossier contient le `docker-compose.yml` qui fournit la base de données
cible du projet : **PostgreSQL 16 + PostGIS 3.4** (image `postgis/postgis:16-3.4`).

> **État actuel (2026-07-09)** : Docker est installé et le service
> PostgreSQL/PostGIS démarre correctement. Les migrations SQL Lot 1 ont été
> appliquées et validées localement. L'API métier reste toutefois en
> `DB_DRIVER=mock` tant que le driver repositories postgres n'est pas
> implémenté.

## Prérequis

- Docker Desktop (Windows/macOS) ou Docker Engine + plugin `compose` (Linux).
- Le port `5432` libre en local.

## Démarrage

```bash
cd infra
docker compose up -d
```

Identifiants par défaut (surchargeables via les variables d'environnement
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, par exemple dans un
fichier `infra/.env` non versionné) :

| Paramètre | Valeur par défaut |
|---|---|
| Hôte / port | `localhost:5432` |
| Base | `endirek` |
| Utilisateur | `endirek` |
| Mot de passe | `endirek` |

Côté API, les variables PostgreSQL sont déjà prêtes dans `apps/api/.env.example`
et peuvent être copiées dans `apps/api/.env` :

```env
DATABASE_URL=postgresql://endirek:endirek@localhost:5432/endirek
```

Ne passer `DB_DRIVER=postgres` que lorsque le driver repositories postgres sera
implémenté côté API. Aujourd'hui, `DB_DRIVER=postgres` échoue volontairement au
démarrage de l'API pour éviter de faire semblant d'utiliser la base SQL.

## Vérification

```bash
# État du conteneur (attendre le statut "healthy" du healthcheck pg_isready)
docker compose ps

# Connexion directe avec psql (via le conteneur, aucun client local requis)
docker compose exec postgres psql -U endirek -d endirek

# Vérifier que PostGIS est bien actif
docker compose exec postgres psql -U endirek -d endirek -c "SELECT postgis_version();"
```

## Migrations Lot 1

Depuis la racine du repo, copier les migrations dans le conteneur puis les
exécuter avec `psql -f` afin de préserver l'encodage UTF-8 :

```bash
docker cp apps/api/db/migrations/0001_lot1_init.sql endirek-postgres:/tmp/0001_lot1_init.sql
docker cp apps/api/db/migrations/0002_reference_data.sql endirek-postgres:/tmp/0002_reference_data.sql

docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U endirek -d endirek -f /tmp/0001_lot1_init.sql
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U endirek -d endirek -f /tmp/0002_reference_data.sql
```

Résultat attendu après migration :

- 13 tables métier Lot 1 dans le schéma `public` ;
- `spatial_ref_sys` ajouté par PostGIS ;
- 5 lignes dans `post_types` ;
- 6 lignes dans `reaction_types` ;
- index clés présents, notamment `posts_location_gist_idx`,
  `cameras_location_gist_idx` et `notifications_user_unread_idx`.

`0001_lot1_init.sql` n'est pas une migration idempotente : ne pas la rejouer sur
une base déjà migrée sans reset du volume. `0002_reference_data.sql` utilise
`ON CONFLICT DO NOTHING` pour les données de référence.

## Arrêt

```bash
docker compose down        # arrête le conteneur, CONSERVE les données
```

## Reset complet (suppression des données)

Les données vivent dans le volume nommé `endirek_pgdata`. Pour repartir de zéro
(schéma + seed rejoués au prochain démarrage de l'API) :

```bash
docker compose down -v     # supprime aussi le volume endirek_pgdata
docker compose up -d
```

## Et sans Docker ?

Deux options :

1. **Rester en `DB_DRIVER=mock`** (fallback du projet, détaillé dans
   [../docs/INSTALL.md](../docs/INSTALL.md)) : aucune base requise, données
   en mémoire/fichiers locaux, suffisant pour développer.
2. Installer PostgreSQL + PostGIS nativement sur Windows, puis pointer
   `DATABASE_URL` dessus — fonctionne, mais volontairement non documenté
   (la voie Docker reste la référence pour garantir la même version partout).

<!-- TODO Lot 2+ : service MinIO (émulation S3 locale) prêt en commentaire
     dans docker-compose.yml — à activer quand le chemin S3 devra être testé. -->

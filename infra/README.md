# infra/ — Infrastructure de développement (PostgreSQL/PostGIS)

Ce dossier contient le `docker-compose.yml` qui fournit la base de données
cible du projet : **PostgreSQL 16 + PostGIS 3.4** (image `postgis/postgis:16-3.4`).

> ⚠️ **État actuel de la machine de dev : Docker n'est PAS installé.**
> Tant que Docker manque, on ne bloque pas : l'API tourne avec
> `DB_DRIVER=mock` dans `apps/api/.env` (adapter local implémenté à
> l'étape 2, derrière la même interface que le driver PostgreSQL).
> Ce dossier documente la voie **recommandée** dès que Docker sera disponible.

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

Côté API, renseigner ensuite dans `apps/api/.env` :

```env
DB_DRIVER=postgres
DATABASE_URL=postgresql://endirek:endirek@localhost:5432/endirek
```

## Vérification

```bash
# État du conteneur (attendre le statut "healthy" du healthcheck pg_isready)
docker compose ps

# Connexion directe avec psql (via le conteneur, aucun client local requis)
docker compose exec postgres psql -U endirek -d endirek

# Vérifier que PostGIS est bien actif
docker compose exec postgres psql -U endirek -d endirek -c "SELECT postgis_version();"
```

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

1. **Rester en `DB_DRIVER=mock`** (état actuel du projet, détaillé dans
   [../docs/INSTALL.md](../docs/INSTALL.md)) : aucune base requise, données
   en mémoire/fichiers locaux, suffisant pour développer.
2. Installer PostgreSQL + PostGIS nativement sur Windows, puis pointer
   `DATABASE_URL` dessus — fonctionne, mais volontairement non documenté
   (la voie Docker reste la référence pour garantir la même version partout).

<!-- TODO Lot 2+ : service MinIO (émulation S3 locale) prêt en commentaire
     dans docker-compose.yml — à activer quand le chemin S3 devra être testé. -->

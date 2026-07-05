# `database` — Stratégie de persistance

**Statut : TODO — implémentation prévue à l'étape 2 du Lot 1.**

## Cible : PostgreSQL/PostGIS

**PostgreSQL avec l'extension PostGIS est la cible et la source de vérité du
schéma** (requêtes géospatiales : posts géolocalisés, caméras, proximité pour
le feed). Le schéma et les migrations vivront ici ; démarrage recommandé via
Docker (`infra/docker-compose.yml`).

## Démarrage sans Docker : `DB_DRIVER=mock`

Tant que Docker n'est pas disponible sur le poste, l'API démarre avec
`DB_DRIVER=mock` : un **adapter local implémente la même interface que
Postgres** (données en mémoire/fichier, seed réaliste La Réunion), ce qui
permet de développer et de démontrer toute l'API sans infrastructure.

## Bascule

Dès que Docker est disponible : `DB_DRIVER=postgres` dans `.env` — aucun
changement de code métier, seuls l'adapter et les variables `DATABASE_URL` /
`POSTGRES_*` entrent en jeu.

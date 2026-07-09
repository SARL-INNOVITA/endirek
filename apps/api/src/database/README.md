# `database` — Couche de persistance

**Statut : implémentée à l'étape 2 du Lot 1 (driver mock).**

Le schéma **PostgreSQL 16 + PostGIS** est la **source de vérité** : il vit dans
[`apps/api/db/migrations/`](../../db/migrations/) et est documenté table par
table dans [`docs/DATABASE.md`](../../../../docs/DATABASE.md). Cette couche
TypeScript en est le miroir exact (snake_case SQL ↔ camelCase TS).

## Architecture

```
src/database/
├── domain/
│   └── entities.ts            # Entités TS = miroir 1:1 des tables SQL
├── repositories/
│   └── interfaces.ts          # Contrats des repositories (indépendants du driver)
├── mock/
│   ├── mock-database.service.ts  # Stores en mémoire + seed + recalcul compteurs
│   ├── mock-repositories.ts      # Implémentation mock de chaque interface
│   └── geo.ts                    # haversine, bbox, offset — équivalents PostGIS
├── seed/
│   ├── communes.ts            # 12 communes de La Réunion (sélection seed — l'île en compte 24)
│   ├── seed-utils.ts          # seedUuid déterministe, minutesAgo, pointNear
│   ├── users.seed.ts          # 15 utilisateurs fictifs + ~30 follows
│   ├── posts.seed.ts          # 42 posts (météo, trafic, danger, libre, question) + 12 médias
│   ├── interactions.seed.ts   # 60 commentaires, ~155 réactions, sauvegardes, signalements, notifications
│   ├── cameras.seed.ts        # 12 caméras météo/trafic (une par commune du référentiel)
│   └── index.ts               # SeedData + buildSeed() (données déclaratives)
├── database.tokens.ts         # Tokens d'injection (un Symbol par repository)
├── database.module.ts         # Module @Global() : driver → implémentations
└── README.md
```

**Règle d'or : le code métier ne dépend QUE de `domain/entities.ts`,
`repositories/interfaces.ts` et `database.tokens.ts`.** Jamais d'import du
dossier `mock/` dans un module métier :

```ts
constructor(
  @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
) {}
```

## Le driver mock (`DB_DRIVER=mock`)

L'API démarre sans dépendre de PostGIS grâce à un driver **en mémoire,
TypeScript pur, zéro dépendance** :

- `MockDatabaseService` héberge une `Map` (ou un tableau) par table du schéma ;
- les **données de référence** (`post_types`, `reaction_types`) sont embarquées,
  miroir exact de la migration `db/migrations/0002_reference_data.sql` ;
- si `DB_MOCK_SEED=true` (défaut), le **seed de démonstration La Réunion**
  (`seed/index.ts`) est chargé au boot — ses dates sont relatives au démarrage
  (`minutesAgo`), la démo est donc toujours fraîche ;
- les contraintes SQL (FK, UNIQUE, CHECK) sont reproduites en code avec des
  erreurs claires en français (ex. unicité `lower(email)`, une réaction par
  (user, cible), profondeur de commentaire ≤ 1 — option A) ;
- `updated_at` est posé en code, équivalent du trigger SQL `set_updated_at()` ;
- les requêtes géographiques (bbox carte, distances) passent par `mock/geo.ts`,
  équivalent en mémoire de PostGIS à l'échelle de La Réunion ;
- le référentiel `seed/communes.ts` ne couvre qu'une **sélection de 12 des
  24 communes** de La Réunion — le géocodage mock (étape 5) ne couvrira donc
  que cette sélection.

### Compteurs dénormalisés : recalculés, jamais déclarés

`followers_count`, `following_count`, `reaction_count`, `comment_count`,
`save_count` sont dénormalisés dans le schéma. Le seed **ne les déclare
jamais** : les types `Seed*` les excluent, et `MockDatabaseService` les
**recalcule depuis les données** après chargement (puis les repositories les
tiennent à jour à chaque mutation en recomptant). Une seule source de
cohérence — un compteur seed ne peut pas mentir. Exception : `share_count`
n'a pas de table source au Lot 1 (partage = lot ultérieur) et reste à 0.

Au démarrage, le service loggue :
`Mock DB prête : X utilisateurs, X follows, X posts (dont X visibles carte), ...`

## Bascule vers PostgreSQL (`DB_DRIVER=postgres`)

Aujourd'hui, `DB_DRIVER=postgres` **échoue volontairement au démarrage** avec
une erreur explicite : Docker/PostGIS et les migrations SQL sont validés, mais
les repositories SQL ne sont pas encore implémentés — on refuse de faire
semblant.

Quand le driver postgres sera livré, il s'ajoutera **sans toucher au code
métier** :

1. implémenter chaque interface de `repositories/interfaces.ts` en SQL
   (dans un futur dossier `postgres/`) ;
2. étendre les factories de `database.module.ts` pour choisir l'implémentation
   selon `database.driver` ;
3. garder les migrations `db/migrations/` validées (`0001` puis `0002`) ;
4. `DB_DRIVER=postgres` dans `.env` — mêmes tokens, mêmes interfaces, mêmes
   entités : rien d'autre ne change.

## Variables d'environnement

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `DB_DRIVER` | `mock` | `mock` (en mémoire) ou `postgres` (schéma validé, repositories API non implémentés) |
| `DB_MOCK_SEED` | `true` | Charger le seed de démonstration La Réunion (driver mock) |
| `DATABASE_URL`, `POSTGRES_*` | — | Réservées au futur driver postgres |

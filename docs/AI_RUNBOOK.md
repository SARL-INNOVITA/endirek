# ENDIREK — Runbook (AI_RUNBOOK)

> Comment lancer, tester et vérifier le projet. **Aucun secret réel dans ce fichier** : uniquement des comptes de développement du seed.
> Mettre à jour ce fichier dès qu'une commande, une procédure ou un compte de test change.

_Dernière mise à jour : Lot 2 — CP2.1 (Dealplace : taxonomie + listings) (2026-07-10)._

Prérequis : **Node ≥ 22** + npm (dans le PATH), **Flutter ≥ 3.44** + SDK Android. `DB_DRIVER=mock` reste le défaut et le fallback API ; **`DB_DRIVER=postgres` est fonctionnel** (Docker requis — voir §8 bis). Toutes les commandes `npm` se lancent depuis la **racine du monorepo** `ENDIREK/`.

> Sur la machine de dev actuelle, Flutter/adb/Java ne sont pas dans le PATH système. Chemins : Flutter `C:\Users\User\flutter\bin\flutter.bat`, JDK `C:\Program Files\Android\Android Studio\jbr`, Android SDK `C:\Users\User\AppData\Local\Android\Sdk`. Un autre environnement aura ces outils dans le PATH — adapter en conséquence.
> Sous PowerShell Windows, utiliser `npm.cmd` si l'exécution de `npm.ps1` est bloquée par la politique d'exécution locale.

---

## 1. Installation

```bash
npm install                              # installe les workspaces api + admin
cp apps/api/.env.example apps/api/.env   # optionnel : l'API démarre même sans .env (valeurs par défaut)
cp apps/admin/.env.example apps/admin/.env
```

---

## 2. Lancer les applications

### API (NestJS — port 3001)
```bash
npm run api:dev        # mode watch (développement)
npm run api:build      # compile → apps/api/dist
npm run api:start      # lance le build de production (node dist/main.js)
```
Au boot, le log affiche les URLs et le résumé du seed (voir §5).

### Backoffice admin (React + Vite — port 5173)
```bash
npm run admin:dev      # serveur de dev
npm run admin:build    # tsc -b && vite build → apps/admin/dist
```

### Mobile (Flutter)
```bash
cd apps/mobile
flutter pub get
flutter run                                   # émulateur/appareil Android
flutter run -d chrome                          # aperçu web rapide
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001   # émulateur → API de l'hôte
```
> `10.0.2.2` = localhost de la machine hôte vu depuis l'émulateur Android. Émulateur disponible : `Pixel_3a_API_34`.

> **Dépendances mobiles du checkpoint 5** (déjà dans `apps/mobile/pubspec.yaml`, installées par `flutter pub get`) : `flutter_map` (carte + tuiles OSM), `latlong2` (coordonnées), `socket_io_client` (temps réel). Aucune autre dépendance à ajouter.

---

## 3. Commandes de build & test (à lancer avant tout commit)

```bash
# API
npm run api:build                    # doit finir sans erreur

# Admin
npm run admin:build                  # tsc -b && vite build, sans erreur

# Mobile (depuis apps/mobile, PATH Flutter configuré)
flutter analyze                      # doit afficher "No issues found!"
flutter test                         # doit afficher "All tests passed!"
```

---

## 4. Endpoints de santé & documentation

| URL | Rôle |
|---|---|
| `http://localhost:3001/health` | Healthcheck public (hors préfixe, sans auth) → `{ status: "ok", ... }` |
| `http://localhost:3001/docs` | Documentation Swagger (OpenAPI) de toutes les routes |
| `http://localhost:3001/api/v1/...` | Routes métier (préfixe global, JWT requis sauf `@Public`) |
| `http://localhost:3001/uploads/...` | Médias uploadés (statique, public) |
| `ws://localhost:3001` (socket.io) | Temps réel (namespace par défaut, hors préfixe) — auth au handshake, events `notification.created` / `map.updated` |

Guide de démonstration Lot 1 : [DEMO_LOT_1.md](DEMO_LOT_1.md).

---

## 4 bis. Vérifier la carte, les caméras, les notifications (checkpoint 5)

Toutes ces routes exigent un Bearer token (voir §6 pour l'obtenir). Elles
sont aussi testables dans Swagger (`/docs`, bouton « Authorize »).

```bash
# Carte : posts + caméras en un seul appel (bbox optionnelle)
curl "http://localhost:3001/api/v1/map/overview" -H "Authorization: Bearer <TOKEN>"

# Caméras actives de la carte (filtre de catégorie optionnel)
curl "http://localhost:3001/api/v1/map/cameras?categories=traffic" -H "Authorization: Bearer <TOKEN>"

# Détail public d'une caméra active (404 si masquée/inactive/inexistante)
curl "http://localhost:3001/api/v1/cameras/<CAMERA_ID>" -H "Authorization: Bearer <TOKEN>"

# Notifications de l'utilisateur courant (+ total et unreadCount)
curl "http://localhost:3001/api/v1/notifications?limit=20" -H "Authorization: Bearer <TOKEN>"
curl "http://localhost:3001/api/v1/notifications/unread-count" -H "Authorization: Bearer <TOKEN>"
curl -X PATCH "http://localhost:3001/api/v1/notifications/read-all" -H "Authorization: Bearer <TOKEN>"

# Caméras au backoffice (rôle moderator/super_admin — 403 sinon)
curl "http://localhost:3001/api/v1/admin/cameras?status=hidden" -H "Authorization: Bearer <TOKEN_ADMIN>"
```

**Temps réel** : le socket WebSocket (socket.io) écoute sur le **même port
que l'API** (3001), namespace par défaut, **hors préfixe `api/v1`**.
L'authentification se fait au handshake (`auth.token` = access token). Le
plus simple pour vérifier bout-en-bout est de lancer l'app mobile connectée
à l'API : une réaction/un commentaire d'un autre compte fait apparaître la
notification en direct (badge de la cloche), et la création d'un post visible
carte déclenche un rafraîchissement (`map.updated`). Sans socket, le badge se
met à jour par polling (~45 s).

## 4 ter. Vérifier le backoffice consolidé (checkpoint 6)

Toutes ces routes demandent un token `moderator` ou `super_admin`.

```bash
# Types de posts pilotables
curl "http://localhost:3001/api/v1/admin/post-types" -H "Authorization: Bearer <TOKEN_ADMIN>"
curl -X PATCH "http://localhost:3001/api/v1/admin/post-types/weather" \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"defaultMapDurationMinutes":120,"showsOnMap":true,"isActive":true}'

# Filtres admin ajoutés
curl "http://localhost:3001/api/v1/admin/users?role=moderator&limit=20&offset=0" -H "Authorization: Bearer <TOKEN_ADMIN>"
curl "http://localhost:3001/api/v1/admin/posts?mapVisible=true&limit=20&offset=0" -H "Authorization: Bearer <TOKEN_ADMIN>"
curl "http://localhost:3001/api/v1/admin/reports?status=pending&targetType=comment&limit=20&offset=0" -H "Authorization: Bearer <TOKEN_ADMIN>"

# Modération d'un commentaire signalé (remplacer COMMENT_ID)
curl -X PATCH "http://localhost:3001/api/v1/admin/comments/<COMMENT_ID>/status" \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"hidden"}'

# Notification système dev/mock
curl -X POST "http://localhost:3001/api/v1/admin/notifications/system" \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"broadcast":true,"title":"Info Endirek","message":"Message de test"}'
```

Rappels : le slug d'un type de post n'est pas modifiable, les changements de
durée carte ne recalculent pas les posts existants, et les notifications
système sont in-app + WebSocket uniquement (pas de push FCM/APNs réel).

## 4 quater. Vérifier le Dealplace (Lot 2 — CP2.1)

Toutes ces routes exigent un Bearer token (§6). Testables aussi dans Swagger
(`/docs`, tag `dealplace` / `admin`). Le Dealplace fonctionne à l'identique en
mock (défaut) **et** en postgres (`DB_DRIVER=postgres`, migrations 0003/0004
appliquées — cf. §8/§8 bis, DB sur le port hôte **55432** sur cette machine).

```bash
# Taxonomie active servie au formulaire mobile (catégories + sous-catégories + tags)
curl "http://localhost:3001/api/v1/dealplace/taxonomy" -H "Authorization: Bearer <TOKEN>"

# Annuaire public paginé + filtres (family/category/subcategory/city/valueMin/valueMax/tags/search)
curl "http://localhost:3001/api/v1/dealplace/listings?family=good&limit=20&offset=0" -H "Authorization: Bearer <TOKEN>"

# Détail d'une annonce (par id ou par urlSlug public)
curl "http://localhost:3001/api/v1/dealplace/listings/<LISTING_ID>" -H "Authorization: Bearer <TOKEN>"
curl "http://localhost:3001/api/v1/dealplace/listings/slug/<URL_SLUG>" -H "Authorization: Bearer <TOKEN>"

# Créer une annonce (bien : photo obligatoire ; catégorie « forbidden » → 400 ;
# médias issus de POST /media/upload uniquement). Exemple minimal d'un service :
curl -X POST "http://localhost:3001/api/v1/dealplace/listings" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"listingType":"service","title":"Cours de guitare","description":"Débutants bienvenus","categorySlug":"cours-formation","subcategorySlug":"cours-musique-art","valueKind":"fixed","valueMin":25,"city":"Saint-Denis","exchangePrefs":["money"],"tags":["pro"]}'

# Mes annonces (active + hidden) et annonces d'un profil (active)
curl "http://localhost:3001/api/v1/users/me/listings" -H "Authorization: Bearer <TOKEN>"
curl "http://localhost:3001/api/v1/users/<USER_ID>/listings" -H "Authorization: Bearer <TOKEN>"

# ── Backoffice (rôle moderator/super_admin — 403 sinon) ──
# Taxonomie pilotable (GET tous statuts, POST, PATCH ; slug immuable)
curl "http://localhost:3001/api/v1/admin/dealplace/categories" -H "Authorization: Bearer <TOKEN_ADMIN>"
curl "http://localhost:3001/api/v1/admin/dealplace/subcategories?category=cours-formation" -H "Authorization: Bearer <TOKEN_ADMIN>"
curl "http://localhost:3001/api/v1/admin/dealplace/tags" -H "Authorization: Bearer <TOKEN_ADMIN>"

# Annonces au backoffice (tous statuts + filtres famille/catégorie/statut/recherche)
curl "http://localhost:3001/api/v1/admin/dealplace/listings?status=hidden&limit=20&offset=0" -H "Authorization: Bearer <TOKEN_ADMIN>"

# Masquer / republier une annonce (active|hidden uniquement ; deleted non restaurable → 409)
curl -X PATCH "http://localhost:3001/api/v1/admin/dealplace/listings/<LISTING_ID>/status" \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"hidden"}'
```

Rappels CP2.1 : valeur obligatoire (fixe ou fourchette), **photo obligatoire
pour un bien**, commune du référentiel La Réunion, catégorie « forbidden »
refusée à la création, **pas de signalement d'annonce côté utilisateur**, le
bouton mobile « Proposer un deal » est un **placeholder** (deals = CP2.4),
**paiement hors app**.

## 5. Log de boot attendu (seed mock)

```
Mock DB prête : 15 utilisateurs, 32 follows, 42 posts (dont 13 visibles carte), 60 commentaires, 155 réactions, 12 caméras, 4 signalements, 12 notifications, 8 annonces Dealplace (20 catégories, 79 sous-catégories, 10 tags)
```
Le suffixe Dealplace (annonces + taxonomie) a été ajouté au CP2.1. Si ce log
change après une modification non liée au seed, c'est un signal de régression à
investiguer.

---

## 6. Comptes de test (seed de développement — NON secret)

Mot de passe **commun à tous les comptes du seed** : `endirek974` (mot de passe de **développement**, jamais utilisé en production).

| Email | Rôle | Usage |
|---|---|---|
| `equipe@endirek.invalid` | `super_admin` | backoffice complet, tests admin |
| `marie.hoarau@endirek.invalid` | `moderator` | tests du second rôle admin / modération |
| (13 autres comptes) | `user` | tests utilisateur standard |

Les emails du seed utilisent le TLD `.invalid` (réservé RFC 2606, jamais routable). Emails exacts : voir `apps/api/src/database/seed/users.seed.ts`.

Exemple de connexion (récupère un `accessToken`) :
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"equipe@endirek.invalid","password":"endirek974"}'
```

---

## 7. Variables d'environnement importantes

Modèle complet et commenté : `apps/api/.env.example` (API) et `apps/admin/.env.example` (admin). **Ne jamais committer de vrai `.env`.**

| Variable | Défaut (dev) | Rôle |
|---|---|---|
| `PORT` | `3001` | port de l'API |
| `DB_DRIVER` | `mock` | `mock` (in-memory, fallback API) ou `postgres` (repositories SQL fonctionnels — Docker requis, voir §8 bis) |
| `DB_MOCK_SEED` | `true` | charge le seed La Réunion au boot (mock : à chaque boot ; postgres : une fois si la base est vide) |
| `DATABASE_URL` | `postgresql://endirek:endirek@localhost:5432/endirek` | chaîne de connexion PostgreSQL (prioritaire sur `POSTGRES_*`) — utilisée par `DB_DRIVER=postgres` |
| `MEDIA_STORAGE_DRIVER` | `local` | `local` (disque) ou `s3` (non implémenté) |
| `MEDIA_MAX_FILE_SIZE_MB` | `8` | taille max d'upload image |
| `GEOCODING_PROVIDER` | `mock` | géocodage inverse mock (12 communes, plus proche voisin) ; autre valeur → throw au boot |
| `GEOCODING_API_KEY` | *(vide)* | clé du géocodage réel (inutilisée en mock) |
| `MAP_PROVIDER` | `osm` | provider de tuiles (osm en dev) |
| `MAP_TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | URL des tuiles (public OSM en dev, provider dédié en prod) |
| `MAP_API_KEY` | *(vide)* | clé du provider de tuiles en prod (inutilisée avec OSM) |
| `PUSH_DRIVER` | `mock` | notifications in-app (base + WebSocket), pas de push distant |
| `EMAIL_DRIVER` | `mock` | emails logués en console |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | `change-me-*` | **valeurs factices** — à remplacer en production |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000,http://localhost:3001` | origines explicites ; en `NODE_ENV=development`, l'API ajoute aussi `http://localhost:<port>` et `http://127.0.0.1:<port>` pour Flutter Web |
| `VITE_API_URL` (admin) | `http://localhost:3001` | URL de l'API pour le backoffice |

---

## 8. PostgreSQL/PostGIS via Docker

PostGIS local est disponible via `infra/docker-compose.yml` :

```bash
docker compose -f infra/docker-compose.yml up -d postgres
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -U endirek -d endirek -c "SELECT postgis_version();"
```

Migrations (première base ou après `docker compose -f infra/docker-compose.yml down -v`) —
Lot 1 (`0001`, `0002`) **puis** Dealplace CP2.1 (`0003`, `0004`) :

```bash
docker cp apps/api/db/migrations/0001_lot1_init.sql endirek-postgres:/tmp/0001_lot1_init.sql
docker cp apps/api/db/migrations/0002_reference_data.sql endirek-postgres:/tmp/0002_reference_data.sql
docker cp apps/api/db/migrations/0003_dealplace_listings.sql endirek-postgres:/tmp/0003_dealplace_listings.sql
docker cp apps/api/db/migrations/0004_dealplace_reference.sql endirek-postgres:/tmp/0004_dealplace_reference.sql

docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U endirek -d endirek -f /tmp/0001_lot1_init.sql
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U endirek -d endirek -f /tmp/0002_reference_data.sql
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U endirek -d endirek -f /tmp/0003_dealplace_listings.sql
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U endirek -d endirek -f /tmp/0004_dealplace_reference.sql
```

État validé : conteneur `endirek-postgres` healthy, PostGIS 3.4 actif, 13 tables
métier Lot 1 + `spatial_ref_sys`, 5 `post_types`, 6 `reaction_types` ; CP2.1
ajoute 6 tables Dealplace (`listing_categories`, `listing_subcategories`,
`listing_tags`, `listings`, `listing_media`, `listing_tag_map`) + la taxonomie
de référence (20 catégories, sous-catégories, ~10 tags).

> Les migrations sont aussi applicables via le raccourci `npm run db:migrate`
> (copie + `psql -f` de **tout** le dossier `migrations/` dans l'ordre
> lexicographique — `0001`→`0004` — dans le conteneur, voir §8 bis).

> **Port hôte sur cette machine : `55432`.** Un PostgreSQL natif occupe déjà
> `5432`, donc le conteneur `endirek-postgres` est remappé sur `55432`
> (`DATABASE_URL=postgresql://endirek:endirek@127.0.0.1:55432/endirek`, déjà
> dans `apps/api/.env`). Les commandes `docker … exec … psql` ci-dessus
> fonctionnent indépendamment du port hôte (auth interne au conteneur). Détail
> et remèdes : §8 bis.

---

## 8 bis. Lancer en mode PostgreSQL (`DB_DRIVER=postgres`)

Depuis le Lot 1.5, l'API tourne réellement sur PostgreSQL/PostGIS avec un
comportement observable identique au mock.

**Prérequis** : Docker + le conteneur `endirek-postgres` démarré (§8).

1. **Démarrer la base** (si ce n'est pas déjà fait) :

   ```bash
   docker compose -f infra/docker-compose.yml up -d postgres
   ```

2. **Appliquer les migrations** (crée les 13 tables + insère
   `post_types`/`reaction_types`) — raccourci npm, ou `psql` manuel (§8) :

   ```bash
   npm run db:migrate --workspace apps/api
   ```

3. **Configurer l'environnement** (`apps/api/.env`) — `DATABASE_URL` est
   prioritaire sur les champs `POSTGRES_*` :

   ```env
   DB_DRIVER=postgres
   DATABASE_URL=postgresql://endirek:endirek@localhost:5432/endirek
   DB_MOCK_SEED=true
   ```

   Sous PowerShell, pour un lancement ponctuel sans éditer `.env` :

   ```powershell
   $env:DB_DRIVER="postgres"; $env:DATABASE_URL="postgresql://endirek:endirek@localhost:5432/endirek"; npm run api:dev
   ```

4. **Démarrer l'API** (`npm run api:dev`). Au premier boot sur une base vide, le
   seeder insère le seed La Réunion (idempotent, transaction). **Log de
   disponibilité attendu** :

   ```
   PostgreSQL prêt : connecté (15 utilisateurs, 32 follows, 42 posts (dont 13 visibles carte), 60 commentaires, 155 réactions, 12 caméras, 4 signalements, 12 notifications)
   ```

> **⚠️ Collision de port avec un PostgreSQL natif (Windows).** Sur une machine
> où un service **PostgreSQL natif** tourne déjà, il occupe `localhost:5432` et
> **masque le conteneur Docker** : l'API-hôte se connecte alors au postgres
> natif (mauvaise base, mot de passe refusé) au lieu du conteneur. Deux remèdes,
> au choix :
> - **arrêter/désactiver le service PostgreSQL natif** (libère 5432 pour le conteneur) ; ou
> - **remapper le conteneur sur un port libre** sans toucher au natif :
>   `POSTGRES_HOST_PORT=55432 docker compose -f infra/docker-compose.yml up -d`,
>   puis pointer `DATABASE_URL` (et `POSTGRES_PORT`) sur `55432`.
>
> **Sur la machine de dev actuelle, c'est le second remède qui est en place** :
> le conteneur est remappé sur le **port hôte `55432`**, et `apps/api/.env`
> contient déjà `DATABASE_URL=postgresql://endirek:endirek@127.0.0.1:55432/endirek`.
> Adapter les exemples `…@localhost:5432…` de ce fichier en conséquence sur cette
> machine.
>
> `docker exec endirek-postgres psql -U endirek -d endirek` fonctionne toujours
> (auth interne au conteneur), indépendamment de cette collision.

Pour repartir d'une base fraîche (vide puis re-seed au prochain boot) :
`npm run db:reset --workspace apps/api`.

Retour au mode par défaut : retirer `DB_DRIVER` (ou le mettre à `mock`).

   > Si le conteneur n'est pas là ou que les migrations manquent, le boot
   > **échoue tôt et clairement** (« Connexion PostgreSQL impossible… »).

5. **Re-seeder** (repartir d'une base fraîche) — vide les tables de données
   (référence conservée) ; le prochain boot re-seede si `DB_MOCK_SEED=true` :

   ```bash
   npm run db:reset --workspace apps/api
   ```

**Revenir au mock (défaut)** : remettre `DB_DRIVER=mock` dans `.env` (ou retirer
la variable d'environnement) et relancer `npm run api:dev`. Aucune infra requise,
seed rechargé en mémoire à chaque boot.

---

## 9. Vérification avant commit

1. `npm run api:build` → 0 erreur.
2. `npm run admin:build` → 0 erreur.
3. `cd apps/mobile && flutter analyze` → « No issues found! ».
4. `cd apps/mobile && flutter test` → « All tests passed! ».
5. Boot de l'API (`npm run api:dev`) → le **log de seed** (§5) est inchangé, `/health` répond 200, `/docs` charge.
6. `git status` → aucun `.env`, aucun secret, aucun dossier `01_PRD`/`02_MOCKUPS`/`03_PROMPTS`/`04_ACCESS` en attente d'ajout.
7. Un dossier `apps/api/uploads/` peut contenir des fichiers de test locaux — il est **ignoré par Git** (normal).

---

## 10. Checklist avant de passer au checkpoint suivant

- [ ] Toutes les vérifications du §9 passent.
- [ ] Les endpoints/écrans du checkpoint fonctionnent (test manuel ou curl — voir `docs/INSTALL.md` pour des exemples).
- [ ] Revue de cohérence API ↔ mobile ↔ admin ↔ docs effectuée, findings corrigés.
- [ ] `docs/AI_HANDOFF.md` mis à jour (dernier commit, statut des checkpoints, état des composants, prochaine étape).
- [ ] `docs/AI_DECISIONS.md` mis à jour **si** une nouvelle décision structurante a été prise.
- [ ] `docs/AI_RUNBOOK.md` mis à jour **si** une commande, procédure ou compte de test a changé.
- [ ] `docs/KNOWN_LIMITS.md` et les README concernés reflètent la réalité.
- [ ] Commit dédié au checkpoint créé.
- [ ] **Arrêt** et attente de la validation du product owner avant le checkpoint suivant.

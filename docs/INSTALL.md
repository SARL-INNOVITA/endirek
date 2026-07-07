# ENDIREK — Installation locale

Ce guide décrit l'installation complète de l'environnement de développement
sur une machine locale (référence : Windows 11, mais les commandes sont
identiques sur macOS/Linux sauf mention contraire).

> **État actuel du projet (fin d'étape 4 du Lot 1)** : le socle du monorepo
> est posé, la couche base de données est implémentée en mode mock
> (`DB_DRIVER=mock`, seed La Réunion — voir [DATABASE.md](DATABASE.md)) et
> les routes métier des étapes 3 et 4 sont fonctionnelles : auth, profils,
> follows, RGPD (étape 3) puis posts, feed scoré, commentaires, réactions,
> enregistrements, upload d'images, signalements et modération backoffice
> (étape 4) — voir « Tester l'API » ci-dessous. Ce guide restera valable
> pour toute la suite du Lot 1.

---

## 1. Prérequis

| Outil | Version minimale | Obligatoire ? | Vérification |
|---|---|---|---|
| Node.js | ≥ 22 (Node 24 testé) | Oui | `node -v` |
| npm | fourni avec Node | Oui (pas de pnpm/yarn) | `npm -v` |
| git | récent | Oui | `git --version` |
| Flutter | ≥ 3.44 | Oui pour l'app mobile | `flutter doctor` |
| Android SDK + émulateur | via Android Studio | Recommandé (cible Android) | `flutter doctor` |
| Docker | récent | **Optionnel mais recommandé** | `docker --version` |

> Docker n'est nécessaire que pour la vraie base PostgreSQL/PostGIS
> (voir section « Base de données »). Sans Docker, le projet fonctionne
> en mode `DB_DRIVER=mock` — c'est l'état actuel de la machine de dev.

---

## 2. Cloner le dépôt

```bash
git clone <URL_DU_DEPOT> ENDIREK
cd ENDIREK
```

## 3. Installer les dépendances Node (workspaces)

Le monorepo utilise les **npm workspaces** (`apps/api`, `apps/admin`).
Une seule installation à la **racine** suffit pour les deux :

```bash
npm install
```

(`apps/mobile` est un projet Flutter : ses dépendances sont gérées par
`flutter pub get`, lancé automatiquement par `flutter run`.)

## 4. Configurer les variables d'environnement

Copier les fichiers d'exemple, puis ajuster si besoin (les valeurs par
défaut suffisent pour le développement local) :

```bash
# API (NestJS)
cp apps/api/.env.example apps/api/.env

# Backoffice (Vite React)
cp apps/admin/.env.example apps/admin/.env
```

Équivalent PowerShell sous Windows :

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/admin/.env.example apps/admin/.env
```

Points d'attention :

- `apps/api/.env` : `PORT=3001`, `CORS_ORIGINS` (origines explicites ;
  en développement l'API autorise aussi automatiquement
  `http://localhost:<port>` et `http://127.0.0.1:<port>` pour Flutter Web),
  et surtout les **drivers**
  d'adapters : `DB_DRIVER`, `MEDIA_STORAGE_DRIVER`, `PUSH_DRIVER`,
  `EMAIL_DRIVER` (voir [MOCKED_SERVICES.md](MOCKED_SERVICES.md)).
- `apps/admin/.env` : `VITE_API_URL=http://localhost:3001`.
- **Aucun secret n'est requis** pour développer en local : toutes les
  intégrations externes ont un mode mock (voir
  [MOCKED_SERVICES.md](MOCKED_SERVICES.md)). Ne jamais commiter un `.env`.

## 5. Lancer les applications

Toutes les commandes npm se lancent depuis la **racine** du monorepo.

### API (NestJS — port 3001)

```bash
npm run api:dev
```

- Healthcheck : http://localhost:3001/health (hors préfixe, pour les sondes)
- Routes métier : préfixées `http://localhost:3001/api/v1/...`
  (auth/users depuis l'étape 3 ; posts, feed, commentaires, réactions,
  enregistrements, médias, signalements et admin posts/reports depuis
  l'étape 4)
- Documentation Swagger : http://localhost:3001/docs

#### Tester l'API (étapes 3 et 4)

**Rappel comptes seed** : le seed La Réunion (chargé si `DB_MOCK_SEED=true`,
défaut) fournit **15 comptes de démonstration** partageant le mot de passe
de dev `endirek974` — emails en `@endirek.invalid`, listés dans
`apps/api/src/database/seed/users.seed.ts`. Notamment
`equipe@endirek.invalid` (super_admin) et `marie.hoarau@endirek.invalid`
(moderator) pour les routes admin.

```bash
# Créer un compte
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"motdepasse123","displayName":"Compte Test"}'

# Se connecter avec un compte du seed (ex. la modératrice Marie Hoarau)
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"marie.hoarau@endirek.invalid","password":"endirek974"}'

# Profil courant (remplacer <ACCESS_TOKEN> par l'accessToken renvoyé ci-dessus)
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Le cœur social de l'étape 4 (remplacer `<ACCESS_TOKEN>` et `<POST_ID>` —
un id de post est renvoyé par la création ou par le feed) :

```bash
# Créer un post météo géolocalisé (visible carte 2 h — city déduite si omise)
curl -X POST http://localhost:3001/api/v1/posts \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"typeSlug":"weather","title":"Fortes pluies sur Saint-Denis","body":"Le Barachois est sous une grosse averse, prudence sur la route du littoral.","location":{"lat":-20.8789,"lng":55.4481},"city":"Saint-Denis"}'

# Fil d'actualité scoré (lat/lng optionnels : activent le bonus de proximité)
curl "http://localhost:3001/api/v1/posts/feed?limit=5&offset=0&lat=-20.8789&lng=55.4481" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# Commenter un post (parentCommentId en plus pour répondre à un commentaire)
curl -X POST http://localhost:3001/api/v1/posts/<POST_ID>/comments \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"body":"Merci pour le signalement, prudence à tous !"}'

# Réagir à un post (upsert : changer d'emoji remplace ; DELETE pour retirer)
curl -X POST http://localhost:3001/api/v1/posts/<POST_ID>/reactions \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"emoji":"👍"}'

# Enregistrer un post (collection « Général » — 204, idempotent)
curl -X POST http://localhost:3001/api/v1/posts/<POST_ID>/save \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# Signaler un post (motifs : spam, hateful, dangerous, false_info, other ;
# un second signalement de la même cible répond 409)
curl -X POST http://localhost:3001/api/v1/posts/<POST_ID>/report \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reasonCode":"spam","message":"Publicité répétée"}'

# Uploader une image (multipart, champ « file » — JPEG/PNG/WebP, 8 Mo max) :
# la réponse { url, thumbnailUrl, ... } se glisse dans le tableau media
# de POST /posts
curl -X POST http://localhost:3001/api/v1/media/upload \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -F "file=@photo.jpg"
```

Endpoints admin (jeton d'un compte `moderator` ou `super_admin`) :

```bash
# Publications côté backoffice (filtres optionnels typeSlug/status/search)
curl "http://localhost:3001/api/v1/admin/posts?status=active&limit=5" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# File des signalements (status=open par exemple), puis traitement
curl "http://localhost:3001/api/v1/admin/reports?status=open" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
curl -X PATCH http://localhost:3001/api/v1/admin/reports/<REPORT_ID> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"action_taken","resolutionNote":"Publication masquée"}'

# Masquer / republier une publication
curl -X PATCH http://localhost:3001/api/v1/admin/posts/<POST_ID>/status \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"hidden"}'
```

Toutes les routes (profils, follows, export RGPD, posts, feed, admin…) sont
documentées et testables dans **Swagger** : http://localhost:3001/docs
(bouton « Authorize » pour poser le Bearer token).

### Backoffice admin (React + Vite — port 5173)

```bash
npm run admin:dev
```

- Interface : http://localhost:5173
- La gestion des utilisateurs (liste, recherche, détail,
  suspension/réactivation) est fonctionnelle depuis l'étape 3. L'entrée est
  réservée aux rôles `moderator` / `super_admin` — se connecter avec le
  compte super admin du seed : **`equipe@endirek.invalid` / `endirek974`**
  (ou la modératrice `marie.hoarau@endirek.invalid`).

### Application mobile (Flutter)

```bash
cd apps/mobile
flutter run                # émulateur Android ou appareil branché
flutter run -d chrome      # alternative rapide dans le navigateur
```

`flutter run` liste les appareils disponibles si plusieurs sont détectés
(`flutter devices` pour vérifier ; l'émulateur Android est disponible sur
la machine de dev).

Écrans disponibles à l'étape 4 : **connexion**, **inscription**, le **shell
à 4 onglets** (Accueil = fil d'actualité réel ; Carte/News/Dealplace =
placeholders), le **fil** (pagination, pull-to-refresh, réactions,
enregistrement), la **création de post** (choix du type, photos via la
galerie, commune pour les types carte), le **détail d'un post**
(commentaires deux niveaux, réactions, signalement, édition/suppression si
auteur) ainsi que **profil** et **édition du profil**. Connexion possible
avec n'importe quel compte du seed (mot de passe `endirek974`).

L'URL de l'API est déduite automatiquement (web/desktop → `localhost:3001`,
émulateur Android → `10.0.2.2:3001`). Pour un appareil physique ou une API
distante, la forcer à la compilation :

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:3001
```

---

## 6. Base de données

Le schéma **PostgreSQL/PostGIS est la source de vérité** (posé à l'étape 2
dans `apps/api/db/migrations/`, documenté table par table dans
[DATABASE.md](DATABASE.md)). Deux voies possibles :

### Voie A — Docker (recommandée quand Docker est installé)

```bash
cd infra
docker compose up -d       # PostgreSQL 16 + PostGIS 3.4 sur localhost:5432
```

Puis dans `apps/api/.env` :

```env
DB_DRIVER=postgres
DATABASE_URL=postgresql://endirek:endirek@localhost:5432/endirek
```

Détails (vérification, arrêt, reset du volume) : [../infra/README.md](../infra/README.md).

> ⚠️ Le **driver postgres n'est pas encore implémenté** (étape 2 : seul le
> schéma SQL existe) : `DB_DRIVER=postgres` fait volontairement échouer le
> démarrage de l'API avec une erreur explicite. La procédure de bascule
> complète (migrations `psql`, implémentation du driver, seed SQL) est
> décrite dans [DATABASE.md](DATABASE.md) §7.

### Voie B — Sans Docker : `DB_DRIVER=mock` (état actuel)

Docker n'étant pas installé sur la machine de dev actuelle, l'API tourne avec :

```env
DB_DRIVER=mock
DB_MOCK_SEED=true
```

L'adapter mock est **implémenté** (étape 2) derrière la même interface que le
futur driver PostgreSQL : données en mémoire, contraintes du schéma reproduites
en code. Avec `DB_MOCK_SEED=true` (défaut), le **seed de démonstration
La Réunion** est chargé au démarrage — le boot de l'API affiche alors un log
de la forme :

```
Mock DB prête : X utilisateurs, X follows, X posts (dont X visibles carte), ...
```

`DB_MOCK_SEED=false` démarre sur une base mock vide (seules les données de
référence `post_types`/`reaction_types` sont chargées). Aucune installation
supplémentaire n'est requise. Schéma et décisions : [DATABASE.md](DATABASE.md) ;
limites de ce mode : [KNOWN_LIMITS.md](KNOWN_LIMITS.md).

---

## 7. Dépannage courant

### Port déjà occupé (3001 ou 5173)

```powershell
# Windows : identifier le processus qui tient le port
netstat -ano | findstr :3001
taskkill /PID <pid> /F
```

Ou changer le port : `PORT` dans `apps/api/.env` (penser à aligner
`VITE_API_URL` côté admin), option `--port` de Vite pour l'admin.

### Erreur CORS dans le backoffice ou le mobile web

En `NODE_ENV=development`, l'API autorise automatiquement les origines locales
`http://localhost:<port>` et `http://127.0.0.1:<port>` afin de couvrir le
backoffice Vite et Flutter Web (port dynamique). En production, seules les
origines listées dans `CORS_ORIGINS` sont autorisées. Redémarrer l'API après
toute modification de `apps/api/.env`.

### `flutter run` échoue ou aucun appareil détecté

```bash
flutter doctor -v          # diagnostique l'installation
flutter devices            # liste les appareils/émulateurs
```

- Démarrer un émulateur Android depuis Android Studio (Device Manager)
  ou `flutter emulators --launch <id>`.
- « Visual Studio absent » dans `flutter doctor` est **normal** sur cette
  machine : le build Windows desktop n'est pas une cible du projet
  (voir [KNOWN_LIMITS.md](KNOWN_LIMITS.md)).

### L'API ignore mes réglages / tourne avec les valeurs par défaut

L'API démarre **même sans `.env`** : chaque variable a une valeur de repli
sûre pour le dev (voir `apps/api/src/config/configuration.ts`). Si un
réglage semble ignoré, vérifier que `apps/api/.env` existe bien (copie du
`.env.example`, étape 4) et que la variable y est correctement nommée.
Même réflexe pour `apps/admin/.env` si le backoffice n'atteint pas l'API.

### `npm install` échoue

Vérifier `node -v` (≥ 22 requis, cf. champ `engines` du `package.json`
racine) et lancer l'installation depuis la **racine** du monorepo, pas
depuis un sous-dossier.

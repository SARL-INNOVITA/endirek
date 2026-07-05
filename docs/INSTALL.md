# ENDIREK — Installation locale

Ce guide décrit l'installation complète de l'environnement de développement
sur une machine locale (référence : Windows 11, mais les commandes sont
identiques sur macOS/Linux sauf mention contraire).

> **État actuel du projet (fin d'étape 1 du Lot 1)** : le socle du monorepo
> est posé. Côté API, seul `GET /health` est réellement fonctionnel ; les
> routes métier (`/api/v1/...`) et la base de données (réelle ou mockée)
> arrivent à partir de l'étape 2. Ce guide restera valable pour toute la
> suite du Lot 1.

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

- `apps/api/.env` : `PORT=3001`, `CORS_ORIGINS` (doit inclure
  `http://localhost:5173` pour le backoffice), et surtout les **drivers**
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
  (à partir de l'étape 3 — à l'étape 1, seul `/health` répond)
- Documentation Swagger : http://localhost:3001/docs

### Backoffice admin (React + Vite — port 5173)

```bash
npm run admin:dev
```

- Interface : http://localhost:5173 (écrans fonctionnels à l'étape 6)

### Application mobile (Flutter)

```bash
cd apps/mobile
flutter run                # émulateur Android ou appareil branché
flutter run -d chrome      # alternative rapide dans le navigateur
```

`flutter run` liste les appareils disponibles si plusieurs sont détectés
(`flutter devices` pour vérifier ; l'émulateur Android est disponible sur
la machine de dev).

---

## 6. Base de données

Le schéma **PostgreSQL/PostGIS est la source de vérité** (posé à l'étape 2).
Deux voies possibles :

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

### Voie B — Sans Docker : `DB_DRIVER=mock` (état actuel)

Docker n'étant pas installé sur la machine de dev actuelle, l'API tourne avec :

```env
DB_DRIVER=mock
```

Un adapter local (implémenté à **l'étape 2**, derrière la même interface que
le driver PostgreSQL) sert les données en mémoire, avec le seed La Réunion.
Aucune installation supplémentaire n'est requise. Limites de ce mode :
[KNOWN_LIMITS.md](KNOWN_LIMITS.md).

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

Vérifier que `CORS_ORIGINS` dans `apps/api/.env` contient l'origine
appelante (ex. `http://localhost:5173`). Redémarrer l'API après modification.

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

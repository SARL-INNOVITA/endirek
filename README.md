# ENDIREK

> « Endirek » — « en direct » en créole réunionnais.

Réseau social mobile local **temps réel** centré sur La Réunion : fil d'actualité social, carte live météo/trafic, News locales et Dealplace.

> **🤖 Agents IA** — Tout agent IA travaillant sur ce repo doit commencer par lire [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md), [docs/AI_DECISIONS.md](docs/AI_DECISIONS.md) et [docs/AI_RUNBOOK.md](docs/AI_RUNBOOK.md), puis vérifier `git status` avant de modifier le code. À la fin de chaque checkpoint, mettre à jour ces fichiers de passation.

## Structure du monorepo

| Dossier | Rôle |
|---|---|
| `apps/api` | Backend NestJS (API REST + WebSocket) — port 3001 |
| `apps/admin` | Backoffice web (React + Vite) — port 5173 |
| `apps/mobile` | Application mobile Flutter (Android / iOS / web de dev) |
| `infra/` | Docker Compose PostgreSQL/PostGIS — voie recommandée quand Docker est installé |
| `docs/` | Documentation : installation, architecture, démo Lot 1, services mockés, limites, TODO |
| `01_PRD` … `04_ACCESS` | Documents produit — **contexte local uniquement, non versionnés** (PRD global, mockups, prompts, matrice d'accès) |

## Démarrage rapide

```bash
# Backend + backoffice (Node ≥ 22)
npm install
npm run api:dev      # API → http://localhost:3001  (health: /health, doc Swagger: /docs)
npm run admin:dev    # Backoffice → http://localhost:5173

# Mobile (Flutter ≥ 3.44)
cd apps/mobile
flutter run          # émulateur Android, appareil physique ou -d chrome
```

Installation complète (dont PostgreSQL/PostGIS via Docker et l'alternative sans Docker) : [docs/INSTALL.md](docs/INSTALL.md).
Guide de démo Lot 1 : [docs/DEMO_LOT_1.md](docs/DEMO_LOT_1.md).

## État du projet — Lot 1 (socle + expérience Live Local)

- [x] Étape 1 — Socle du monorepo (API, admin, mobile, infra, docs)
- [x] Étape 2 — Schéma de base de données + seed La Réunion
- [x] Étape 3 — Auth, utilisateurs, profils, follows
- [x] Étape 4 — Posts, feed, interactions sociales, médias
- [x] Étape 5 — Carte, caméras, notifications, temps réel
- [x] Étape 6 — Backoffice minimal consolidé
- [x] Étape 7 — Audit final, stabilisation, polish, préparation démo

Le Lot 1 est stabilisé pour validation produit avant passage au Lot 2.

Les modules des lots suivants (Dealplace, deals, pages restaurants/entreprises, News IA, premium) sont **anticipés architecturalement** mais non développés dans le Lot 1 — voir `apps/api/src/modules/_future/` et [docs/TODO_LOT_2.md](docs/TODO_LOT_2.md).

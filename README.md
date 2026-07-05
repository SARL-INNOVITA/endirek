# ENDIREK

> « Endirek » — « en direct » en créole réunionnais.

Réseau social mobile local **temps réel** centré sur La Réunion : fil d'actualité social, carte live météo/trafic, News locales et Dealplace.

## Structure du monorepo

| Dossier | Rôle |
|---|---|
| `apps/api` | Backend NestJS (API REST + WebSocket) — port 3001 |
| `apps/admin` | Backoffice web (React + Vite) — port 5173 |
| `apps/mobile` | Application mobile Flutter (Android / iOS / web de dev) |
| `infra/` | Docker Compose PostgreSQL/PostGIS — voie recommandée quand Docker est installé |
| `docs/` | Documentation : installation, architecture, services mockés, limites, TODO |
| `01_PRD` … `04_ACCESS` | Documents produit (PRD global, mockups, prompts, matrice d'accès) |

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

## État du projet — Lot 1 (socle + expérience Live Local)

- [x] Étape 1 — Socle du monorepo (API, admin, mobile, infra, docs)
- [ ] Étape 2 — Schéma de base de données + seed La Réunion
- [ ] Étape 3 — Auth, utilisateurs, profils, follows
- [ ] Étape 4 — Posts, feed, interactions sociales, médias
- [ ] Étape 5 — Carte, caméras, notifications, temps réel
- [ ] Étape 6 — Backoffice minimal
- [ ] Étape 7 — Application mobile Flutter
- [ ] Étape 8 — Documentation, tests, données de démo

Les modules des lots suivants (Dealplace, deals, pages restaurants/entreprises, News IA, premium) sont **anticipés architecturalement** mais non développés dans le Lot 1 — voir `apps/api/src/modules/_future/` et [docs/TODO_LOT_2.md](docs/TODO_LOT_2.md).

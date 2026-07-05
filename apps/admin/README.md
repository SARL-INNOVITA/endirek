# Endirek — Backoffice web (`apps/admin`)

Backoffice d'administration d'**Endirek**, le réseau social mobile local temps
réel de La Réunion.

**Stack** : React 19 + Vite 7 + TypeScript — CSS pur, sans framework UI.

## Rôle (Lot 1)

Au Lot 1, ce workspace est un **squelette minimal** : une page d'accueil sobre
qui prouve le câblage avec l'API en appelant `GET /health` (badge « API en
ligne » / « API injoignable », bouton « Revérifier »). Le backoffice complet
sera développé à l'**étape 6**.

## Lancement

Depuis la **racine du monorepo** :

```bash
npm install          # une seule fois — installe tous les workspaces
npm run admin:dev    # démarre le serveur de développement Vite
```

Le backoffice est alors disponible sur **http://localhost:5173**.

> Astuce : lancez aussi l'API (`npm run api:dev`) pour voir le badge
> « API en ligne » avec la version, l'environnement et l'uptime.

## Configuration

Copiez `.env.example` en `.env` puis ajustez si besoin :

| Variable       | Description                                    | Défaut                  |
| -------------- | ---------------------------------------------- | ----------------------- |
| `VITE_API_URL` | URL de base de l'API Endirek (sans slash final) | `http://localhost:3001` |

Aucun secret ne doit être commité : `.env` est ignoré par git, et les
variables `VITE_*` sont exposées au navigateur (n'y mettre que des valeurs
publiques).

## Build de production

```bash
npm run admin:build   # tsc -b && vite build → apps/admin/dist
```

## Périmètre prévu à l'étape 6

- **Utilisateurs** : consultation, modération, suspension ;
- **Publications** : modération, mise en avant, suppression ;
- **Commentaires** : modération ;
- **Signalements** : file de traitement des contenus signalés ;
- **Caméras météo/trafic** : gestion des flux affichés dans l'app mobile ;
- **Paramètres des types de posts** : configuration des catégories de
  publications.

<!-- TODO Lot 2+ : statistiques d'usage, gestion fine des rôles,
     notifications push administrées, exports. -->

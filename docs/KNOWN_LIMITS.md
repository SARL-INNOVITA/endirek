# ENDIREK — Limites connues

État honnête des limites du projet **à l'étape 1 du Lot 1** (socle du
monorepo). Ce fichier est mis à jour au fil des étapes.

---

## 1. Pas de base de données réelle tant que Docker est absent

Docker n'est pas installé sur la machine de dev (Windows 11). La cible
PostgreSQL/PostGIS est prête côté infra (`infra/docker-compose.yml`) mais ne
peut pas tourner localement. Conséquence :

- l'API fonctionnera en `DB_DRIVER=mock` (adapter local implémenté à
  **l'étape 2**, même interface que le driver PostgreSQL) ;
- données en mémoire : **non persistées entre deux redémarrages** de l'API
  (hors seed) ;
- les requêtes géospatiales du mock (proximité) sont des approximations
  suffisantes pour le dev, pas des requêtes PostGIS réelles.

## 2. API réduite au healthcheck

À l'étape 1, l'API n'expose que `GET /health` (+ la coquille Swagger sur
`/docs`). **Aucune route métier `api/v1` n'existe encore** — elles arrivent
aux étapes 3 à 6. Ne pas s'étonner de 404 partout ailleurs.

## 3. Pas de push réel

`PUSH_DRIVER=mock` : aucune notification push n'est envoyée (pas de projet
Firebase ni de certificats APNs). Les notifications sont persistées en base
et visibles **in-app uniquement**. Voir [ACCESS_NEEDED.md](ACCESS_NEEDED.md) §4.

## 4. OAuth Google / Apple désactivé

Boutons désactivés côté mobile, endpoints API en `501 Not Implemented`.
Seule l'authentification email/mot de passe sera fonctionnelle (étape 3).

## 5. Tuiles OSM publiques = développement uniquement

La carte utilise les tuiles publiques d'OpenStreetMap, ce qui est toléré
pour un usage de dev léger mais **interdit en production à volume réel**
(respecter la [tile usage policy OSM](https://operations.osmfoundation.org/policies/tiles/)).
Prévoir un provider dédié en prod (MapTiler, Mapbox, serveur de tuiles
auto-hébergé…) via `MAP_TILE_URL` / `MAP_API_KEY` — aucun changement de code.

## 6. Pas de build Flutter Windows desktop

Visual Studio (avec la charge « Développement Desktop C++ ») n'est pas
installé : `flutter doctor` le signale et le build Windows desktop est
indisponible. **Non bloquant et non nécessaire** : les cibles du projet sont
Android/iOS (+ `flutter run -d chrome` pour un aperçu rapide en dev).

## 7. Pas de tests automatisés avant l'étape 8

Les tests (unitaires et e2e API notamment) sont planifiés à **l'étape 8**
du Lot 1, avec la documentation finale et les données de démo. D'ici là,
la vérification est manuelle (Swagger, app mobile, backoffice).

## 8. Rappels de périmètre

- News et Dealplace sont des **onglets placeholders** au Lot 1 (développés
  aux lots suivants — voir [TODO_LOT_2.md](TODO_LOT_2.md)).
- Les modes carte « Offres & restos » et « Événements » sont visibles mais
  placeholders ; seul « Météo & trafic » est réel au Lot 1.
- Email : driver `mock` (contenu logué en console) tant que Brevo n'est pas
  fourni — pas de vrai envoi de mails de vérification/reset.

# ENDIREK — Limites connues

État honnête des limites du projet **à l'étape 3 du Lot 1** (socle, couche
base de données, auth/profils/follows/RGPD). Ce fichier est mis à jour au
fil des étapes.

---

## 1. Pas de base de données réelle tant que Docker est absent

Docker n'est pas installé sur la machine de dev (Windows 11). La cible
PostgreSQL/PostGIS est prête côté infra (`infra/docker-compose.yml`) et côté
schéma (`apps/api/db/migrations/`, voir [DATABASE.md](DATABASE.md)) mais ne
peut pas tourner localement. Conséquence :

- l'API fonctionne en `DB_DRIVER=mock` (adapter local **implémenté à
  l'étape 2**, mêmes interfaces de repositories que le futur driver
  PostgreSQL) ;
- données en mémoire : **non persistées entre deux redémarrages** de l'API.
  Le seed de démonstration La Réunion est rechargé à chaque boot (si
  `DB_MOCK_SEED=true`, défaut) avec des **timestamps relatifs au démarrage**
  — la démo est donc toujours fraîche, mais toute donnée créée au runtime
  est perdue au redémarrage ;
- le SQL PostGIS n'a **pas encore été validé par exécution** contre une
  vraie base (Docker absent) : la première application des migrations fait
  partie de la procédure de bascule ([DATABASE.md](DATABASE.md) §7) ;
- les requêtes géospatiales du mock (proximité, bbox) sont des approximations
  suffisantes pour le dev, pas des requêtes PostGIS réelles.

## 2. Périmètre de l'API à l'étape 3

L'API expose désormais, en plus de `GET /health` et de Swagger (`/docs`),
les routes métier `api/v1` de l'étape 3 :

- **auth** : `POST /auth/register|login|refresh|logout`, `GET /auth/me`,
  placeholders OAuth `POST /auth/oauth/google|apple` (501) ;
- **users** : `GET|PATCH /users/me/profile`, `GET /users/me/export` (RGPD),
  `DELETE /users/me` (RGPD), `GET /users/:id`, `POST|DELETE /users/:id/follow`,
  `GET /users/:id/followers|following` ;
- **admin** : `GET /admin/users`, `GET /admin/users/:id`,
  `PATCH /admin/users/:id/status` (rôles moderator/super_admin).

Les routes posts/feed/carte/notifications arrivent aux étapes 4 à 6 : ne pas
s'étonner de 404 sur le reste.

## 2 bis. Limites de l'authentification (étape 3)

- **Refresh token non révocable** : l'auth est stateless, le serveur ne tient
  aucune liste de révocation — `POST /auth/logout` ne révoque rien (le client
  jette ses jetons). Compensation : le guard recharge l'utilisateur et
  revérifie son statut à chaque requête (comptes supprimés/suspendus
  immédiatement rejetés — voir [RGPD.md](RGPD.md)). La révocation unitaire
  viendra avec la persistance des refresh tokens (**TODO**).
- **Pas de vérification d'email ni de reset de mot de passe** : ces flux ne
  sont **pas implémentés** au Lot 1 (l'adapter email Brevo est mocké, mais
  surtout aucun flux ne l'appelle encore — **TODO**). Un email oublié =
  compte inaccessible ; un email saisi n'est jamais vérifié.
- **Mot de passe de dev commun du seed** : les 15 comptes seed partagent le
  mot de passe `endirek974` (haché bcrypt comme en réel). Pratique en local,
  à ne **jamais** transposer en production.
- **Jetons mobile en stockage sécurisé… sauf sur le web** :
  `flutter_secure_storage` utilise le Keystore Android / Keychain iOS, mais
  retombe sur le `localStorage` du navigateur en cible web — **non sécurisé**
  (lisible par tout script, XSS). Acceptable pour le dev web uniquement ;
  cible prod web : cookies httpOnly posés par le backend.
- **Jeton du backoffice en `localStorage`** : choix assumé pour le
  développement (simple, survit au rechargement) mais exposé au vol de jeton
  en cas de XSS — durcissement prévu (cookie httpOnly / session serveur).
- **Pas de rate limiting** : aucune limitation de débit sur login/register
  (force brute possible) — **TODO** avant toute exposition publique.

## 3. Pas de push réel

`PUSH_DRIVER=mock` : aucune notification push n'est envoyée (pas de projet
Firebase ni de certificats APNs). Les notifications sont persistées en base
et visibles **in-app uniquement**. Voir [ACCESS_NEEDED.md](ACCESS_NEEDED.md) §4.

## 4. OAuth Google / Apple désactivé

Boutons désactivés côté mobile (mention « bientôt disponible »), endpoints
API réels mais répondant `501 Not Implemented`
(`POST /api/v1/auth/oauth/google|apple`). Seule l'authentification
email/mot de passe est fonctionnelle (étape 3 faite).

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
- Email : driver `mock` tant que Brevo n'est pas fourni — et surtout, les
  flux de vérification d'email / reset de mot de passe ne sont **pas
  implémentés** au Lot 1 (voir §2 bis).

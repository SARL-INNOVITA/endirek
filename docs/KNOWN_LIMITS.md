# ENDIREK — Limites connues

État honnête des limites du projet **à l'étape 5 du Lot 1** (socle, couche
base de données, auth/profils/follows/RGPD, posts/feed/interactions/médias,
puis carte/caméras/notifications/temps réel). Ce fichier est mis à jour au
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

## 2. Périmètre de l'API à l'étape 5

L'API expose désormais, en plus de `GET /health` et de Swagger (`/docs`),
les routes métier `api/v1` des étapes 3 à 5 :

- **auth** (étape 3) : `POST /auth/register|login|refresh|logout`,
  `GET /auth/me`, placeholders OAuth `POST /auth/oauth/google|apple` (501) ;
- **users** (étape 3) : `GET|PATCH /users/me/profile`, `GET /users/me/export`
  (RGPD), `DELETE /users/me` (RGPD), `GET /users/:id`,
  `POST|DELETE /users/:id/follow`, `GET /users/:id/followers|following` ;
- **posts** (étape 4) : `GET /posts/types`, `GET /posts/feed`, `POST /posts`,
  `GET /posts/slug/:slug`, `GET|PATCH|DELETE /posts/:id`,
  `GET /users/me/posts`, `GET /users/:id/posts` ;
- **commentaires** (étape 4) : `GET|POST /posts/:id/comments`,
  `DELETE /comments/:id` ;
- **réactions** (étape 4) : `POST|DELETE /posts/:id/reactions`,
  `POST|DELETE /comments/:id/reactions` ;
- **enregistrements** (étape 4) : `POST|DELETE /posts/:id/save`,
  `GET /users/me/saved-posts` ;
- **médias** (étape 4) : `POST /media/upload` (+ fichiers statiques publics
  sur `/uploads/`, hors préfixe et hors guard) ;
- **signalements** (étape 4) : `POST /posts/:id/report` (anti-doublon 409) ;
- **carte** (étape 5) : `GET /map/overview` (posts + caméras en un appel),
  `GET /map/cameras`, `GET /map/posts` (marqueurs), `GET /map/communes` —
  bbox et filtres de type/catégorie optionnels ;
- **caméras** (étape 5) : `GET /cameras/:id` (détail public, caméra `active`
  uniquement — 404 sinon, sans divulguer l'existence d'une caméra masquée) ;
- **notifications** (étape 5) : `GET /notifications` (paginé, avec `total` et
  `unreadCount`), `GET /notifications/unread-count`,
  `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`
  (uniquement les notifications de l'utilisateur courant) ;
- **admin** (étapes 3 à 5) : `GET /admin/users[/:id]`,
  `PATCH /admin/users/:id/status`, `GET /admin/posts[/:id]`,
  `PATCH /admin/posts/:id/status`, `GET /admin/reports`,
  `PATCH /admin/reports/:id`, et les 6 routes caméras
  `GET|POST /admin/cameras`, `GET|PATCH|DELETE /admin/cameras/:id`,
  `PATCH /admin/cameras/:id/status` (rôles moderator/super_admin ;
  `DELETE` = masquage doux).

Le temps réel passe par un socket WebSocket (socket.io, namespace par défaut,
non préfixé `api/v1`), pas par une route HTTP. Le complément backoffice
(paramètres des types de posts, affinages) arrive à l'étape 6 : ne pas
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

## 2 ter. Limites du cœur social (étape 4)

- **Uploads orphelins non nettoyés** : `POST /media/upload` stocke le
  fichier immédiatement, mais rien ne rattache l'upload à un post tant que
  `POST /posts` n'est pas appelé avec l'URL retournée. Un upload jamais
  attaché (composer abandonné) reste sur le disque indéfiniment — aucun
  job de nettoyage au Lot 1 (**TODO** : purge des fichiers non référencés).
- **Pas de vidéos** : upload d'images uniquement (JPEG, PNG, WebP, validées
  par décodage réel). Les vidéos (transcodage, poster frame) arrivent dans
  un lot ultérieur — le schéma (`post_media.media_type`) est déjà prêt.
- **Partage non fonctionnel** : le bouton « Partager » du mobile affiche
  « Partage disponible prochainement » et **aucun endpoint de partage
  n'existe** — `posts.share_count` n'est jamais incrémenté au Lot 1 (il
  reste à 0 ; la colonne et le compteur du contrat FEED_POST sont prêts).
  **TODO** (lot ultérieur) : partage natif + endpoint de comptage.
- **Pagination du feed en offset/limit** : suffisant sur le mock, mais un
  vrai cursor (keyset) est prévu avec le driver postgres — l'offset se
  décale quand de nouveaux posts arrivent entre deux pages.
- **Fenêtre de scoring de 200 posts** : le feed ne score que les 200 posts
  `active` les plus récents (`FEED_WEIGHTS.windowSize`) ; `total` renvoyé =
  taille de cette fenêtre, pas le nombre total de posts en base. Un post
  plus ancien que la fenêtre disparaît du feed même s'il est populaire.
## 2 quater. Limites de la carte, des caméras et du temps réel (étape 5)

- **Tuiles OSM = développement uniquement** : la carte mobile charge les
  tuiles publiques d'OpenStreetMap (`flutter_map`), toléré en dev mais
  **interdit en production à volume réel** — provider dédié à prévoir via
  `MAP_TILE_URL`/`MAP_API_KEY`, sans changement de code (rappel détaillé en
  §5).
- **Flux caméra vidéo/iframe non affichés dans l'app** : seul
  `streamType='image'` est rendu (image live + badge LIVE) ; les flux
  `video`/`iframe` affichent une vignette et « Flux non affichable dans
  l'application » — l'intégration lecteur vidéo/webview arrive plus tard.
- **Pas de présence temps réel** : le « N personnes ici » des mockups n'est
  **pas implémenté** (aucun comptage de présence sur la carte au Lot 1).
- **Temps réel = notifications + `map.updated` seulement** : le socket
  (socket.io) ne pousse que `notification.created` et `map.updated`. **Pas
  de messagerie** ni de présence. Le temps réel est un **confort, pas une
  source de vérité** : les listes et le badge restent alimentés par REST.
- **Fallback polling ~45 s** : si le socket est indisponible (réseau, proxy),
  le client retombe sur `GET /notifications/unread-count` toutes les ~45 s —
  la fraîcheur des non-lues est donc dégradée hors socket.
- **Clustering client-side** : le regroupement des marqueurs proches se fait
  côté client (grille maison). Suffisant au volume du Lot 1 ; un clustering
  serveur est à prévoir à grande échelle.
- **GPS réel toujours absent** : la carte est centrée sur l'île, sans
  géolocalisation de l'appareil — pas de « autour de moi », la position de
  publication reste choisie par commune (voir §8).

## 2 quinquies. Autres limites du cœur social (étape 4)

- **Notification `reaction` désormais branchée** : les réactions sur un post
  notifient son auteur (`reaction`, jamais à soi-même), au même titre que
  `comment`/`reply` et `report_handled` (traitement de signalement) — toutes
  lisibles via les endpoints de l'étape 5.

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

La carte mobile (`flutter_map`) utilise les tuiles publiques
d'OpenStreetMap, ce qui est toléré pour un usage de dev léger mais
**interdit en production à volume réel**
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
- L'onglet Carte du mobile est **réel depuis l'étape 5** (mode « Météo &
  trafic » : posts géolocalisés + caméras actives, clustering, cartes de
  preview). Les modes carte « Offres & restos » et « Événements » relèvent
  des lots suivants — seul « Météo & trafic » est réel au Lot 1.
- Email : driver `mock` tant que Brevo n'est pas fourni — et surtout, les
  flux de vérification d'email / reset de mot de passe ne sont **pas
  implémentés** au Lot 1 (voir §2 bis).

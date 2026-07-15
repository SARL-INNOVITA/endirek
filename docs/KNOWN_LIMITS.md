# ENDIREK — Limites connues

État honnête des limites du projet **au Lot 1 (checkpoint 7 + Lot 1.5) et au
Lot 2 complet (CP2.1 → CP2.5)** : socle, couche base de données,
auth/profils/follows/RGPD, posts/feed/interactions/médias,
carte/caméras/notifications/temps réel, consolidation backoffice,
stabilisation démo, puis **Dealplace complet** (taxonomie + annonces, profil,
conversations, deals + avis, modération avancée).
Ce fichier est mis à jour au fil des checkpoints.

---

## 1. Base de données : deux drivers, nuances du mode postgres (Lot 1.5)

Depuis le Lot 1.5, l'API tourne au choix en `DB_DRIVER=mock` (défaut) **ou**
`DB_DRIVER=postgres` (repositories SQL fonctionnels, `pg` + SQL brut), avec un
comportement observable identique. Le driver postgres n'est donc plus une limite,
mais garde quelques nuances assumées :

- **Mode mock (défaut)** : données en mémoire, **non persistées entre deux
  redémarrages**. Le seed La Réunion est rechargé à chaque boot (si
  `DB_MOCK_SEED=true`) avec des **timestamps relatifs** — démo toujours fraîche,
  mais toute donnée créée au runtime est perdue au redémarrage. Les requêtes
  géospatiales du mock (proximité, bbox) sont des **approximations** suffisantes
  pour le dev, pas des requêtes PostGIS réelles.
- **Mode postgres** : les données **persistent** en base. Le seed n'est inséré
  **qu'une seule fois si la table `users` est vide** (idempotent, transaction) —
  pour repartir d'une base fraîche, `npm run db:reset` puis relancer l'API.
- **Compteurs dénormalisés calculés À LA LECTURE** en mode postgres
  (`reactionCount`, `commentCount`, `saveCount`, `followersCount`…) : ils sont
  recalculés par sous-requête/JOIN à chaque lecture (parité de comportement avec
  le mock), les colonnes compteur de la base n'étant pas maintenues à l'écriture.
  **TODO perf** : à très grande échelle, prévoir des triggers/colonnes maintenues
  plutôt que le recalcul systématique — non requis au Lot 1.
- **Prérequis postgres** : conteneur Docker `endirek-postgres` démarré +
  migrations appliquées (`npm run db:migrate` applique 0001→0004, dont les tables
  Dealplace du CP2.1), sinon le boot échoue tôt avec un message explicite. **Sur
  cette machine, le conteneur est sur le port hôte `55432`** (un PostgreSQL natif
  occupe 5432) — voir [AI_RUNBOOK.md](AI_RUNBOOK.md) §8 bis.

## 2. Périmètre de l'API au checkpoint 7

L'API expose désormais, en plus de `GET /health` et de Swagger (`/docs`),
les routes métier `api/v1` des étapes 3 à 6 :

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
- **admin** (étapes 3 à 6) : `GET /admin/users[/:id]`,
  `PATCH /admin/users/:id/status`, `GET /admin/posts[/:id]`,
  `PATCH /admin/posts/:id/status`, `GET /admin/reports`,
  `PATCH /admin/reports/:id`, et les 6 routes caméras
  `GET|POST /admin/cameras`, `GET|PATCH|DELETE /admin/cameras/:id`,
  `PATCH /admin/cameras/:id/status`, `GET|PATCH /admin/post-types`,
  `PATCH /admin/comments/:id/status`,
  `POST /admin/notifications/system` (rôles moderator/super_admin ;
  `DELETE` caméra = masquage doux).

Le temps réel passe par un socket WebSocket (socket.io, namespace par défaut,
non préfixé `api/v1`), pas par une route HTTP. **Le Lot 2 ajoute les routes
Dealplace** (`/dealplace/*`, `/users/me|:id/listings`, `/conversations*`,
`/deals*`, `/users/:id/deal-profile`, `/admin/dealplace/*` — voir §2 sexies).
Les modules des lots non démarrés restent volontairement absents : ne pas
s'étonner de 404 sur les pages restaurants/entreprises ou les News.

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
- **Paramètres `post_types` non rétroactifs** : changer
  `default_map_duration_minutes`, `showsOnMap` ou `isActive` agit sur les
  nouvelles créations et sur les listes référentielles, mais ne recalcule pas
  `map_expires_at` des posts existants.
- **Signalement de commentaires côté utilisateur absent** : le schéma et la
  file admin supportent `targetType=comment`, et le backoffice peut
  masquer/soft-delete un commentaire signalé, mais l'UI mobile n'expose pas
  encore d'action « signaler ce commentaire » au Lot 1.
- **Pagination du feed en offset/limit** : identique en mock et en postgres
  (le driver SQL reproduit le comportement du mock) ; un vrai cursor (keyset)
  reste **TODO** — l'offset se décale quand de nouveaux posts arrivent entre
  deux pages.
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
- **Temps réel = notifications + `map.updated` + messages (CP2.3)** : le
  socket (socket.io) pousse `notification.created`, `map.updated` et
  `message.created`. Pas de présence, pas d'indicateur de frappe. Le temps
  réel est un **confort, pas une source de vérité** : les listes et les
  badges restent alimentés par REST.
- **Fallback polling ~45 s** : si le socket est indisponible (réseau, proxy),
  le client retombe sur `GET /notifications/unread-count` et
  `GET /conversations/unread-count` toutes les ~45 s — la fraîcheur des
  non-lus est donc dégradée hors socket.
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

## 2 sexies. Limites du Dealplace (Lot 2 — CP2.1 → CP2.5)

Le Lot 2 est complet : taxonomie + annonces (CP2.1), profil sans avis
(CP2.2), conversations (CP2.3), deals + avis (CP2.4), modération avancée
(CP2.5 — signalement d'annonce, arbitrage des litiges, modération des
messages). Limites restantes :

- **Deals volontairement bornés (D64/D66)** : les ajustements ne modifient
  pas les SOUS-ÉLÉMENTS (seulement nature/titre/description/valeur des
  éléments) ; l'échéance est indicative (pas de rappel) ; la **valeur des
  éléments est indicative** — le paiement se règle hors app ; un avis n'est
  ni modifiable ni supprimable. Le litige est arbitré par un HUMAIN au
  backoffice (D66) — l'**arbitrage IA** reste un chantier futur (adapter à
  prévoir, D22) ; un litige déjà tranché ne se re-arbitre pas (409) ; le
  backoffice n'annule jamais un deal SAIN (pas de levier hors litige).
- **Messagerie (CP2.3/CP2.5) volontairement minimale (D63/D67)** : fils
  TOUJOURS liés à une annonce (pas de message direct sans annonce), **texte
  seul** (pas de pièces jointes malgré l'adapter média prêt), pas
  d'édition/suppression de message, pas de groupe, pas d'indicateur de
  frappe ni d'accusé par message (jalon de lecture par fil). Pages des fils
  bornées à 50 messages côté mobile (pagination profonde à brancher avec
  l'usage réel). Le **masquage d'un message par la modération n'émet pas
  d'event socket** : un fil ouvert ne reflète le masquage qu'à sa
  réouverture (D67 — REST source de vérité). Pas de signalement de MESSAGE
  côté utilisateur (la modération parcourt les fils au backoffice).
- **Pas d'avis au CP2.2 (décision D59)** : le volet Profil Dealplace est livré
  SANS note, critères ni historique d'échanges — les avis détaillés sont
  construits AVEC les deals au **CP2.4**. Les blocs avis / « X deals
  réalisés » / « Deals conclus » du mockup 05 sont des **placeholders
  visibles** (pastille « Bientôt »). Le profil expose « Ce que je recherche »
  (public, 500 caractères) et les annonces par famille (Services / Biens,
  50 max par section — pagination à prévoir avec la croissance des profils).
  Pas de bouton « partager le profil » ni de badge type « DealPlace partner »
  (mockup) au CP2.2.
- **Signalement d'annonce livré au CP2.5 (D65)** ; en revanche le
  signalement de **profil** (`targetType=user`) n'a toujours pas d'endpoint
  utilisateur (le schéma le supporte). Une annonce **`deleted` n'est jamais
  restaurée** (409) ; seul le propriétaire supprime (soft-delete).
- **Paiement hors application** : aucun flux de paiement dans l'app (décision
  produit) — la valeur d'une annonce est **indicative** (fixe ou fourchette),
  l'échange se règle hors app.
- **Filtre par commune, pas par rayon** : l'annuaire filtre par `city` (commune
  du référentiel La Réunion), `family`, `category`, `subcategory`, fourchette de
  valeur, `tags` et `search` (titre/description). Il **n'y a pas encore de
  recherche par proximité géographique** (rayon autour d'un point) — prévu en
  réutilisant le module `map`. L'adresse exacte n'est jamais stockée : la
  `location` d'une annonce est le **centre de la commune**.
- **Pas de vidéos** : les médias d'annonce sont des **images** (upload via
  `/media/upload`, mêmes règles que les posts) ; le schéma `listing_media`
  prévoit `video` mais l'app ne le produit pas au CP2.1.
- **Type d'annonce, commune et médias non modifiables** en édition
  (`PATCH /dealplace/listings/:id`) au CP2.1 : seuls titre, description, valeur,
  catégorie/sous-catégorie, préférences d'échange, liens externes et tags sont
  éditables.
- **Taxonomie : slug immuable** : le backoffice édite libellés, positions,
  activation et `moderation_level`, mais ne renomme pas un slug ni la famille
  d'une catégorie / la catégorie parente d'une sous-catégorie.

## 2 septies. Limites des pages restaurants & entreprises (Lot 3)

- **Changement de propriétaire de page non implémenté** : le « changement de
  compte » du module Pages du PRD §13 (transfert d'une page à un autre
  utilisateur) reste V2 — au Lot 3, une page appartient définitivement à son
  créateur.
- **Pas de réservation restaurant** : jamais au MVP (PRD §12, décision
  produit ferme).
- **Offres exceptionnelles = monétisation future** : seuls les types
  « Offre du jour » et « Événement » sont livrés ; l'« offre
  exceptionnelle » animée/payante du PRD relève du chantier monétisation.
- **URL web publique des pages non rendue** : `url_slug` existe et est
  servi (`GET /pages/slug/:slug`), mais le rendu web partageable/SEO est un
  chantier transverse (comme pour les posts et annonces).
- **Post de page = INSTANTANÉ** : publier un menu/une offre/un événement
  compose le post à partir de l'entité AU MOMENT de la publication ;
  modifier ensuite l'entité ne met pas le post à jour (republier si besoin).
- **Menu/offre publiés après 23 h Réunion** : la fenêtre carte (jusqu'à
  23 h le jour même — D73) est déjà close, le post reste feed-only
  (comportement assumé).
- **Pas de notification aux abonnés d'une page** lors d'une publication
  (anti-flood — le feed, le bonus d'abonnement et la carte s'en chargent).
- **Pas de marqueurs de PAGES sur la carte** : seules leurs PUBLICATIONS
  (menu/offre/événement) y apparaissent. Les chips de mode de la carte
  (« Offres & restos », « Événements ») sont depuis le CP3.R1 des bascules
  rapides des filtres de PUBLICATIONS correspondants ; les modes carte
  complets « Offres & restos » (restaurants permanents, filtre « ouvert
  maintenant ») et « Événements » du PRD §7 restent à construire.
- **Horaires** : pas de plage à cheval sur minuit (ouverture < fermeture le
  même jour) ; fuseau unique La Réunion (UTC+4 fixe) — pas de multi-fuseaux.
- **Prix des menus = ceux des plats** : pas de prix spécifique par menu du
  jour (le mockup n'en montre pas) ; modifier le prix d'un plat vaut pour
  tous les menus qui l'affichent.
- **Documents « Nos cartes »** : détacher un document supprime la ligne mais
  ne purge pas le fichier uploadé (même limite que les autres uploads
  orphelins — §2 ter). Les PDF du SEED pointent vers un PDF public de
  démonstration (équivalent picsum), remplacés par de vrais uploads à
  l'usage.
- **Pas d'analytics pages** (menus publiés, cartes téléchargées,
  itinéraires... — PRD §15) : chantier transverse analytics.

## 3. Pas de push réel

`PUSH_DRIVER=mock` : aucune notification push n'est envoyée (pas de projet
Firebase ni de certificats APNs). Les notifications sont persistées en base
et visibles **in-app uniquement**. Les notifications système créées depuis le
backoffice checkpoint 6 sont également in-app + WebSocket seulement. Voir
[ACCESS_NEEDED.md](ACCESS_NEEDED.md) §4.

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

## 7. Couverture de tests encore partielle

Les tests mobiles Flutter couvrent déjà le clustering, la présentation des
notifications, les cartes de post et un smoke test de connexion. En revanche,
il n'existe pas encore de suite automatisée API e2e ni de tests backoffice
React complets. La vérification API/admin reste donc principalement assurée par
les builds, Swagger/curl et la démo manuelle. **TODO avant exposition publique** :
ajouter des tests e2e API sur auth/ownership/modération/carte/notifications et
des tests backoffice sur les actions critiques.

## 8. Rappels de périmètre

- **News** reste un **onglet placeholder** (Lot 4). **Dealplace est COMPLET
  depuis le CP2.5** (annuaire/création/détail d'annonces, profil,
  conversations temps réel, deals contractuels + avis, signalement
  d'annonce, arbitrage des litiges et modération des messages au
  backoffice) — voir §2 sexies et [TODO_LOT_2.md](TODO_LOT_2.md) pour les
  limites restantes.
- L'onglet Carte du mobile est **réel depuis l'étape 5** (mode « Météo &
  trafic » : posts géolocalisés + caméras actives, clustering, cartes de
  preview) et affiche depuis le Lot 3 les publications de page
  (menu/offre/événement). Les modes carte complets « Offres & restos »
  (restaurants permanents) et « Événements » du PRD §7 restent à venir
  (voir §2 septies).
- Email : driver `mock` tant que Brevo n'est pas fourni — et surtout, les
  flux de vérification d'email / reset de mot de passe ne sont **pas
  implémentés** au Lot 1 (voir §2 bis).

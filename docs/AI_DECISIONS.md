# ENDIREK — Décisions figées (AI_DECISIONS)

> Décisions déjà prises et validées. **Un agent IA ne doit PAS les rediscuter ni les contredire** sans accord explicite du product owner.
> Ajouter ici toute nouvelle décision structurante prise en fin de checkpoint (avec la date).

_Dernière mise à jour : Lot 2 — CP2.1 (Dealplace : taxonomie + listings) (2026-07-10)._

---

## Produit & périmètre

- **D1.** Le projet est découpé en **4 lots produit** : Lot 1 (Socle + Live Local), Lot 2 (Dealplace), Lot 3 (Pages restos/entreprises), Lot 4 (News IA). La monétisation est transverse/future.
- **D2.** Le **Lot 1 est exécuté par checkpoints validés** un par un (7 checkpoints). On s'arrête à la fin de chaque checkpoint et on attend la validation du product owner.
- **D3.** **News et Dealplace sont des placeholders** dans le Lot 1 (onglets mobiles « bientôt disponible », modules API `_future/`).
- **D4.** On **ne crée pas les tables complexes des futurs lots** maintenant ; on les documente seulement (voir `docs/DATABASE.md` §tables futures).
- **D5.** Périmètre Lot 1 strict : **pas de** Dealplace, conversations, deals, pages restos/entreprises, premium, paiement, offres exceptionnelles, News IA, Google Ads réel, ni carte interactive complète avant le checkpoint 5.

## Règles métier (feed / posts / commentaires)

- **D6.** **Commentaires — option A (MVP)** : niveau 0 = commentaire principal, niveau 1 = réponse à un commentaire principal. **Pas de réponse à une réponse** dans le Lot 1. Le service/API/UI refusent (400) ou normalisent toute tentative de niveau 2+. Schéma évolutif (`CHECK depth IN (0,1)`).
- **D7.** **Posts météo / trafic / danger** : visibles **feed + carte** si une localisation est fournie ; sans localisation ils restent **feed only** (légal, pas de blocage).
- **D8.** **Publication libre** et **question / aide** : **feed only** (jamais sur la carte).
- **D9.** **Expiration carte par défaut : 2 h**, pilotée par la table `post_types` (`default_map_duration_minutes`) — **jamais hardcodée**.
- **D10.** Un **post expiré de la carte reste visible dans le feed** (expiration carte ≠ suppression).
- **D11.** Les vocabulaires pilotables (`post_types`, `reaction_types`) vivent en **tables de référence**, jamais en constantes dans la logique métier.
- **D12.** **6 réactions emoji** MVP : 👍 ❤️ 😂 😮 😢 😡. Une réaction active par (utilisateur, cible) ; changer = remplacer.
- **D13.** Enregistrements : collection par défaut **« Général »** créée à l'inscription.
- **D14.** Statuts de post : `active` / `hidden` / `deleted`. « reported » **n'est pas** un statut de post (l'état de signalement vit dans la table `reports`). Un post signalé reste actif tant qu'un admin n'agit pas.
- **D15.** **Garde géographique** : au Lot 1 (mono-île), un post géolocalisé hors de l'emprise de La Réunion est refusé (400). L'exportabilité future passera par une table de territoires.
- **D16.** Les **URLs de médias** attachées à un post doivent provenir de l'upload Endirek (`/uploads/`) — pas d'URL externe arbitraire.

## Architecture & technique

- **D17.** **`DB_DRIVER=mock` par défaut** (fallback in-memory) ; **`DB_DRIVER=postgres` fonctionnel depuis le Lot 1.5** (voir D47-D50). Les deux drivers partagent les mêmes interfaces de repositories et un comportement observable identique.
- **D18.** **Docker/PostGIS local disponible depuis le 2026-07-09** — utile pour valider le schéma SQL, mais ne doit pas rendre le mode mock obligatoire à remplacer.
- **D19.** **PostgreSQL / PostGIS** est la **cible réelle** ; le schéma SQL source de vérité est dans `apps/api/db/migrations/` et a été validé contre `postgis/postgis:16-3.4`. Procédure documentée dans `docs/DATABASE.md`.
- **D20.** **Port de l'API : 3001** (le 3000 est fréquemment occupé par d'autres projets de dev sur la machine).
- **D21.** Stack : **Flutter** (mobile) + **NestJS/TypeScript** (API) + **React/Vite** (backoffice) + **PostgreSQL/PostGIS** (cible). Carte mobile : **`flutter_map` + tuiles OSM** sans clé en dev (détail D34-D35). Temps réel : **socket.io** (D36).
- **D22.** Pattern **« adapters remplaçables »** pour toute intégration externe (base, médias, géocodage, push, email) : interface stable + implémentation sélectionnée par variable d'environnement.
- **D23.** Auth : **JWT access + refresh**, mots de passe **bcrypt**. Guard JWT **global** (`@Public()` pour les exceptions) qui **recharge l'utilisateur à chaque requête** (invalide les comptes supprimés/suspendus sans liste de révocation). Refresh **stateless** (non révocable au Lot 1).
- **D24.** **OAuth Google / Apple = placeholders 501** pour l'instant. Auth email/mot de passe suffit au Lot 1.
- **D25.** Rôles : `user` / `moderator` / `super_admin` portés par la colonne `users.role` (pas de table `admin_users` séparée).
- **D26.** Node **≥ 22** (Node 20 en fin de vie). Gestionnaire de paquets : **npm workspaces** (pas de pnpm).

## Sécurité & secrets

- **D27.** **Aucune clé API ni secret dans le repo.** Tout via variables d'environnement. `.env.example` versionné avec des valeurs factices (`change-me-in-production`) ; les vrais `.env` sont ignorés par Git.
- **D28.** Ne **jamais demander de clés API** au product owner tant que le checkpoint n'en a pas besoin : mocker à la place.

## Git & documents produit

- **D29.** **Ne pas versionner** `01_PRD/`, `02_MOCKUPS/`, `03_PROMPTS/`, `04_ACCESS/`. Ces **documents produit restent locaux, hors Git** (dans `.gitignore`). Ils ont été purgés de l'historique Git (avant tout push, avec sauvegarde préalable) à la demande du product owner.
- **D30.** **Ne pas réécrire l'historique Git** ni force-push sans demande explicite.
- **D31.** **Dépôt GitHub privé recommandé** à ce stade : `https://github.com/SARL-INNOVITA/endirek.git`. Branche principale : `main`.

## Process de passation IA

- **D32.** Tout agent IA doit commencer par lire `docs/AI_HANDOFF.md`, `docs/AI_DECISIONS.md`, `docs/AI_RUNBOOK.md`, puis vérifier `git status` avant de modifier le code.
- **D33.** À la fin de **chaque checkpoint**, mettre à jour `docs/AI_HANDOFF.md` (toujours), `docs/AI_DECISIONS.md` (si nouvelle décision) et `docs/AI_RUNBOOK.md` (si une commande, procédure ou compte de test change).

## Carte & temps réel (checkpoint 5 — 2026-07-07)

- **D34.** **Carte mobile : `flutter_map` + tuiles OSM sans clé** (dépendances mobiles `flutter_map`, `latlong2`). Tuiles publiques OpenStreetMap en **dev uniquement** ; provider dédié en prod via `MAP_TILE_URL`/`MAP_API_KEY`, **sans changement de code**. Pas de MapLibre natif au Lot 1.
- **D35.** **Clustering des marqueurs = client-side, grille maison** (regroupement des marqueurs proches, barycentre affiché). Suffisant au volume du Lot 1 ; l'architecture reste prête pour un **clustering serveur** à grande échelle (à ne pas implémenter maintenant).
- **D36.** **Temps réel = socket.io** (dépendance mobile `socket_io_client`), namespace par défaut, **auth au handshake** (access token JWT vérifié, compte rechargé/revérifié). Deux events sortants seulement : `notification.created` (room privée `user:<id>`) et `map.updated` (room `map`). **Fallback polling REST** (`GET /notifications/unread-count`, ~45 s) quand le socket est indisponible. Le temps réel est un **confort, pas une source de vérité**. **Pas de messagerie au Lot 1.**
- **D37.** **`REUNION_BBOX` = source unique partagée** (`common/geo/reunion.ts`), importée par `posts` (création) et `cameras` (création/mise à jour). Aucune constante d'emprise dupliquée.
- **D38.** **Caméra masquée = suppression douce** : `DELETE /admin/cameras/:id` passe la caméra en statut `hidden` (jamais de suppression dure), le `cameraNumber` est préservé. Une caméra non `active` n'est **jamais** exposée côté public (carte ni `GET /cameras/:id` → 404 sans divulguer son existence). `cameraNumber` auto-attribué par le repository ; `cityName` déduite par géocodage mock si absente.
- **D39.** **Notifications : point d'entrée unique** (`NotificationsService.create`, persistance **puis** émission socket) pour tous les producteurs. Types branchés au Lot 1 : `comment`, `reply`, **`reaction`**, **`report_handled`** (traitement de signalement). **Jamais de notification à soi-même** ; lecture strictement limitée aux notifications du user courant (404 si elle appartient à un autre).
- **D40.** **Affichage caméra = image seulement** : seul `streamType='image'` est rendu dans l'app (image live + badge LIVE) ; `video`/`iframe` affichent un repli explicite (lecteur vidéo/webview reporté). **Pas de présence temps réel** (« N personnes ici » du mockup non implémenté).

## Consolidation backoffice (checkpoint 6 — 2026-07-07)

- **D41.** **Slugs `post_types` immuables au Lot 1** : le backoffice peut modifier libellé, icône, couleur, activation, ordre, `showsOnMap` et durée carte, mais ne crée/supprime/renomme pas de slug. Les 5 slugs Lot 1 (`free`, `weather`, `traffic`, `danger`, `question`) restent les clés métier.
- **D42.** **Changements de durée carte non rétroactifs** : modifier `default_map_duration_minutes` s'applique aux nouvelles publications uniquement ; les `map_expires_at` déjà posés sur les posts existants ne sont pas recalculés.
- **D43.** **Commentaires admin : `deleted` est définitif**. Le backoffice peut masquer (`hidden`) et réactiver un commentaire masqué, mais ne restaure pas un commentaire déjà `deleted`. Une racine hidden/deleted avec des réponses actives reste affichée comme emplacement vide.
- **D44.** **Notifications système checkpoint 6 = in-app dev/mock seulement** : créées depuis le backoffice via `NotificationsService.create`, elles sont persistées et émises en WebSocket, mais ne déclenchent aucun push FCM/APNs.

## Stabilisation Lot 1 (checkpoint 7 — 2026-07-07)

- **D45.** **Localisation mobile Material = `flutter_localizations` SDK** : l'app force la locale française et utilise les delegates Flutter officiels pour les libellés système Material. Aucun package de traduction externe ni catalogue i18n complet n'est introduit au Lot 1.

## Infrastructure base de données (2026-07-09)

- **D46.** ~~**PostGIS validé ≠ driver API postgres livré**~~ **(SUPERSÉDÉE par D47-D50 au Lot 1.5)** : à l'origine, l'API métier restait en `DB_DRIVER=mock` et `DB_DRIVER=postgres` échouait volontairement faute de repositories SQL. Depuis le Lot 1.5, le driver postgres est implémenté et fonctionnel.

## Lot 1.5 — Driver PostgreSQL fonctionnel (2026-07-10)

> Chantier **technique** : rendre `DB_DRIVER=postgres` fonctionnel pour les
> modules existants du Lot 1, à comportement observable **identique** au mock.
> Aucune nouvelle fonctionnalité produit, aucune modification des interfaces ni
> des modules métier.

- **D47.** **Driver PostgreSQL implémenté en `pg` (node-postgres) + SQL BRUT paramétré** (`$1, $2…`), **sans ORM**. Les 9 repositories SQL vivent dans `apps/api/src/database/postgres/repositories/`, au-dessus d'un **pool partagé** (`POSTGRES_POOL`) et de `PostgresDatabaseService` (ping + seed au boot, fermeture du pool à l'arrêt). Le **mock reste la spécification de référence et le fallback** ; les deux drivers exposent les **mêmes tokens, interfaces et entités**.
- **D48.** **Sélection du driver au CHARGEMENT du module** via `process.env.DB_DRIVER` (lu directement dans `database.module.ts`, pas via `ConfigService`) : c'est une décision de **bootstrap d'infra** — la composition du graphe d'injection est figée avant toute instanciation. Conséquence voulue : en mode `postgres`, `MockDatabaseService` **n'est pas déclaré comme provider** (jamais instancié) ; réciproquement le pool postgres n'existe pas en mode `mock`. Driver inconnu → erreur explicite au chargement.
- **D49.** **Compteurs dénormalisés CALCULÉS À LA LECTURE en mode postgres** (sous-requêtes/JOIN : `reactionCount`, `commentCount`, `saveCount`, `followersCount`, `followingCount`, `postsCount`…), avec la **sémantique exacte du mock** (ex. `followersCount` = follows de statut `active`, `commentCount` = commentaires `active`). Les colonnes compteur de la base **ne sont pas maintenues à l'écriture** : parité de comportement et robustesse accrue. **Perf via triggers/colonnes maintenues à grande échelle = TODO** (non requis au Lot 1).
- **D50.** **Seeder postgres idempotent et atomique** (`PostgresSeeder`) réutilisant la **source unique** `buildSeed()` (`src/database/seed/`) : le seed est inséré **si et seulement si la table `users` est vide** (déclencheur au boot), dans **une transaction** avec `ON CONFLICT DO NOTHING` sur chaque clé. Les `id`/`created_at`/`updated_at` du seed sont insérés explicitement (UUID `seedUuid` stables, identiques au mock) ; `camera_number` (GENERATED ALWAYS AS IDENTITY) est forcé via `OVERRIDING SYSTEM VALUE` puis la séquence est repositionnée (`setval`) — miroir de `syncCameraSequence()` du mock. `npm run db:reset` vide les tables de données (référence conservée) pour forcer un re-seed au prochain boot.

## Lot 2 — CP2.1 : Dealplace (taxonomie + listings) (2026-07-10)

> Première fonctionnalité **produit** du Lot 2. Périmètre STRICT : taxonomie
> biens/services + annonces (listings). HORS périmètre : conversations (CP2.3),
> deals contractuels (CP2.4), avis/profil Dealplace (CP2.2), pages restos
> (Lot 3), News (Lot 4), paiement (hors app).

- **D51.** **Le Lot 2 démarre par le Dealplace**, exécuté par checkpoints validés un par un (comme le Lot 1) : **CP2.1** = taxonomie + listings ; **CP2.2** = profil Dealplace + avis ; **CP2.3** = conversations 1-to-1 temps réel ; **CP2.4** = deals contractuels (machine à états, éléments validables, litiges) ; **CP2.5** = modération avancée / consolidation. On s'arrête à la fin de chaque checkpoint et on attend la validation du product owner.
- **D52.** **Parité mock+postgres maintenue pour le Lot 2** (décision product owner) : chaque nouveau repository Dealplace est implémenté en **MOCK ET en POSTGRES**, au **comportement observable identique** — le mock reste la spécification de référence, et les compteurs/dérivés sont calculés **à la lecture** côté postgres (comme au Lot 1.5). Ni les interfaces (`repositories/interfaces.ts`) ni les modules métier ne dépendent du driver. Le CP2.1 ajoute **2 repositories** (`listings`, `listing-taxonomy`), portant le total à **11**.
- **D53.** **Taxonomie Dealplace en TABLES DE RÉFÉRENCE pilotables par le backoffice** (même modèle que `post_types`) : `listing_categories` (famille `good`/`service` + `moderation_level`), `listing_subcategories` (rattachées à une catégorie, avec une sous-catégorie de repli « autres-<cat> » par catégorie) et `listing_tags` (tags transversaux). Aucun vocabulaire hardcodé dans le code métier. Le backoffice peut créer/éditer/activer ; le **slug est immuable**, tout comme `family` (catégorie) et `categorySlug` (sous-catégorie). `GET /dealplace/taxonomy` ne sert que les entrées **actives** au formulaire mobile.
- **D54.** **Valeur d'une annonce = obligatoire, fixe OU fourchette.** `value_kind IN ('fixed','range')` : `fixed` → `value_min` renseigné (pas de `value_max`) ; `range` → `value_min ≤ value_max`. La cohérence est garantie **au service** (400 sinon) ET par des `CHECK` SQL (défense en profondeur). L'adresse exacte n'est jamais stockée : `city` = commune du référentiel, `location` = **centre de la commune** (optionnel).
- **D55.** **Photo obligatoire pour un BIEN** (`listingType='good'` → ≥ 1 média), **facultative pour un service**. Garantie au service (le nombre de médias n'est pas connu à l'INSERT de la ligne). Comme pour les posts, les URLs de médias doivent provenir de l'upload Endirek (`/uploads/`) — pas d'URL externe arbitraire (400 sinon).
- **D56.** **Niveau de modération par catégorie** (`moderation_level`) : `standard` (normale) ; `sensitive` (autorisée mais **marquée** pour la modération — les annonces en héritent) ; **`forbidden` → création d'annonce REFUSÉE par le service (400)**. La bascule du niveau est éditable depuis le backoffice.
- **D57.** **Paiement et deals HORS périmètre CP2.1.** Le paiement est **hors application** (jamais dans le périmètre applicatif) ; les deals contractuels sont le **CP2.4**. Le bouton mobile **« Proposer un deal »** du détail d'annonce est un **PLACEHOLDER** (snackbar « Disponible au prochain lot »). **Pas de signalement d'annonce côté utilisateur** au CP2.1 (la modération passe par le backoffice : masquer/republier une annonce). Visibilité d'une annonce miroir des posts : `active` (tous) / `hidden` (404 sauf propriétaire + moderator/super_admin) / `deleted` (soft-delete, 404 pour tous). `PATCH /admin/dealplace/listings/:id/status` ne pose que `active`/`hidden` — une annonce `deleted` n'est **jamais** restaurée.
- **D58.** **Port hôte PostgreSQL = 55432 sur cette machine de dev.** Un **PostgreSQL natif** occupe déjà `5432` : le conteneur Docker `endirek-postgres` est **remappé sur le port hôte `55432`** (`DATABASE_URL=postgresql://endirek:endirek@127.0.0.1:55432/endirek`, déjà dans `apps/api/.env` local). C'est une spécificité de la machine (voir [AI_RUNBOOK.md](AI_RUNBOOK.md) §8 bis, remède « remapper le conteneur ») ; `docker exec endirek-postgres psql -U endirek -d endirek` reste indépendant de ce remappage.

## Lot 2 — Arbitrages post-revue CP2.1 & périmètre CP2.2 (2026-07-11)

> Décisions prises par le product owner à l'issue de la revue qualité complète
> du CP2.1 (2026-07-11, consignée dans [AI_HANDOFF.md](AI_HANDOFF.md) §3).

- **D59.** **Les avis détaillés sont REPORTÉS au CP2.4.** Le mockup 05 (Profil
  Dealplace) lie les avis aux deals (« 6 deals réalisés », « Deals conclus »,
  avis mentionnant un deal) or les deals n'arrivent qu'au CP2.4 : les avis
  (note globale /5 + critères **Honnêteté et fiabilité / Conformité à la
  description / Amabilité et courtoisie** + commentaire) seront construits
  AVEC les deals. Le **CP2.2 = volet « Profil Dealplace » SANS avis** :
  en-tête, annonces du profil par famille (Services / Biens), champ « Ce que
  je recherche » (extension du profil `users`, pas de duplication). Les blocs
  avis / « X deals réalisés » / « Deals conclus » du mockup restent des
  **PLACEHOLDERS VISIBLES** au CP2.2 (« disponible au prochain lot »), comme
  le bouton « Proposer un deal » du CP2.1.
- **D60.** **Une catégorie ou sous-catégorie INACTIVE n'accepte plus de
  nouvelle annonce** : création et changement de catégorie refusés (400
  « Catégorie/Sous-catégorie inconnue ou inactive ») — aligné sur les types de
  posts du Lot 1 et sur les tags. Les annonces EXISTANTES d'une entrée
  désactivée restent affichées (libellé résolu par l'assembleur) et leurs
  autres champs restent éditables.
- **D61.** **Les cartes de `GET /users/me/listings` portent le champ `status`**
  (comme la liste backoffice) : le propriétaire distingue ses annonces
  masquées par la modération. La forme LISTING_CARD de base (annuaire, profil
  public) reste SANS statut.

## Lot 2 — CP2.2 : Profil Dealplace (2026-07-11)

- **D62.** **Le volet Profil Dealplace (CP2.2) = extension du profil `users`,
  pas de table dédiée** : colonne `users.dealplace_seeking` (« Ce que je
  recherche », texte PUBLIC nullable, 500 caractères max au service — aligné
  sur `bio`), migration `0005_dealplace_profile.sql` (rejouable), éditée via
  le `PATCH /users/me/profile` existant (chaîne vide = effacement → null),
  exposée dans les DEUX formes de profil (complet + public). Les listes
  d'annonces de profil (`/users/me/listings`, `/users/:id/listings`) gagnent
  un filtre **`?family=good|service`** (sections Services / Biens). Côté
  mobile : **onglets « Mes infos » / « Profil Dealplace »** sur mon profil
  (mockups 04/05) et **écran public `/dealplace/profil/:userId`** (en-tête
  avatar/nom/commune/bio, ouvert depuis le bloc vendeur du détail d'annonce) ;
  vue partagée entre les deux surfaces. Blocs avis (note globale + critères
  Honnêteté et fiabilité / Conformité à la description / Amabilité et
  courtoisie), « X deals réalisés » et « Deals conclus » = **placeholders
  visibles** (D59) avec pastille « Bientôt » ; bottom sheet statique
  « Comment ça marche ? ». Sections d'annonces limitées à 50 par famille
  (pagination à prévoir avec la croissance réelle des profils). Le seed
  pré-remplit « Ce que je recherche » pour 3 propriétaires d'annonces
  (n°4, 11, 13) — le log de boot du seed est INCHANGÉ.

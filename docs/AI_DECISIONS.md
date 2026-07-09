# ENDIREK — Décisions figées (AI_DECISIONS)

> Décisions déjà prises et validées. **Un agent IA ne doit PAS les rediscuter ni les contredire** sans accord explicite du product owner.
> Ajouter ici toute nouvelle décision structurante prise en fin de checkpoint (avec la date).

_Dernière mise à jour : validation Docker/PostGIS locale (2026-07-09)._

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

- **D17.** **`DB_DRIVER=mock` par défaut.** Adapter in-memory derrière les mêmes interfaces de repositories que le futur driver PostgreSQL.
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

- **D46.** **PostGIS validé ≠ driver API postgres livré** : Docker Compose démarre PostgreSQL/PostGIS et les migrations Lot 1 passent, mais l'API métier reste en `DB_DRIVER=mock` tant que les repositories SQL ne sont pas implémentés. `DB_DRIVER=postgres` échoue volontairement pour éviter une fausse bascule.

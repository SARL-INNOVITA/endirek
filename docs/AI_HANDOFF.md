# ENDIREK — Passation IA (AI_HANDOFF)

> **Point d'entrée unique pour tout agent IA (Claude Code, Opus, Codex, GLM, autre) qui reprend ce projet.**
> Lis ce fichier EN PREMIER, puis [AI_DECISIONS.md](AI_DECISIONS.md) et [AI_RUNBOOK.md](AI_RUNBOOK.md), puis fais `git status` avant toute modification.
> Ce fichier est la source de vérité de l'état du projet. Il doit être **mis à jour à la fin de chaque checkpoint**.

_Dernière mise à jour : fin du checkpoint 6 (2026-07-07)._

---

## 1. Projet

**ENDIREK** (« en direct » en créole réunionnais) — réseau social **mobile local temps réel** centré sur **La Réunion**.

**Vision courte** : permettre à l'utilisateur de comprendre rapidement *ce qui se passe autour de lui, maintenant* — éviter un bouchon, repérer une alerte météo, découvrir une offre locale, poser une question à la communauté. L'app combine un **fil d'actualité social**, une **carte interactive live** (interface signature), une marketplace **Dealplace**, et une section **News** automatisée.

Territoire MVP : La Réunion uniquement, mais architecture pensée pour être exportable.

---

## 2. Les 4 grands lots produit

| Lot | Contenu | Statut |
|---|---|---|
| **Lot 1 — Socle + Live Local** | Auth, profils, follows, feed social (5 types de posts), interactions, carte météo/trafic, caméras, notifications, backoffice minimal | **EN COURS** |
| **Lot 2 — Dealplace** | Marketplace biens/services, annonces, conversations 1-to-1 temps réel, deals contractuels (états, éléments validables, litiges) | Non commencé — anticipé |
| **Lot 3 — Pages restaurants / entreprises** | Pages pro, menus programmés, cartes, offres, événements | Non commencé — anticipé |
| **Lot 4 — News automatisées IA** | Harnais IA supervisé, sources, génération d'articles, page News | Non commencé — anticipé |

> Monétisation (premium, offres exceptionnelles, Google Ads) = transverse/future, hors des 4 lots ci-dessus.
> « Anticipé » = points d'ancrage présents dans le code (dossiers `apps/api/src/modules/_future/`, `page_id` nullable, gateway WS prévue, adapters), **rien n'est développé**. Voir [TODO_LOT_2.md](TODO_LOT_2.md).

---

## 3. Lot actuel et checkpoints

**Lot actuel : Lot 1.** Il est exécuté en **8 checkpoints** (= « étapes »), validés un par un par le product owner.

| # | Checkpoint | Statut |
|---|---|---|
| 1 | Socle du monorepo (API, admin, mobile, infra, docs) | ✅ validé |
| 2 | Schéma DB PostGIS + adapter mock + seed La Réunion | ✅ validé |
| 3 | Auth, utilisateurs, profils, follows, RGPD | ✅ validé |
| 4 | Posts, feed, interactions sociales, médias | ✅ validé |
| 5 | **Carte, caméras, notifications, temps réel (WebSocket)** | ✅ validé |
| 6 | **Backoffice minimal (types de posts, modération, UX, robustesse)** | ✅ **implémenté** (validation product owner à venir) |
| 7 | Application mobile Flutter (finition UI/mockups) | prochain après validation |
| 8 | Documentation, tests, données de démo | à faire |

**Dernier commit connu avant checkpoint 6 : `955a041`** — `docs: renseigne le hash du checkpoint 5 dans AI_HANDOFF`.
Branche : `main`. Historique récent : `39c9c94` (auth) → `b308791` (social) → `1458221` (carte/caméras/notifications/temps réel) → `955a041` (passation checkpoint 5). Le commit final du checkpoint 6 doit être renseigné dans le rapport de fin de tâche.

---

## 4. État actuel par composant

### API — `apps/api` (NestJS 11, TypeScript, port **3001**)
Fonctionnelle. Modules livrés : `health`, `database` (mock), `auth`, `users`, `admin` (utilisateurs + posts + signalements + **caméras + types de posts + commentaires signalés + notifications système dev/mock**), `media`, `posts`, `feed`, `comments`, `reactions`, `saved-posts`, `moderation`, `map`, **`cameras`**, **`notifications`**, **`realtime`**.
- Routes métier préfixées `/api/v1`, `GET /health` hors préfixe, Swagger sur `/docs`.
- Guard JWT **global** (@Public pour exceptions), access + refresh tokens, bcrypt.
- Upload médias local (`/uploads/` statique), validation par décodage réel (sharp), thumbnails.
- Feed scoré (récence/proximité/type/popularité/abonnements), pagination offset.
- **Carte** : `GET /map/overview` (posts + caméras en un appel), `/map/cameras`, `/map/posts`, `/map/communes` ; seuls les types `showsOnMap` non expirés sortent sur la carte, caméras `active` uniquement.
- **Caméras** : `GET /cameras/:id` public (caméra `active` seulement) ; 6 routes backoffice `/admin/cameras` (numéro auto, ville déduite par géocodage mock, statuts ; `DELETE` = masquage doux `hidden`).
- **Notifications** : `GET /notifications` (+ `total`/`unreadCount`), `/unread-count`, `PATCH /read-all`, `/:id/read` (uniquement les siennes) ; types `comment`/`reply`/`reaction`/`report_handled` créés via un point d'entrée unique (persistance + émission socket).
- **Checkpoint 6 admin** : `GET|PATCH /admin/post-types` (types actifs/inactifs, `showsOnMap`, durée carte, activation, ordre), `PATCH /admin/comments/:id/status`, `POST /admin/notifications/system`, filtres admin `role`, `mapVisible`, `targetType` et alias `pending` → `open`.
- **Temps réel** : gateway **socket.io** (namespace par défaut, auth handshake JWT), events `notification.created` (room `user:<id>`) et `map.updated` (room `map`), CORS aligné sur l'API via `RealtimeIoAdapter`.

### Mobile — `apps/mobile` (Flutter 3.44, Riverpod, go_router, dio)
Fonctionnel jusqu'au temps réel. Shell 4 onglets (Accueil, Carte, News, Dealplace) ; **News / Dealplace = placeholders propres**, mais la **Carte est réelle** (plus de placeholder). Écrans réels : login/register, profil + édition, feed (infinite scroll, pull-to-refresh), composer (5 types actifs depuis `GET /posts/types`, images, choix de commune), détail post (commentaires 2 niveaux, réactions, signalement, édition), **carte Météo & trafic** (`flutter_map` + tuiles OSM, clustering client-side, cartes de preview, filtres), **détail caméra** (image live pour `streamType='image'`, repli pour video/iframe), **écran notifications** + **cloche active avec badge de non-lues**. Les notifications `system` affichent `payload.title` ou `payload.message`. Temps réel via **socket.io** (`socket_io_client`) : notifications poussées en direct + `map.updated`, avec **fallback polling ~45 s**. Header : icône messagerie **inactive** (Lot 2), cloche **active**.

### Admin — `apps/admin` (React 19 + Vite 7, CSS pur, port 5173)
Backoffice Lot 1 consolidé : connexion réservée aux rôles admin, onglets **Utilisateurs** (recherche + statut + rôle, suspendre/réactiver), **Publications** (type/statut/recherche + filtre carte `mapVisible`, détail, masquer/réactiver), **Signalements** (statut + cible, traitement, action directe sur commentaire signalé), **Caméras** (`CamerasView` + `CameraForm` : liste tous statuts, création/édition, changement de statut, masquage doux) et **Paramètres** (types de posts pilotables + notification système dev/mock).

### DB mock — `apps/api/src/database`
`DB_DRIVER=mock` (in-memory) par défaut, **derrière les mêmes interfaces de repositories que le futur driver PostgreSQL**. Le schéma SQL source de vérité vit dans `apps/api/db/migrations/` (jamais exécuté — Docker absent). Seed La Réunion rechargé à chaque boot avec timestamps relatifs.
**Log de boot attendu** : `Mock DB prête : 15 utilisateurs, 32 follows, 42 posts (dont 13 visibles carte), 60 commentaires, 155 réactions, 12 caméras, 4 signalements, 12 notifications`.

---

## 5. Services mockés (aucune clé externe requise)

| Service | Driver / état | Détail |
|---|---|---|
| Base de données | `DB_DRIVER=mock` | PostgreSQL/PostGIS = cible réelle, non requise maintenant |
| Stockage médias | `MEDIA_STORAGE_DRIVER=local` | disque `apps/api/uploads/` ; S3/Hetzner = `throw` explicite |
| Géocodage | `GEOCODING_PROVIDER=mock` | table des 12 communes du seed + plus proche voisin |
| Push (FCM/APNs) | `PUSH_DRIVER=mock` | notifications persistées en base, pas d'envoi réel |
| Email (Brevo) | `EMAIL_DRIVER=mock` | contenu logué en console |
| OAuth Google/Apple | endpoints **501** | placeholders propres, auth email/mdp suffit |

Détail complet : [MOCKED_SERVICES.md](MOCKED_SERVICES.md). Accès à fournir plus tard : [ACCESS_NEEDED.md](ACCESS_NEEDED.md).

---

## 6. Limites connues (état honnête)

- **Docker absent** → pas de vrai PostgreSQL/PostGIS ; le SQL des migrations n'a jamais été exécuté.
- Données mock **non persistées** entre redémarrages (seed rechargé, timestamps relatifs).
- Refresh token **non révocable** (invalidation via re-vérification du statut à chaque requête).
- Pas de vérification d'email ni de reset de mot de passe ; pas de rate-limiting.
- **Partage** de post = bouton « prochainement », `share_count` jamais incrémenté.
- Changements de `post_types` non rétroactifs : une durée carte modifiée ne recalcule pas les posts existants.
- Signalement de commentaires côté utilisateur non exposé au Lot 1 ; la file admin et l'action de modération existent.
- Pas de vidéos (images seulement) ; uploads orphelins non purgés.
- Notifications in-app OK (`comment`/`reply`/`reaction`/`report_handled`) ; **push mobile toujours mock** (WebSocket + base, pas de FCM/APNs).
- Notifications système backoffice = in-app + WebSocket uniquement, dev/mock.
- **Tuiles OSM = dev uniquement** (provider dédié en prod via `MAP_TILE_URL`/`MAP_API_KEY`).
- **Caméras** : seul `streamType='image'` est affiché dans l'app (video/iframe → vignette + repli).
- **Pas de présence temps réel** (« N personnes ici » du mockup non implémenté) ; temps réel = notifications + `map.updated` seulement (pas de messagerie), **fallback polling ~45 s**.
- **Clustering client-side** (grille maison) ; clustering serveur à prévoir à grande échelle.
- Carte mobile **réelle** mais centrée sur l'île ; **GPS réel non branché** (pas de « autour de moi », position par choix de commune).
- Visual Studio C++ absent → pas de build Flutter Windows desktop (non nécessaire, cible Android/iOS).

Liste complète et à jour : [KNOWN_LIMITS.md](KNOWN_LIMITS.md).

---

## 7. Prochaine étape recommandée

**Checkpoint 6 implémenté.** Backoffice Lot 1 consolidé, types de posts
pilotables, commentaires signalés modérables, notification système dev/mock,
UX mobile notifications ajustée, docs mises à jour.

**Prochaine étape recommandée : attendre la validation product owner du
checkpoint 6.** Après validation seulement : lancer le **checkpoint 7 —
finition mobile Flutter / cohérence mockups**, sans démarrer les lots futurs
(pas de Dealplace, messagerie, pages, News IA, premium).

---

## 8. Consignes strictes pour le prochain modèle

1. **Lire d'abord** : ce fichier, puis [AI_DECISIONS.md](AI_DECISIONS.md) et [AI_RUNBOOK.md](AI_RUNBOOK.md). Puis `git status`.
2. **Rester dans le périmètre du Lot 1.** Ne développe PAS Dealplace, conversations, deals, pages restos/entreprises, premium, paiement, offres exceptionnelles, News IA, Google Ads réel.
3. **`DB_DRIVER=mock` par défaut.** N'exige pas Docker. Ne bloque jamais sur un service externe absent : mocke proprement.
4. **Aucun secret dans le repo.** Jamais de clé API, token, mot de passe réel. Tout via variables d'environnement ; mettre à jour `.env.example` si une variable apparaît.
5. **Ne pas versionner** `01_PRD/`, `02_MOCKUPS/`, `03_PROMPTS/`, `04_ACCESS/` (contexte produit local, dans `.gitignore`).
6. **Ne pas créer les tables complexes des futurs lots** ; se contenter de les documenter.
7. **Respecter les décisions figées** (voir [AI_DECISIONS.md](AI_DECISIONS.md)), notamment : commentaires option A (commentaire + réponse, pas de réponse à une réponse), durée carte 2 h pilotée par `post_types`, feed-only vs feed+carte selon le type.
8. **Vérifier avant de commiter** : `npm run api:build`, `npm run admin:build`, `flutter analyze`, `flutter test` (voir [AI_RUNBOOK.md](AI_RUNBOOK.md)). Le log de boot du seed doit rester inchangé.
9. **Ne pas réécrire l'historique Git**, ne pas force-push, sauf demande explicite du product owner.
10. **Avancer checkpoint par checkpoint**, s'arrêter et attendre la validation du product owner à la fin de chacun.
11. **À la fin de chaque checkpoint, mettre à jour** ce fichier (toujours), [AI_DECISIONS.md](AI_DECISIONS.md) (si nouvelle décision) et [AI_RUNBOOK.md](AI_RUNBOOK.md) (si commande/procédure/compte change).

---

## 9. Fichiers à lire avant de travailler (ordre conseillé)

1. **`docs/AI_HANDOFF.md`** (ce fichier) — état et périmètre.
2. **`docs/AI_DECISIONS.md`** — décisions figées, à ne pas rediscuter.
3. **`docs/AI_RUNBOOK.md`** — comment lancer, tester, vérifier.
4. `docs/ARCHITECTURE.md` — arborescence, modules, stack, décisions techniques.
5. `docs/DATABASE.md` — schéma des tables du Lot 1 + procédure de bascule mock→PostgreSQL.
6. `docs/KNOWN_LIMITS.md` — limites détaillées et à jour.
7. `apps/api/README.md`, `apps/mobile/README.md`, `apps/admin/README.md` — spécifiques à chaque app.
8. Les `README.md` dans `apps/api/src/modules/*/` — rôle et règles métier de chaque module.

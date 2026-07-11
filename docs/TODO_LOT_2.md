# ENDIREK — TODO préparés pour le Lot 2

Le Lot 2 porte le **MVP Dealplace** (troc/échange de biens et services entre
Réunionnais, selon le PRD global — dossier `01_PRD`). Il est exécuté par
checkpoints : **CP2.1** (taxonomie + listings) est **livré** ; ce fichier suit
l'avancement et rappelle les points d'ancrage déjà posés dans le socle.

**État (2026-07-11)** : ✅ **CP2.1** (taxonomie + listings), ✅ **CP2.2**
(profil sans avis — D59), ✅ **CP2.3** (conversations 1-to-1 — D63) validés et
poussés ; ✅ **CP2.4** (deals contractuels + avis — D64) implémenté — §1.1 à
§1.5 faits. Reste : modération avancée / consolidation (**CP2.5** — dont
arbitrage des litiges, modération messages/deals, signalement d'annonce).
**Paiement = hors app** (jamais dans le périmètre applicatif).

---

## 1. Dealplace MVP — chantiers du Lot 2

### 1.1 Taxonomie biens / services — ✅ CP2.1
- [x] Modèle de catégories/sous-catégories couvrant **biens** et **services**
      (`listing_categories` avec `family` good/service + `moderation_level` ;
      `listing_subcategories` avec repli « autres-<cat> » ; `listing_tags`).
      Tables de référence pilotables (migrations 0003/0004, parité mock+postgres).
- [x] Administration de la taxonomie depuis le backoffice
      (`GET|POST|PATCH /admin/dealplace/categories|subcategories|tags`, slug
      immuable ; front `TaxonomyView`). `GET /dealplace/taxonomy` sert les
      entrées actives au formulaire mobile.

### 1.2 Listings — ✅ CP2.1
- [x] CRUD des annonces (bien ou service) avec **valeur estimée obligatoire**
      (fixe ou fourchette) : `POST /dealplace/listings`,
      `GET /dealplace/listings/:id` (+ `/slug/:slug`),
      `PATCH|DELETE /dealplace/listings/:id` (propriétaire, soft-delete).
- [x] **Photo obligatoire pour un bien** (règle serveur + UX mobile) ;
      facultative pour un service. Médias issus de `/media/upload` uniquement.
- [x] Recherche/filtres (`family/category/subcategory/city/valueMin/valueMax/tags/search`)
      + pagination, annuaire public `GET /dealplace/listings` ; listes de profil
      `GET /users/me/listings` et `GET /users/:id/listings`.
- [x] Backoffice annonces : `GET /admin/dealplace/listings` (tous statuts +
      filtres), détail, `PATCH …/:id/status` (masquer/republier ; `deleted` non
      restaurable). Front `ListingsView` + `ListingDetailAdmin`.
- [x] Onglet **Dealplace mobile réel** (annuaire, création, détail). Le bouton
      « Proposer un deal » du détail reste un **placeholder** (deals = CP2.4).
- [ ] **Reste ouvert (post-CP2.1)** : recherche géographique fine (réutiliser le
      module `map` pour la proximité — le CP2.1 filtre par commune, pas par
      rayon) ; **signalement d'annonce côté utilisateur** (non exposé au CP2.1,
      la modération passe par le backoffice).

### 1.3 Profil Dealplace — ✅ CP2.2 (périmètre arbitré le 2026-07-11, D59/D62)
- [x] Volet « Profil Dealplace » du profil utilisateur (mockup 05) : onglets
      « Mes infos » / « Profil Dealplace » sur MON profil + écran public
      `/dealplace/profil/:userId` (ouvert depuis le bloc vendeur d'une
      annonce) ; annonces du profil par famille (**Services** / **Biens** —
      filtre `?family=` sur `GET /users/me|:id/listings`) ; champ
      **« Ce que je recherche »** (`users.dealplace_seeking`, migration 0005 —
      extension du profil `users` du Lot 1, pas de duplication), éditable via
      `PATCH /users/me/profile`.
- [x] **SANS avis au CP2.2** : les avis détaillés sont **reportés au CP2.4**
      (liés aux deals — décision D59). Les blocs avis / « X deals réalisés » /
      « Deals conclus » du mockup = **placeholders visibles** (pastille
      « Bientôt »), comme « Proposer un deal ».

### 1.4 Conversations 1-to-1 temps réel — ✅ CP2.3 (D63)
- [x] Messagerie privée **liée à une annonce** (une conversation par
      (annonce, initiateur), « Contacter » du détail, get-or-create + premier
      message obligatoire), **temps réel via WebSocket**.
- [x] **Gateway WebSocket de l'étape 5 réutilisée** (event `message.created`
      vers la room `user:<id>` du destinataire — pas de second canal).
- [x] Persistance (tables `conversations`/`messages`, migration 0006, parité
      mock+postgres) ; **badge messagerie dédié** au lieu de notifications
      in-app par message (anti-flood — D63), polling de repli ~45 s.
- [x] Icône messagerie du header mobile ACTIVE avec badge ; écrans
      `/messages` (liste) et `/messages/:id` (fil, bulles, temps réel).
- [ ] **Reste ouvert (post-CP2.3)** : pièces jointes (adapter média prêt),
      modération backoffice des messages (CP2.5), pagination profonde des
      fils très actifs.

### 1.5 Page de deal contractuelle — ✅ CP2.4 (D64)
- [x] Machine à états explicite : `proposed → active → completed`
      (conclusion AUTOMATIQUE quand les deux parties ont tout validé), plus
      les sorties **declined**, **cancelled** (retrait de proposition OU
      annulation amiable EN DEUX TEMPS) et **disputed** (litige unilatéral —
      TERMINAL au CP2.4, arbitrage à venir avec la modération avancée / IA,
      voir [MOCKED_SERVICES.md](MOCKED_SERVICES.md) §2).
- [x] **Éléments et sous-éléments validables** : le fournisseur « honore »,
      la contrepartie « valide » — le deal n'avance que si les deux parties
      valident ; badges d'éléments et stepper 5 étapes DÉRIVÉS.
- [x] **Ajustements** en cours de deal (add/modify/remove d'éléments,
      payload appliqué à l'acceptation) avec historique tracé + notes de
      suivi (timeline mockup 07).
- [x] **Avis détaillés** (D59) : 3 critères 1-5 + commentaire sur deal
      CONCLU, un par partie ; profil Dealplace ACTIVÉ (note globale, barres
      des critères, « X deals réalisés », « Deals conclus », derniers avis).
- [ ] **Reste ouvert (post-CP2.4)** : arbitrage des litiges (backoffice /
      IA), modération backoffice des deals, échéance avec rappels,
      modification des sous-éléments par ajustement.

---

## 2. Points d'ancrage déjà posés dans le socle (Lot 1)

| Ancrage | Où | Sert à |
|---|---|---|
| Modules placeholders `_future` | `apps/api/src/modules/_future/` (deals, conversations, pages, news, billing ; **`_future/dealplace` remplacé au CP2.1 par le module réel `modules/dealplace`**) | Accueillir chaque chantier restant sans toucher à l'arborescence |
| `page_id` nullable sur les publications | schéma DB (étape 2) | Pages restaurants/entreprises émettrices de contenu |
| Gateway WebSocket | module `realtime` (étape 5) | Conversations 1-to-1 (CP2.3) et tout temps réel futur |
| Adapters remplaçables (media/geocoding/push/email) | `apps/api/src/adapters/` (posés aux étapes 2-5 du Lot 1) | Photos de listings (**utilisé au CP2.1**), géoloc des annonces, notifications de deals |
| `url_slug` sur les posts publics | modules `posts` (étape 4) | Mécanique **répliquée au CP2.1** pour les `listings.url_slug` partageables |
| Onglet Dealplace | bottom nav Flutter (**réel depuis le CP2.1** ; placeholder au Lot 1) | Annuaire/création/détail d'annonces branchés |
| Taxonomie/types administrables | backoffice (étape 6) | Modèle **étendu au CP2.1** pour la taxonomie biens/services (`listing_categories/subcategories/tags`) |

---

## 3. Autres lots (une ligne chacun)

- **Pages restaurants / entreprises** : pages possédées par des utilisateurs
  (ancrage `page_id` + `_future/pages`), menus/infos, publications de page.
- **News IA** : onglet News alimenté par scraping + agent IA de rédaction
  (ancrage `_future/news`, onglet placeholder mobile).
- **Monétisation** : premium/Stripe, Google Ads réel, offres exceptionnelles
  payantes, comptes pro (ancrage `_future/billing`, variables dans
  [ACCESS_NEEDED.md](ACCESS_NEEDED.md) §7).

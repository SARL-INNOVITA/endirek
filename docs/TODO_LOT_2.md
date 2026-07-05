# ENDIREK — TODO préparés pour le Lot 2

Le Lot 2 porte le **MVP Dealplace** (troc/échange de biens et services entre
Réunionnais, selon le PRD global — dossier `01_PRD`). Rien de tout cela n'est
développé au Lot 1 : ce fichier liste les chantiers, et rappelle les points
d'ancrage déjà posés dans le socle pour les accueillir sans refonte.

---

## 1. Dealplace MVP — chantiers du Lot 2

### 1.1 Taxonomie biens / services
- [ ] Modèle de catégories/sous-catégories couvrant **biens** et **services**.
- [ ] Administration de la taxonomie depuis le backoffice.

### 1.2 Listings
- [ ] CRUD des annonces (bien ou service) avec **valeur estimée obligatoire**.
- [ ] **Photo obligatoire pour un bien** (règle de validation serveur + UX
      mobile) ; facultative pour un service.
- [ ] Recherche/filtres (catégorie, commune, valeur) — réutiliser le module
      `map` du socle pour la proximité.

### 1.3 Profil Dealplace
- [ ] Volet Dealplace du profil utilisateur : historique d'échanges,
      **avis détaillés** (note + critères + commentaire), fiabilité.
- [ ] Réutiliser le profil `users` du Lot 1 (extension, pas de duplication).

### 1.4 Conversations 1-to-1 temps réel
- [ ] Messagerie privée liée à un listing/deal, **temps réel via WebSocket**.
- [ ] S'appuyer sur la **gateway WebSocket posée à l'étape 5** du Lot 1
      (namespaces réservés) — ne pas créer un second canal temps réel.
- [ ] Persistance + notifications (adapter push déjà en place).

### 1.5 Page de deal contractuelle
- [ ] Machine à états explicite :
      `BROUILLON → … → CONCLU` (états intermédiaires à préciser avec le PRD :
      proposition, négociation, accepté, en cours…), plus les sorties
      **annulation** et **litige**.
- [ ] **Éléments et sous-éléments validables** : chaque partie coche ce qui
      est convenu/livré ; le deal n'avance que si les deux parties valident.
- [ ] **Ajustements** en cours de deal (modification d'éléments, contre-
      propositions) avec historique.
- [ ] **Annulation / litige** : flux d'annulation amiable + ouverture de
      litige (l'arbitrage **litige IA** est prévu architecturalement mais
      reste hors périmètre — voir [MOCKED_SERVICES.md](MOCKED_SERVICES.md) §2).

---

## 2. Points d'ancrage déjà posés dans le socle (Lot 1)

| Ancrage | Où | Sert à |
|---|---|---|
| Modules placeholders `_future` | `apps/api/src/modules/_future/` (dealplace, deals, conversations, pages, news, billing) | Accueillir chaque chantier ci-dessus sans toucher à l'arborescence |
| `page_id` nullable sur les publications | schéma DB (étape 2) | Pages restaurants/entreprises émettrices de contenu |
| Gateway WebSocket | module `realtime` (étape 5) | Conversations 1-to-1 et tout temps réel futur |
| Adapters remplaçables (media/geocoding/push/email) | `apps/api/src/adapters/` (posés aux étapes 2-5 du Lot 1) | Photos de listings, géoloc des annonces, notifications de deals |
| `url_slug` sur les posts publics | modules `posts` (étape 4) | Même mécanique à répliquer pour les listings partageables |
| Onglet Dealplace placeholder | bottom nav Flutter (étape 7) | Brancher les écrans Dealplace sans refonte de navigation |
| Taxonomie/types administrables | backoffice (étape 6) | Modèle à étendre pour la taxonomie biens/services |

---

## 3. Autres lots (une ligne chacun)

- **Pages restaurants / entreprises** : pages possédées par des utilisateurs
  (ancrage `page_id` + `_future/pages`), menus/infos, publications de page.
- **News IA** : onglet News alimenté par scraping + agent IA de rédaction
  (ancrage `_future/news`, onglet placeholder mobile).
- **Monétisation** : premium/Stripe, Google Ads réel, offres exceptionnelles
  payantes, comptes pro (ancrage `_future/billing`, variables dans
  [ACCESS_NEEDED.md](ACCESS_NEEDED.md) §7).

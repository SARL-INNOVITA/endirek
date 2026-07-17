# TODO Lot 3 — ✅ FAIT (CP3.R1 + CP3.R2 terminés le 2026-07-17)

> **CE FICHIER EST CLOS.** Le Lot 3 mobile est terminé : CP3.R1 (feature +
> intégrations) ET CP3.R2 (vérification visuelle émulateur) sont faits.
> Reste UNIQUEMENT la validation du product owner, puis le push des commits
> locaux. Ce fichier peut être supprimé après le push.

## CP3.R2 — ✅ FAIT (2026-07-16/17) : rapport de vérification émulateur

Parcours complet exécuté sur `Pixel_3a_API_34` (API mock, log de seed
inchangé), en heure Réunion :

- **Visiteur (Laurence)** : feed avec identité de page (avatar/nom/✓, types
  colorés), écran public fidèle au mockup 08 (statut dérivé vérifié contre
  l'API, bottom sheet horaires, sélecteur 7 jours glissants — jour sans menu
  compris), suivre/se désabonner (3↔4 abonnés), message à la page (fil seed
  n°4 rouvert par get-or-create, envoi OK, badge côté propriétaire),
  itinéraire (Google Maps ouvert sur le point « Bon Goût »), signalement
  (file admin +1), détail de publication avec identité de page, carte
  (bascules par famille, marqueurs menu/offre/événement, preview avec ✓).
- **Propriétaire (David)** : hub de gestion complet — infos + cycle congés
  COMPLET (poser → « EN CONGÉS » → lever), horaires, plats (création
  « Samoussas poisson » 5,50 €), menus de la semaine (ajout au jour courant,
  enregistrement, pastille de modification), cartes PDF (file_picker →
  upload RÉEL `/media/upload-document` → attache 3/5 → ouverture via Chrome
  sur l'URL `/uploads/` réécrite par `ApiConfig.resolveMediaUrl`), offres,
  événements ; **publication du menu du jour** → post en tête du feed
  (corps auto-composé avec les 4 plats du jour) ET marqueur + preview sur
  la carte (fenêtre 23 h vérifiée : expiré le lendemain).
- **Modération** : masquage de la page (PATCH admin `status=hidden`) →
  publications RETIRÉES du feed et de la carte (émulateur + sondes API :
  0 post de page sur `/map/overview`, 404 visiteur), badge « Masquée par la
  modération » sur la tuile « Mes pages » de David ; restauration → page
  visible (200) et événement de retour sur la carte.

**2 défauts constatés et corrigés (apps/mobile uniquement, analyze vierge,
82 tests verts après chaque correctif)** :

1. **Cluster carte indivisible inouvrable** — les publications d'une même
   page partagent le point de la page (D73) : le cluster ne s'éclatait
   jamais et le tap ne faisait rien au zoom max. Correctif :
   `MarkerClusterer.peutEclater()` (détection « même cellule au pas du zoom
   max ») + bottom sheet `contenu_cluster_sheet.dart` listant le contenu
   (type coloré, identité de page ✓, titre, ville · temps) ; le choix
   sélectionne le marqueur comme un tap ordinaire (preview). Tests unitaires
   + widget ajoutés, README carte mis à jour.
2. **Enregistrement des infos de page en échec sur le seed** — l'écran
   renvoyait au PATCH les URLs d'avatar/couverture INCHANGÉES ; la garde de
   provenance serveur (D16/D77) refuse une URL hors upload Endirek (cas des
   visuels picsum du seed) → « Les médias doivent provenir de l'upload
   Endirek » en enregistrant les congés. Correctif : sentinelle
   `champAbsent` rendue publique dans `pages_repository.dart`, l'écran
   n'envoie avatar/couverture QUE s'ils ont été modifiés (upload/retrait).

**Notes de démo (non bloquantes, aucun changement API)** :
- Les 2 cartes PDF du SEED pointent vers un PDF public w3.org désormais
  derrière une vérification anti-bot Cloudflare : l'ouverture débouche sur
  un CAPTCHA (franchissable par un humain). Les documents réellement
  UPLOADÉS (flux propriétaire) s'ouvrent parfaitement — vérifié.
- L'émulateur peut perdre son fuseau (retour GMT) après une veille de la
  machine hôte : les heures affichées semblent décalées de −4 h. Refaire
  `adb shell cmd alarm set-timezone Indian/Reunion` (l'app affiche l'heure
  LOCALE du device — comportement correct).

## Rappels de périmètre (NE PAS déborder)

Réservation restaurant, offres exceptionnelles/monétisation, changement de
propriétaire de page, rendu web public, marqueurs de PAGES permanents sur la
carte : HORS Lot 3 (voir [KNOWN_LIMITS.md](KNOWN_LIMITS.md) §2 septies).

---

## Archive — contexte d'origine

> Le Lot 3 a été implémenté en un passage le 2026-07-14/15 :
> **API et backoffice sont COMPLETS et VÉRIFIÉS** (voir
> [AI_HANDOFF.md](AI_HANDOFF.md) §3 et les décisions D69-D77 dans
> [AI_DECISIONS.md](AI_DECISIONS.md)). Le volet MOBILE avait été interrompu
> en cours de route (limite d'API du sous-agent) ; **le CP3.R1 (reprise) est
> FAIT le 2026-07-15** : feature `pages` complète et câblée au routeur,
> toutes les intégrations posées, `flutter analyze` vierge et **74 tests
> verts** (dont 30 nouveaux), parcours runtime API mock vérifié.

## Sources de vérité pour la reprise

- **Contrat API** : `apps/api/src/modules/pages/README.md` (tableau des
  endpoints + règles), les interfaces de vue dans
  `apps/api/src/common/mappers/page.mapper.ts` (formes PAGE/PAGE_CARD/DISH/
  MENU_DAY/OFFER/EVENT exactes) et `post.mapper.ts` (`FeedPost.page`,
  `PostPageRef`), Swagger `http://localhost:3001/docs` (tag `pages`).
- **Référence visuelle** : mockup local `02_MOCKUPS/08 Page restaurant.png`
  (écran public), mockups 04/05 pour l'insertion « Mes pages » au profil.
- **Seed de démo** : page « Bon Goût » (restaurant vérifié de David Payet,
  menus sur la semaine glissante, 2 cartes PDF, offre, événement, 3 posts de
  page) et « Ti Kaz Services » (entreprise, 1 signalement ouvert) —
  comptes/`endirek974`, détail au §4 nonies du [AI_RUNBOOK.md](AI_RUNBOOK.md).

## État PRÉCIS du mobile (commit du 2026-07-15)

### ✅ Fait (compile, testé par `flutter analyze`/`test` — mais INACCESSIBLE tant que les routes ne sont pas posées)

- `pubspec.yaml` : dépendances **url_launcher** (itinéraire + ouverture PDF)
  et **file_picker** (sélection de PDF) ajoutées, `pub get` passé.
- Modèles transverses : `lib/core/api/models/post_page_ref.dart` ;
  `feed_post.dart` et `map_post_item.dart` portent le champ `page`
  (PARSÉ mais PAS ENCORE AFFICHÉ par les widgets).
- `media_repository.uploaderDocument(...)` (POST /media/upload-document).
- Feature `lib/features/pages/` :
  - `data/pages_repository.dart` — tous les appels API du contrat ;
  - `application/pages_providers.dart` — providers Riverpod ;
  - `domain/` — `page_models.dart` (Page, PageCard, Dish, MenuDay, Offer,
    Event, OpenStatus…), `formatage_pages.dart` (centimes → « 12,50 € »,
    jours/horaires français), `types_posts_page.dart` (libellés/couleurs
    des slugs menu/offer/event : #0EA5A4/#D97706/#DB2777) ;
  - `presentation/` — `page_screen.dart` (écran PUBLIC complet du mockup
    08 : couverture, ✓, statut dérivé, horaires bottom sheet, menus de la
    semaine, « Nos cartes », offres, événements, publications, suivre/
    message/itinéraire/signaler), `page_posts_screen.dart`,
    `create_page_screen.dart`, `publier_libre_screen.dart`,
    `gestion/gerer_page_screen.dart` (hub) + `gerer_infos_screen.dart` +
    `gerer_horaires_screen.dart` + `gerer_plats_screen.dart`, widgets
    (badge ✓, carte de plat, chip de statut, bottom sheet horaires,
    tuile de page pour le profil).

## CP3.R1 — Finaliser la feature mobile + intégrations — ✅ FAIT (2026-07-15)

> Réalisé en un passage (commit local `feat: Lot 3 — mobile pages (CP3.R1)`) :
> 1. **Routes** : `/pages/create`, `/pages/:id`, `/pages/:id/posts`,
>    `/pages/:id/publier`, `/pages/:id/contact` (→ `ChatScreen.pourPage`),
>    `/pages/:id/gerer` + 7 sous-routes imbriquées (infos/horaires/plats/
>    menus/cartes/offres/evenements) — statiques avant `/pages/:id`.
> 2. **Écrans de gestion** : `gerer_menus_screen` (7 jours glissants,
>    sélection ordonnée ≤12 plats avec réordonnancement par glisser,
>    [] = suppression confirmée), `gerer_cartes_screen` (file_picker PDF →
>    `uploaderDocument` → attache, quota 5 gardé des deux côtés),
>    `gerer_offres_screen` (CRUD, période optionnelle 00:00→23:59 locales,
>    effacement par null explicite) et `gerer_evenements_screen` (CRUD,
>    début REQUIS date+heure, fin optionnelle effaçable).
> 3. **Bottom sheet « Publier »** : déjà écrit dans `page_screen.dart` (FAB
>    propriétaire, 4 choix) — rendu atteignable par les routes, vérifié en
>    runtime (`kind=menu` → 201 avec identité de page).
> 4. **Feed + détail** : identité de PAGE (avatar, nom, ✓) à la place de
>    l'auteur quand `FeedPost.page != null`, zone tappable → `/pages/:id`,
>    types menu/offer/event résolus par la table locale
>    `types_posts_page.dart` (chemin utilisateur inchangé au pixel près).
> 5. **Messages (D75)** : `ConversationCard.listing` nullable + champ
>    `page` (`ConversationPageRef`), `chargerFilPourPage`,
>    `demarrerConversation({listingId?|pageId?})`, bandeau de page cliquable
>    dans le fil et vignette de page dans la liste ; le bandeau/action deal
>    ne s'active jamais sur un fil de page.
> 6. **Profil** : section « Mes pages » (tuiles + bouton « Créer une
>    page ») dans « Mes infos », rafraîchie par le pull-to-refresh.
> 7. **Carte** : filtres menus/offres/evenements (bottom sheet + bascules
>    rapides des chips de mode, ex-placeholders), visuels partagés via
>    `types_posts_page.dart`, identité de page dans la preview.
> 8. **Vérifications** : analyze vierge, 75 tests verts (+
>    `pages_formatage_test`, `pages_models_test`, cas fil de page et
>    publication de page), sondes runtime API mock (mes pages,
>    conversations de page get-or-create + 404, menus PUT/[] ,
>    offres cycle complet, publication menu, overview carte types de page),
>    et revue adversariale multi-agents du diff : 15 findings confirmés,
>    TOUS corrigés (avatar de page sans repli sur l'avatar personnel du
>    propriétaire, zone de tap identité bornée à son contenu, dates
>    initiales des DatePickers bornées, invalidations résilientes au rejet
>    d'une sheet pendant l'enregistrement, gardes mounted après await,
>    retouches de menu conservées pendant un enregistrement, anti-course
>    des filtres carte, preview de marqueur filtré refermée, bottom sheet
>    de filtres défilant, tests indépendants de l'horloge murale).

### Détail d'origine du CP3.R1 (réalisé)

1. **Routes go_router** (`lib/core/router/…`, pattern des routes
   `/dealplace/:id` hors shell) : `/pages/create`, `/pages/:id`,
   `/pages/:id/posts`, `/pages/:id/gerer` (+ sous-écrans de gestion,
   navigation depuis le hub), écran de publication libre. VÉRIFIER en
   passant que les écrans déjà écrits naviguent avec les bons noms.
2. **Écrans de gestion manquants** (à ancrer dans le hub `gerer_page_screen`,
   restaurant uniquement pour menus/cartes) :
   - menus de la semaine : par jour de la semaine glissante, sélection
     ORDONNÉE parmi les plats actifs, `PUT /pages/:id/menus/:date`
     ([] = supprimer) ;
   - « Nos cartes » : liste + ajout (file_picker → `uploaderDocument` →
     `POST /pages/:id/documents`, gérer le quota 400 « 5 documents max »)
     + suppression ;
   - offres : CRUD avec période optionnelle (DatePickers) ;
   - événements : CRUD avec `startsAt` obligatoire (date + heure).
3. **Bottom sheet « Publier »** (bouton du hub/page si propriétaire) :
   Publication libre (écran déjà écrit) / Menu du jour (`kind=menu`, gérer
   le 400 « Aucun menu programmé pour aujourd'hui ») / Offre (choisir puis
   `kind=offer` + offerId) / Événement (`kind=event` + eventId). Snackbar
   succès + navigation vers la page.
4. **Intégration feed + détail de post** : quand `FeedPost.page != null`,
   la carte de post et l'en-tête du détail affichent l'IDENTITÉ DE PAGE
   (avatar, nom, ✓ si vérifiée, libellé/couleur du type via
   `types_posts_page.dart`) au lieu de l'auteur ; tap → `/pages/:id`.
5. **Intégration messages (D75)** : `ConversationCard.listing` devient
   NULLABLE + champ `page` (adapter `fromJson` et TOUS les usages — liste
   des conversations et fil affichent le bandeau de PAGE cliquable quand
   `page != null`) ; bouton « Message » de `page_screen` → fil existant
   (`GET /conversations/page/:id`) ou premier message
   (`POST /conversations {pageId, body}`) — réutiliser les écrans du CP2.3.
6. **Intégration profil** : section « Mes pages » dans « Mes infos »
   (cartes `tuile_page_profil` déjà écrites — badge « Masquée » si
   status=hidden) + bouton « Créer une page ».
7. **Intégration carte** : ajouter menu/offer/event aux filtres et aux
   marqueurs (icônes restaurant/tag/événement, couleurs de
   `types_posts_page.dart`), identité de page dans la preview
   (`MapPostItem.page`). Suivre le pattern weather/traffic/danger existant.
8. **Vérifications** : `flutter analyze` (« No issues found! »),
   `flutter test` (tous verts — corriger les tests impactés, en ajouter
   sur le formatage/parsing pages), boot API mock + parcours runtime rapide.

> Le plan d'origine du CP3.R2 (exécuté intégralement, voir le rapport en
> tête de fichier) : parcours « Bon Goût » visiteur + propriétaire sur
> émulateur, publication du menu → feed + carte, masquage backoffice →
> disparition feed/carte, docs + commit, validation product owner, push.
> Aucun repository n'a bougé (correctifs UI mobiles uniquement) → pas de
> re-test croisé postgres nécessaire.

# ENDIREK — Services mockés

Aucun accès externe (base managée, bucket S3, clés API) n'est disponible au
Lot 1 : chaque intégration est donc isolée derrière un **adapter à interface
stable**, avec une implémentation mock sélectionnée par variable
d'environnement. Remplacer un mock par le service réel = renseigner le `.env`
et changer le driver — **aucun changement de code métier**.

> Voir aussi : [ACCESS_NEEDED.md](ACCESS_NEEDED.md) (accès à fournir) et
> [KNOWN_LIMITS.md](KNOWN_LIMITS.md) (conséquences concrètes des mocks).

---

## 1. Services mockés au Lot 1

| Service | Raison du mock | Comportement du mock | Variables `.env` attendues (apps/api/.env.example) | Quand / comment remplacer |
|---|---|---|---|---|
| **Base de données** (PostgreSQL/PostGIS) | Docker non installé sur la machine de dev, pas de base managée fournie | `DB_DRIVER=mock` : adapter **implémenté (étape 2 faite)** derrière les mêmes interfaces de repositories que le futur driver PostgreSQL ; données en mémoire, seed La Réunion chargé au boot si `DB_MOCK_SEED=true` (défaut) — schéma et décisions : [DATABASE.md](DATABASE.md) | `DB_DRIVER`, `DB_MOCK_SEED`, `DATABASE_URL`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Dès que Docker est installé : `infra/docker-compose.yml`, migrations `apps/api/db/migrations/`, implémentation du driver postgres puis `DB_DRIVER=postgres` + `DATABASE_URL` (procédure : [DATABASE.md](DATABASE.md) §7) ; en prod : base managée ou serveur Hetzner |
| **Géocodage inverse** | Aucune clé de géocodage fournie | `GEOCODING_PROVIDER=mock` : table locale des communes de La Réunion + recherche du **plus proche voisin** : des coordonnées lat/lng, on déduit la commune ; champ ville toujours ajustable manuellement (caméras) | `GEOCODING_PROVIDER`, `GEOCODING_API_KEY`, `MAP_PROVIDER`, `MAP_TILE_URL`, `MAP_API_KEY` | Fin Lot 1 / Lot 2 : fournir `GEOCODING_API_KEY` + `GEOCODING_PROVIDER` (provider à choisir) ; l'adapter réel remplace le mock, l'interface ne bouge pas |
| **Stockage médias S3** | Aucun bucket S3/Hetzner fourni | `MEDIA_STORAGE_DRIVER=local` : écriture sur disque local (`apps/api/uploads/`, non versionné), interface compatible S3 (put/get/delete/URL publique) | `MEDIA_STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL` | Quand le bucket est fourni : `MEDIA_STORAGE_DRIVER=s3` + variables `S3_*` ; test local possible via MinIO (bloc en commentaire dans `infra/docker-compose.yml`) |
| **Push FCM/APNs** | Projet Firebase / certificats APNs non fournis | `PUSH_DRIVER=mock` : aucun envoi ; les notifications sont **persistées en base** et servies in-app (cloche + liste) — l'expérience notification existe sans push | `PUSH_DRIVER`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FCM_SERVER_KEY` | Fin Lot 1 / production : créer le projet Firebase, fournir les variables, `PUSH_DRIVER=fcm` ; APNs via FCM pour iOS |
| **Email Brevo** | Compte Brevo non fourni | `EMAIL_DRIVER=mock` : le driver mock loguera en console au lieu d'envoyer. Attention : au Lot 1, les flux de **vérification d'email** et de **reset de mot de passe** ne sont **PAS implémentés du tout** (pas seulement mockés) — aucun code ne produit encore ces emails (voir [KNOWN_LIMITS.md](KNOWN_LIMITS.md) §2 bis et [RGPD.md](RGPD.md)) | `EMAIL_DRIVER`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Fin Lot 1 / production : implémenter les flux (vérification, reset), fournir les clés Brevo, `EMAIL_DRIVER=brevo` |
| **OAuth Google / Apple** | Clients OAuth non configurés | Boutons **désactivés** dans l'app mobile (avec mention « bientôt disponible ») ; endpoints **réels et en place depuis l'étape 3** (`POST /api/v1/auth/oauth/google\|apple`, visibles dans Swagger) répondant **`501 Not Implemented`** avec un message propre ; l'auth email/mot de passe (étape 3, fonctionnelle) couvre le besoin | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID` | Lot 2 (ou fin Lot 1 si les clés arrivent) : renseigner les variables, implémenter la vérification de token derrière les endpoints existants, activer les boutons |

---

## 2. Prévus architecturalement, non implémentés au Lot 1

Repris de `04_ACCESS/ACCESS_MATRIX.md` (document produit local, non
versionné) : ces services n'ont **ni mock actif
ni variable requise** au Lot 1 — seulement des points d'ancrage
(`apps/api/src/modules/_future/`, TODO Lot 2+ documentés).

| Service futur | Lot concerné | Ancrage prévu |
|---|---|---|
| Google Ads (publicité réelle) | Lot 2+ | Emplacements publicitaires prévus dans le feed (types de cartes), module `_future/billing` |
| Paiement premium (Stripe ou équivalent) | Lot 2+ | Module `_future/billing` ; flag de compte prévu côté users |
| News IA automatisées (News Agent Harness) | Lot 2+ | Onglet News placeholder mobile ; module `_future/news` |
| GPT Image (génération d'images) | Lot 2+ | Passera par un adapter dédié, comme les autres intégrations |
| Litige IA (arbitrage des deals) | Lot 2+ (Dealplace) | Prévu dans la machine à états des deals (état LITIGE) — voir [TODO_LOT_2.md](TODO_LOT_2.md) |
| Scraping news | Lot 2+ | Alimentera le module News ; hors périmètre Lot 1 |
| Offres exceptionnelles payantes | Lot 2+ | Mode carte « Offres & restos » placeholder au Lot 1 |

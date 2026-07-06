# ENDIREK — Accès et clés à fournir

Liste structurée des accès/API nécessaires plus tard, reprise et précisée
depuis `04_ACCESS/ACCESS_MATRIX.md` (document produit local, non versionné).
**En attendant, chaque service a un
mock fonctionnel** (voir [MOCKED_SERVICES.md](MOCKED_SERVICES.md)) : rien ne
bloque le développement du Lot 1.

Toutes les variables ci-dessous sont déjà déclarées (vides) dans
`apps/api/.env.example`. Règle absolue : **jamais de secret versionné** —
uniquement des variables d'environnement.

Légende priorité :
- **Fin Lot 1** : utile pour la démo/production du Lot 1 lui-même.
- **Lot 2** : requis au démarrage du Lot 2.
- **Production** : indispensable seulement à la mise en production.

---

## 1. PostgreSQL/PostGIS (base managée ou serveur Hetzner)

- **Variables** : `DATABASE_URL`, `POSTGRES_HOST`, `POSTGRES_PORT`,
  `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (+ `DB_DRIVER=postgres`)
- **Module impacté** : `database` (étape 2) — et donc tous les modules métier
- **Priorité** : **Fin Lot 1** (en local, Docker via `infra/` suffit dès
  qu'il est installé ; la base distante est surtout un besoin de
  déploiement/production sur Hetzner)

## 2. Stockage médias S3 (bucket S3/Hetzner Object Storage)

- **Variables** : `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`,
  `S3_SECRET_KEY`, `S3_PUBLIC_URL` (+ `MEDIA_STORAGE_DRIVER=s3`)
- **Module impacté** : `media` (étape 4) — photos de posts et de profils
- **Priorité** : **Production** (le stockage local `apps/api/uploads/`
  couvre tout le développement)

## 3. Cartographie (tuiles Mapbox/MapLibre) + géocodage

- **Variables** : `MAP_PROVIDER`, `MAP_TILE_URL`, `MAP_API_KEY`,
  `GEOCODING_PROVIDER`, `GEOCODING_API_KEY`
- **Modules impactés** : `map`, `cameras` (étape 5) + carte Flutter (étape 7)
- **Priorité** : **Fin Lot 1 / Production** — les tuiles OSM publiques sont
  tolérées en dev uniquement (tile usage policy) ; le géocodage mock
  (communes de La Réunion + plus proche voisin) est suffisant en dev mais
  moins précis qu'une vraie API

## 4. Push : Firebase (FCM) / APNs

- **Variables** : `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`, `FCM_SERVER_KEY` (+ `PUSH_DRIVER=fcm`)
- **Module impacté** : `notifications` (étape 5) + intégration Flutter
- **Priorité** : **Fin Lot 1** pour une démo crédible sur appareil réel ;
  d'ici là, notifications in-app persistées en base (driver `mock`)

## 5. Email : Brevo

- **Variables** : `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
  (+ `EMAIL_DRIVER=brevo`)
- **Module impacté** : `auth` (étape 3 — vérification d'email, reset de
  mot de passe)
- **Priorité** : **Fin Lot 1 / Production** (en dev, les emails sont logués
  en console)

## 6. OAuth Google / Apple

- **Variables** : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `APPLE_CLIENT_ID`
- **Modules impactés** : `auth` (endpoints déjà prévus, en 501) + écrans de
  connexion Flutter (boutons désactivés)
- **Priorité** : **Lot 2** — l'auth email/mot de passe couvre le Lot 1 ;
  Apple exige en plus un compte Apple Developer

## 7. Stripe (ou équivalent) — paiement premium *(futur)*

- **Variables** : à définir au Lot concerné (probablement
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`) —
  **volontairement absentes** de `.env.example` tant que le module n'existe pas
- **Module impacté** : `modules/_future/billing` (TODO Lot 2+)
- **Priorité** : **Lot 2+** (monétisation : premium, offres exceptionnelles,
  comptes pro)

---

## Récapitulatif

| Accès | Variables clés | Module | Priorité |
|---|---|---|---|
| PostgreSQL/PostGIS managé ou Hetzner | `DATABASE_URL`, `POSTGRES_*` | `database` | Fin Lot 1 |
| Bucket S3/Hetzner | `S3_*` | `media` | Production |
| Tuiles carto + géocodage | `MAP_*`, `GEOCODING_*` | `map`, `cameras` | Fin Lot 1 / Production |
| Firebase / APNs | `FIREBASE_*`, `FCM_SERVER_KEY` | `notifications` | Fin Lot 1 |
| Brevo | `BREVO_*` | `auth` | Fin Lot 1 / Production |
| OAuth Google / Apple | `GOOGLE_*`, `APPLE_CLIENT_ID` | `auth` | Lot 2 |
| Stripe (futur) | `STRIPE_*` (à définir) | `_future/billing` | Lot 2+ |

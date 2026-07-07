# ENDIREK - Demo Lot 1

Guide de demonstration du Lot 1 "Socle + Live Local" : auth, feed social,
carte meteo/trafic, cameras, notifications temps reel et backoffice.

> Aucun secret reel ici. Les comptes ci-dessous viennent du seed mock local.

---

## 1. Prerequis

- Node >= 22 + npm.
- Flutter >= 3.44 pour l'app mobile.
- Docker non requis : l'API demarre en `DB_DRIVER=mock` par defaut.
- Sur cette machine Windows, Flutter n'est pas dans le PATH systeme :
  utiliser `C:\Users\User\flutter\bin\flutter.bat` ou ajouter ce dossier au PATH.

---

## 2. Lancer l'API

Depuis la racine du repo :

```bash
npm.cmd run api:dev
```

URLs utiles :

- API : `http://localhost:3001/api/v1`
- Healthcheck : `http://localhost:3001/health`
- Swagger : `http://localhost:3001/docs`

Log de seed attendu :

```text
Mock DB prête : 15 utilisateurs, 32 follows, 42 posts (dont 13 visibles carte), 60 commentaires, 155 réactions, 12 caméras, 4 signalements, 12 notifications
```

---

## 3. Lancer le backoffice

Depuis la racine du repo :

```bash
npm.cmd run admin:dev
```

Ouvrir `http://localhost:5173`.

Comptes admin :

| Email | Role | Mot de passe |
|---|---|---|
| `equipe@endirek.invalid` | `super_admin` | `endirek974` |
| `marie.hoarau@endirek.invalid` | `moderator` | `endirek974` |

Actions a montrer :

1. Connexion admin.
2. Liste utilisateurs, filtre par statut/role, suspension/reactivation.
3. Liste publications, filtres type/statut/carte, masquage/reactivation.
4. File signalements, traitement d'un signalement.
5. Cameras : liste tous statuts, creation/edition, changement de statut, masquage doux.
6. Parametres : types de posts pilotables, notification systeme dev/mock.

---

## 4. Lancer le mobile

Depuis `apps/mobile` :

```bash
C:\Users\User\flutter\bin\flutter.bat pub get
C:\Users\User\flutter\bin\flutter.bat run -d chrome
```

Pour un emulateur Android :

```bash
C:\Users\User\flutter\bin\flutter.bat run --dart-define=API_BASE_URL=http://10.0.2.2:3001
```

Compte utilisateur de demo :

| Email | Mot de passe |
|---|---|
| `jean-yves.payet@endirek.invalid` | `endirek974` |

Un nouveau compte peut aussi etre cree depuis l'ecran d'inscription. Les donnees
mock sont perdues au redemarrage de l'API.

---

## 5. Parcours mobile conseille

1. Se connecter ou creer un compte.
2. Lire le feed, tirer pour rafraichir.
3. Creer une publication libre.
4. Creer une publication meteo/trafic/danger avec une commune pour l'afficher sur la carte.
5. Verifier que le post apparait dans le feed.
6. Ouvrir l'onglet Carte, voir les posts carte et cameras actives.
7. Taper un marqueur, ouvrir la preview, puis le detail.
8. Commenter, repondre a un commentaire, reagir, enregistrer, signaler.
9. Ouvrir les notifications depuis la cloche et marquer les notifications comme lues.
10. Ouvrir le profil depuis l'avatar du composer, modifier nom/bio/ville, se deconnecter.

---

## 6. Verification rapide API

Exemple de login :

```bash
curl -X POST http://localhost:3001/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"equipe@endirek.invalid\",\"password\":\"endirek974\"}"
```

Avec le token obtenu :

```bash
curl http://localhost:3001/api/v1/posts/feed -H "Authorization: Bearer <TOKEN>"
curl http://localhost:3001/api/v1/map/overview -H "Authorization: Bearer <TOKEN>"
curl http://localhost:3001/api/v1/notifications/unread-count -H "Authorization: Bearer <TOKEN>"
curl http://localhost:3001/api/v1/admin/post-types -H "Authorization: Bearer <TOKEN_ADMIN>"
```

---

## 7. Ce qui est mocke

- Base de donnees : `DB_DRIVER=mock`, seed in-memory.
- Geocodage : `GEOCODING_PROVIDER=mock`.
- Stockage media : local, sous `apps/api/uploads/`.
- Email : `EMAIL_DRIVER=mock`.
- Push mobile distant : `PUSH_DRIVER=mock` ; les notifications sont in-app + WebSocket.
- OAuth Google/Apple : endpoints presents mais repondent 501.

---

## 8. Limites a annoncer en demo

- Pas de vraie base PostgreSQL/PostGIS tant que Docker n'est pas disponible.
- Donnees mock non persistantes entre redemarrages.
- Pas de GPS precis : les posts carte utilisent le centre de la commune choisie.
- Tuiles OSM publiques reservees au dev ; provider dedie a prevoir en production.
- Partage natif non branche ; le bouton affiche "prochainement".
- Pas de videos, images uniquement.
- Flux cameras video/iframe non rendus dans l'app ; seuls les flux image sont affiches.
- Pas de messagerie, Dealplace, pages pro, News IA, premium, paiement ni Google Ads reel au Lot 1.

---

## 9. Checks avant demo

```bash
npm.cmd run api:build
npm.cmd run admin:build
cd apps/mobile
C:\Users\User\flutter\bin\flutter.bat analyze
C:\Users\User\flutter\bin\flutter.bat test
```

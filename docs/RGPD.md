# ENDIREK — Stratégie RGPD du MVP (Lot 1, étape 3)

Ce document décrit **ce que le code fait réellement** à l'étape 3 pour les
droits RGPD des utilisateurs — export des données, suppression du compte,
invalidation des jetons — ainsi que les **limites honnêtes du MVP** et les
TODO à traiter avant une mise en production.

Implémentation : `apps/api/src/modules/users/users.service.ts` (export et
suppression), `apps/api/src/common/guards/jwt-auth.guard.ts` (invalidation).

---

## 1. Export des données — `GET /api/v1/users/me/export`

Droit d'**accès** (article 15) et de **portabilité** (article 20) : tout
utilisateur connecté peut télécharger l'intégralité de ses données en un
appel, au format JSON, servi en pièce jointe
(`Content-Disposition: attachment; filename="endirek-export.json"`).

Contenu de l'export (`format: 'endirek-export'`, `version: 1`,
`exportedAt` horodaté) :

| Bloc | Contenu |
|---|---|
| `account` | Le compte complet — email, nom affiché, bio, ville, position, photos, settings, rôle, statut, dates — **sauf le hash du mot de passe**, qui ne sort jamais du serveur (aucune valeur d'usage pour l'utilisateur, risque en cas de fuite du fichier) |
| `posts` | Toutes les publications de l'utilisateur |
| `comments` | Tous ses commentaires |
| `reactions` | Toutes ses réactions |
| `follows` | Abonnements émis et reçus — les tiers y sont réduits à une **référence minimale** (id + nom affiché) : l'export d'un utilisateur n'embarque pas les données personnelles des autres |
| `savedCollections` | Ses collections d'enregistrements, avec pour chaque post enregistré une référence minimale (id, titre, slug) — le post appartient à un tiers, seul le **lien** d'enregistrement est une donnée de l'utilisateur |
| `notifications` | Ses notifications |
| `reportsSubmitted` | Les signalements qu'il a émis |

L'agrégation passe exclusivement par les repositories (jamais d'accès direct
aux stores) : l'export fonctionnera à l'identique après la bascule PostgreSQL.

## 2. Suppression du compte — `DELETE /api/v1/users/me`

Droit à l'**effacement** (article 17), implémenté en
**soft-delete + anonymisation** (réponse `204 No Content`) :

1. **Anonymisation immédiate** du compte :
   - nom affiché → « Utilisateur supprimé » ;
   - email → adresse technique `deleted-<id>@endirek.invalid` (TLD `.invalid`
     réservé par la RFC 2606, jamais routable) — libère l'email d'origine et
     ne conserve aucune donnée identifiante ;
   - bio vidée ; avatar, couverture, ville et position effacés ;
   - `settings` remis à `{}`.
2. **Marquage supprimé** : `status = 'deleted'` + `deletedAt` — la ligne
   reste en base, mais ne porte plus aucune donnée personnelle.

### Ce qui est conservé, et pourquoi

- **Les publications et commentaires sont conservés**, rattachés à l'auteur
  anonymisé : le feed et les fils de discussion **ne cassent pas** pour les
  autres utilisateurs (pas de posts orphelins, pas de fils troués). L'auteur
  y apparaît comme « Utilisateur supprimé », sans avatar — plus aucune donnée
  personnelle n'y est associée.
- Depuis le checkpoint 6, le backoffice peut masquer (`hidden`) ou
  soft-delete (`deleted`) un commentaire signalé. Cette action est une mesure
  de modération : la ligne reste conservée pour cohérence du fil et audit,
  et une racine non active avec réponses actives reste affichée comme
  emplacement vide.
- **La ligne du compte anonymisée est conservée** : elle sert de cible aux
  clés étrangères (posts, commentaires, follows historiques) et reste
  visible du backoffice pour l'audit (`GET /admin/users?status=deleted`).

### Effets visibles

- Profil public → `404` pour les tiers, absent des listes
  followers/following ;
- reconnexion impossible : le login d'un compte supprimé répond `401`
  « Identifiants invalides » (message identique à un email inconnu — aucune
  fuite d'information) ;
- statut **définitif** : le backoffice ne peut pas réactiver un compte
  supprimé (`409` sur `PATCH /admin/users/:id/status`) — il a été anonymisé,
  il n'y a plus rien à réactiver.

## 3. Invalidation des jetons après suppression (ou suspension)

L'authentification est **stateless** (JWT), mais les jetons encore en
circulation cessent de fonctionner **immédiatement** après la suppression :

- le guard JWT global (`JwtAuthGuard`) **recharge l'utilisateur en base à
  CHAQUE requête** et revérifie son statut : compte `deleted` → `401`,
  compte `suspended` → `403` « Compte suspendu » — sans liste de révocation
  côté serveur ;
- `POST /auth/refresh` revérifie de même que le compte est toujours `active`
  avant d'émettre une nouvelle paire de jetons : un refresh token d'un compte
  supprimé ou suspendu est inutilisable.

## 4. Limites honnêtes du MVP (étape 3)

À dire clairement — voir aussi [KNOWN_LIMITS.md](KNOWN_LIMITS.md) :

- **Pas de purge définitive automatisée** : le soft-delete anonymise mais ne
  détruit pas la ligne ni les contenus. La suppression physique (purge de la
  ligne, des posts/commentaires si demandé) relève d'une procédure manuelle
  d'administration, non outillée au Lot 1.
- **Pas de délai de rétractation** : la suppression est immédiate et
  irréversible dès l'appel — pas de fenêtre de grâce « votre compte sera
  supprimé dans 30 jours » permettant d'annuler.
- **Données mock en mémoire** (`DB_DRIVER=mock`, Docker absent) : rien n'est
  persisté entre deux redémarrages de l'API. Export et suppression
  fonctionnent réellement, mais sur des données volatiles — la question de la
  rétention réelle ne se posera qu'à la bascule PostgreSQL.
- **Pas de vérification d'email** : un compte peut être créé avec un email
  qui n'appartient pas à son créateur (aucun envoi d'email au Lot 1 —
  `EMAIL_DRIVER=mock`, flux non implémentés). L'export « de ses données »
  repose donc sur la possession du mot de passe, pas sur la preuve de
  possession de l'email.
- **Refresh token non révocable individuellement** : stateless, aucune liste
  de révocation. L'invalidation effective passe par la revérification du
  statut du compte (voir §3) — suffisant pour supprimé/suspendu, mais un
  jeton volé d'un compte *actif* reste valide jusqu'à son expiration.

## 5. TODO production

- [ ] **Purge définitive automatisée** : tâche planifiée de suppression
      physique des comptes `deleted` après un délai de rétention documenté
      (registre des traitements à tenir).
- [ ] **Délai de rétractation** : fenêtre de grâce avant anonymisation
      (compte désactivé mais restaurable), puis suppression effective.
- [ ] **Persistance des refresh tokens** (table dédiée) : révocation serveur
      réelle au logout, rotation, invalidation unitaire en cas de vol.
- [ ] **Vérification d'email et reset de mot de passe** via l'adapter email
      (Brevo) — voir [MOCKED_SERVICES.md](MOCKED_SERVICES.md).
- [ ] **Bascule PostgreSQL** : rejouer la stratégie d'anonymisation en SQL et
      valider les contraintes de clés étrangères réelles.
- [ ] Registre des traitements, politique de confidentialité et mentions
      d'information dans l'app (hors périmètre technique de l'étape 3).

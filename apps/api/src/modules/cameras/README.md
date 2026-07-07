# Module `cameras` - Caméras météo/trafic

**Statut : livré au Lot 1.**

Rôle : servir les caméras météo/trafic actives à la carte publique et fournir
la logique métier réutilisée par le backoffice.

Routes publiques :

- `GET /cameras/:id` : détail d'une caméra active uniquement.

Routes backoffice : voir le module `admin` (`/admin/cameras`).

Règles du Lot 1 :

- `cameraNumber` est attribué automatiquement et préservé ;
- catégories : `weather` ou `traffic` ;
- statuts : `active`, `inactive`, `error`, `hidden` ;
- seules les caméras `active` sont exposées publiquement ;
- les statuts non publics répondent comme une caméra introuvable côté public ;
- la position doit rester dans l'emprise de La Réunion ;
- `cityName` peut être déduit par le géocodage mock si absent ;
- `DELETE /admin/cameras/:id` = masquage doux (`hidden`), jamais suppression dure.

Limites : seul `streamType='image'` est rendu dans le mobile ; `video` et
`iframe` restent documentés mais affichés avec un repli.

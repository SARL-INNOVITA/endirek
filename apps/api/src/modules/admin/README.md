# Module `admin` — Endpoints du backoffice minimal

**Statut : TODO — implémentation prévue à l'étape 6 du Lot 1.**

Rôle : API consommée par le backoffice web (`apps/admin`), réservée aux
comptes administrateurs.

Périmètre Lot 1 (backoffice minimal) :
- gérer les **utilisateurs**, **posts** et **commentaires** (voir les données
  de base, masquer un post) ;
- traiter les **signalements** (via le module `moderation`) ;
- gérer les **caméras météo/trafic** : créer, modifier, supprimer,
  activer/désactiver (numéro auto type `#23`, ville déduite par géocodage
  mocké et ajustable — voir module `cameras`) ;
- gérer les catégories/types de posts si pertinent.

Anticipation : backoffice avancé et analytics (TODO Lot 2+).

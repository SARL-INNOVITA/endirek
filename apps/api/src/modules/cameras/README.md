# Module `cameras` — Caméras météo/trafic

**Statut : TODO — implémentation prévue à l'étape 5 du Lot 1.**

Rôle : gestion des caméras météo et trafic affichées sur la carte,
administrables depuis le backoffice (voir module `admin`).

Modèle d'une caméra (règles du Lot 1) :
- **numéro attribué automatiquement** (ex. `#23`) ;
- nom, type + URL du flux, catégorie **météo ou trafic**, description ;
- emplacement précis (point maps ou coordonnées latitude/longitude) ;
- **ville déduite automatiquement via géocodage** (`GEOCODING_PROVIDER=mock`
  en dev, champ manuel toujours disponible), **ajustable manuellement** ;
- nom de quartier facultatif ;
- statut **actif/inactif** (seules les caméras actives apparaissent sur la carte).

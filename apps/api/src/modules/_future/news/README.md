# Module futur `news` — News IA supervisées

**TODO Lot 2+ — anticipation architecturale uniquement, rien à implémenter au Lot 1.**

Vision Endirek : un onglet News alimenté par des **articles générés par IA
puis supervisés/validés par des humains** avant publication (actualité locale
de La Réunion, synthèses météo/trafic, événements).

Au Lot 1, l'onglet News du mobile est un écran placeholder propre.

Points d'ancrage déjà prévus dans le socle :
- **`url_slug`** pour des articles partageables sur le web ;
- le backoffice (`admin`) accueillera la file de validation éditoriale ;
- l'architecture d'adapters (géocodage, email, push) s'étendra à un adapter
  « fournisseur IA » configuré par variables d'environnement, jamais hardcodé.

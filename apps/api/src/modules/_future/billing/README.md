# Module futur `billing` — Premium et paiements

**TODO Lot 2+ — anticipation architecturale uniquement, rien à implémenter au Lot 1.**

Vision Endirek : abonnement **premium à 1,99 €/mois** (avantages : visibilité,
options avancées), puis offres exceptionnelles payantes pour les pages et
intégration publicitaire (Google Ads réel) — rien de tout cela au Lot 1.

Points d'ancrage déjà prévus dans le socle :
- architecture d'**adapters remplaçables** : le prestataire de paiement sera
  un driver configuré par variables d'environnement (aucune clé hardcodée) ;
- statut premium prévu comme simple attribut du profil (`users`) à activer ;
- l'email transactionnel (`EMAIL_DRIVER`, Brevo) servira aux reçus et rappels ;
- le backoffice (`admin`) accueillera la vue abonnements.

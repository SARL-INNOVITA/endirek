import { Module } from '@nestjs/common';
import { DealplaceController } from './dealplace.controller';
import { DealplaceService } from './dealplace.service';
import { ListingAssembler } from './listing.assembler';
import { UserListingsController } from './user-listings.controller';

/**
 * Module Dealplace (Lot 2 — CP2.1) : taxonomie biens/services + annonces
 * (listings).
 *
 * PREMIÈRE fonctionnalité du Lot 2. Périmètre STRICT du checkpoint :
 * - taxonomie publique (GET /dealplace/taxonomy) ;
 * - annonces publiques et du propriétaire (CRUD + annuaire filtré) ;
 * - listes de profil (/users/me/listings, /users/:id/listings).
 *
 * HORS périmètre (checkpoints ultérieurs) : conversations, deals contractuels,
 * avis/profil Dealplace (CP2.2+), paiement (hors app). Le bouton « Proposer un
 * deal » du mobile est un PLACEHOLDER (deals = CP2.4).
 *
 * ListingAssembler (formes LISTING / LISTING_CARD du contrat) est EXPORTÉ : le
 * module admin l'importe pour assembler la même forme — source unique, comme
 * FeedPostAssembler côté posts. Les repositories (listings + taxonomie) sont
 * fournis globalement par DatabaseModule via les tokens d'injection.
 */
@Module({
  controllers: [DealplaceController, UserListingsController],
  providers: [DealplaceService, ListingAssembler],
  exports: [ListingAssembler, DealplaceService],
})
export class DealplaceModule {}

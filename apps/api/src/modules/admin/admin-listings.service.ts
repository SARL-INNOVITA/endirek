import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingCardView,
  ListingView,
} from '../../common/mappers/listing.mapper';
import { LISTINGS_REPOSITORY } from '../../database/database.tokens';
import { Listing } from '../../database/domain/entities';
import { ListingsRepository } from '../../database/repositories/interfaces';
import { ListingAssembler } from '../dealplace/listing.assembler';
import { AdminListListingsQueryDto } from './dto/admin-list-listings-query.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';

/** LISTING_CARD enrichi du statut (colonne « état » de la liste admin). */
export interface AdminListingCard extends ListingCardView {
  status: Listing['status'];
}

/** Liste backoffice paginée d'annonces. */
export interface PagedAdminListingCards {
  items: AdminListingCard[];
  total: number;
}

/**
 * Service annonces du backoffice (CP2.1) — réservé aux rôles moderator et
 * super_admin (RolesGuard sur le contrôleur).
 *
 * L'admin voit TOUT : tous les statuts ('active', 'hidden', 'deleted' — audit).
 * La forme LISTING_CARD est assemblée par la MÊME source unique que l'annuaire
 * public (ListingAssembler), enrichie du statut. Le détail réutilise la forme
 * LISTING complète.
 *
 * Règles de statut (miroir des posts) :
 * - seuls 'active' et 'hidden' sont posables : la suppression appartient au
 *   propriétaire (DELETE /dealplace/listings/:id) ou au flux RGPD → 400 ;
 * - une annonce 'deleted' n'est jamais restaurée par le backoffice → 409.
 */
@Injectable()
export class AdminListingsService {
  constructor(
    @Inject(LISTINGS_REPOSITORY)
    private readonly listingsRepository: ListingsRepository,
    private readonly assembler: ListingAssembler,
  ) {}

  /** Liste backoffice paginée (GET /admin/dealplace/listings) — tous statuts,
   * filtres status/family/category et recherche titre/description/propriétaire. */
  async listListings(
    query: AdminListListingsQueryDto,
  ): Promise<PagedAdminListingCards> {
    const page = await this.listingsRepository.listAdmin({
      status: query.status,
      family: query.family,
      categorySlug: query.category,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
    const cards = await this.assembler.assembleCards(page.items);
    // Le repository préserve l'ordre : on ré-associe le statut par index.
    const items: AdminListingCard[] = cards.map((card, index) => ({
      ...card,
      status: page.items[index].status,
    }));
    return { items, total: page.total };
  }

  /** Détail backoffice (GET /admin/dealplace/listings/:id) : LISTING complet
   * quel que soit le statut — 404 seulement si l'id n'existe pas. */
  async getListing(id: string): Promise<ListingView> {
    const listing = await this.loadListing(id);
    return this.assembler.assembleOne(listing);
  }

  /**
   * Masque ou republie une annonce (PATCH /admin/dealplace/listings/:id/status).
   * Idempotent. Une annonce masquée disparaît de l'annuaire et du détail public
   * (404 pour tous sauf le propriétaire et les modérateurs) mais RESTE en base.
   */
  async updateStatus(
    id: string,
    dto: UpdateListingStatusDto,
  ): Promise<AdminListingCard> {
    if (dto.status === 'deleted') {
      throw new BadRequestException(
        'La suppression appartient au propriétaire ou au flux RGPD',
      );
    }
    const listing = await this.loadListing(id);
    if (listing.status === 'deleted') {
      throw new ConflictException(
        'Cette annonce a été supprimée : son statut ne peut plus être modifié',
      );
    }
    const updated = await this.listingsRepository.setStatus(id, dto.status);
    const [card] = await this.assembler.assembleCards([updated]);
    return { ...card, status: updated.status };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Charge une annonce par id, TOUT statut confondu — 404 si l'id n'existe pas. */
  private async loadListing(id: string): Promise<Listing> {
    const listing = await this.listingsRepository.findById(id);
    if (!listing) {
      throw new NotFoundException('Annonce introuvable');
    }
    return listing;
  }
}

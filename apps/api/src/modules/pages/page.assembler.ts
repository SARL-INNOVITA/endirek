import { Inject, Injectable } from '@nestjs/common';
import {
  OwnerPageCard,
  PageCardView,
  PageView,
  computeOpenStatus,
  toPageCardView,
  toPageDocumentView,
  toPageHourView,
  toPageView,
} from '../../common/mappers/page.mapper';
import { toPostAuthor } from '../../common/mappers/post.mapper';
import {
  PAGES_REPOSITORY,
  POSTS_REPOSITORY,
  USERS_REPOSITORY,
} from '../../database/database.tokens';
import { Page } from '../../database/domain/entities';
import {
  PagesRepository,
  PostsRepository,
  UsersRepository,
} from '../../database/repositories/interfaces';

/**
 * Assembleur UNIQUE des formes PAGE / PAGE_CARD du contrat d'API (Lot 3) —
 * mutualisé entre le module pages et l'admin : exporté par PagesModule,
 * AdminModule l'importe au lieu de réassembler les formes à la main
 * (pattern miroir de ListingAssembler / FeedPostAssembler).
 *
 * Les données contextuelles d'une LISTE sont chargées PAR LOT (abonnés,
 * horaires par page en un appel chacun) — pas de N+1 par page. Le statut
 * d'ouverture est DÉRIVÉ ici (computeOpenStatus — D70), jamais stocké.
 */
@Injectable()
export class PageAssembler {
  constructor(
    @Inject(PAGES_REPOSITORY)
    private readonly pagesRepository: PagesRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    @Inject(POSTS_REPOSITORY)
    private readonly postsRepository: PostsRepository,
  ) {}

  /** Assemble une LISTE de pages vers la forme PAGE_CARD (ordre préservé). */
  async assembleCards(pages: Page[]): Promise<PageCardView[]> {
    if (pages.length === 0) {
      return [];
    }
    const pageIds = pages.map((page) => page.id);
    const [followerCounts, hoursByPage] = await Promise.all([
      this.pagesRepository.followersCountsByPageIds(pageIds),
      this.pagesRepository.listHoursByPageIds(pageIds),
    ]);
    const now = new Date();
    return pages.map((page) =>
      toPageCardView(page, {
        followersCount: followerCounts[page.id] ?? 0,
        openStatus: computeOpenStatus(page, hoursByPage[page.id] ?? [], now),
      }),
    );
  }

  /** Cartes du PROPRIÉTAIRE : PAGE_CARD + statut (miroir D61). */
  async assembleOwnerCards(pages: Page[]): Promise<OwnerPageCard[]> {
    const cards = await this.assembleCards(pages);
    // Le repository préserve l'ordre : ré-association PAR INDEX (pattern
    // AdminListingsService).
    return cards.map((card, index) => ({
      ...card,
      status: pages[index].status,
    }));
  }

  /** Assemble UNE page vers la forme PAGE complète, contextualisée pour le
   * viewer (isOwner, myFollow). `viewerId` vide = contexte SANS viewer
   * (détail backoffice) : isOwner/myFollow sortent false sans interroger la
   * persistance (une chaîne vide n'est pas un uuid — le driver postgres la
   * refuserait). */
  async assembleOne(page: Page, viewerId: string): Promise<PageView> {
    const [followerCounts, hoursByPage, documentsByPage, owner, postsCount, myFollow] =
      await Promise.all([
        this.pagesRepository.followersCountsByPageIds([page.id]),
        this.pagesRepository.listHoursByPageIds([page.id]),
        this.pagesRepository.listDocumentsByPageIds([page.id]),
        this.usersRepository.findById(page.ownerId),
        this.postsRepository.countByPage(page.id),
        viewerId === ''
          ? Promise.resolve(false)
          : this.pagesRepository.isFollowing(page.id, viewerId),
      ]);
    const hours = hoursByPage[page.id] ?? [];
    return toPageView(page, {
      followersCount: followerCounts[page.id] ?? 0,
      openStatus: computeOpenStatus(page, hours, new Date()),
      hours: hours.map(toPageHourView),
      documents: (documentsByPage[page.id] ?? []).map(toPageDocumentView),
      owner: toPostAuthor(page.ownerId, owner),
      postsCount,
      isOwner: page.ownerId === viewerId,
      myFollow,
    });
  }
}

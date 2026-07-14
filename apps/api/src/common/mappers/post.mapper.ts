import {
  GeoPoint,
  Page,
  PageType,
  Post,
  PostMedia,
  PostMediaType,
  PostStatus,
  User,
} from '../../database/domain/entities';

/**
 * Projections « publication » du contrat d'API étape 4 — mutualisées entre
 * les modules posts, map et (phases suivantes) interactions et admin.
 * Source unique des formes AUTEUR / MEDIA / FEED_POST : aucun module ne
 * reconstruit ces objets à la main.
 *
 * L'assemblage PAR LOT (auteurs, médias, viewerReaction, viewerSaved,
 * reactionsTop d'une page complète) est fait par FeedPostAssembler
 * (modules/posts/feed-post.assembler.ts) au-dessus de ces projections pures.
 */

/** Forme AUTEUR du contrat — les comptes supprimés apparaissent anonymisés
 * (leurs données sont DÉJÀ anonymisées en base par la suppression RGPD). */
export interface PostAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
}

/** Forme MEDIA du contrat. */
export interface FeedPostMedia {
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  mediaType: PostMediaType;
  position: number;
}

/** Un emoji et son nombre de réactions (élément de reactionsTop). */
export interface EmojiCount {
  emoji: string;
  count: number;
}

/** Référence LÉGÈRE de la page émettrice d'un post (Lot 3 — D73) : de quoi
 * afficher l'identité de page dans le feed/la carte et naviguer vers elle.
 * null sur un post d'utilisateur. */
export interface PostPageRef {
  id: string;
  name: string;
  avatarUrl: string | null;
  pageType: PageType;
  verified: boolean;
}

/** Forme FEED_POST du contrat — la projection UNIQUE d'une publication vers
 * l'extérieur (feed, détail, listes de profil, admin...). */
export interface FeedPost {
  id: string;
  typeSlug: string;
  title: string | null;
  body: string;
  city: string | null;
  location: GeoPoint | null;
  mapExpiresAt: Date | null;
  urlSlug: string;
  status: PostStatus;
  createdAt: Date;
  updatedAt: Date;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  author: PostAuthor;
  /** Page émettrice (Lot 3 — D73) — null pour un post d'utilisateur. Quand
   * elle est présente, les clients affichent l'IDENTITÉ DE PAGE (nom, avatar,
   * badge ✓) à la place de l'auteur. */
  page: PostPageRef | null;
  media: FeedPostMedia[];
  /** Emoji de la réaction du viewer sur ce post — null s'il n'a pas réagi. */
  viewerReaction: string | null;
  /** Le viewer a-t-il enregistré ce post dans une de ses collections ? */
  viewerSaved: boolean;
  /** Les 3 premiers emojis par nombre de réactions décroissant. */
  reactionsTop: EmojiCount[];
}

/** Nombre d'emojis retenus dans reactionsTop. */
export const REACTIONS_TOP_COUNT = 3;

/**
 * Projette un utilisateur vers la forme AUTEUR. `user` null (ligne absente —
 * ne doit pas arriver : même supprimé, un compte reste en base anonymisé) →
 * repli défensif « Utilisateur supprimé » pour ne jamais casser un feed.
 */
export function toPostAuthor(userId: string, user: User | null): PostAuthor {
  if (!user) {
    return {
      id: userId,
      displayName: 'Utilisateur supprimé',
      avatarUrl: null,
      city: null,
    };
  }
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    city: user.city,
  };
}

/**
 * Projette une page vers la forme PAGE émettrice d'un post. `page` null
 * (ligne absente — une page soft-supprimée reste en base) → repli défensif
 * « Page supprimée » pour ne jamais casser un feed (miroir de toPostAuthor).
 */
export function toPostPageRef(pageId: string, page: Page | null): PostPageRef {
  if (!page) {
    return {
      id: pageId,
      name: 'Page supprimée',
      avatarUrl: null,
      pageType: 'business',
      verified: false,
    };
  }
  return {
    id: page.id,
    name: page.name,
    avatarUrl: page.avatarUrl,
    pageType: page.pageType,
    verified: page.verified,
  };
}

/** Projette une entité PostMedia vers la forme MEDIA du contrat. */
export function toFeedPostMedia(media: PostMedia): FeedPostMedia {
  return {
    url: media.url,
    thumbnailUrl: media.thumbnailUrl,
    width: media.width,
    height: media.height,
    mediaType: media.mediaType,
    position: media.position,
  };
}

/**
 * Agrégat { emoji → nombre } → les 3 premiers par count décroissant.
 * Tie-break alphabétique sur l'emoji : ordre STABLE entre deux appels.
 */
export function toReactionsTop(counts: Record<string, number>): EmojiCount[] {
  return Object.entries(counts)
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
    .slice(0, REACTIONS_TOP_COUNT);
}

/** Données contextuelles d'un FEED_POST (calculées par lot par l'assembler). */
export interface FeedPostContext {
  author: PostAuthor;
  /** Page émettrice (Lot 3 — D73) — null pour un post d'utilisateur. */
  page: PostPageRef | null;
  media: FeedPostMedia[];
  viewerReaction: string | null;
  viewerSaved: boolean;
  reactionsTop: EmojiCount[];
}

/** Projette une entité Post + son contexte vers la forme FEED_POST. */
export function toFeedPost(post: Post, context: FeedPostContext): FeedPost {
  return {
    id: post.id,
    typeSlug: post.typeSlug,
    title: post.title,
    body: post.body,
    city: post.city,
    location: post.location,
    mapExpiresAt: post.mapExpiresAt,
    urlSlug: post.urlSlug,
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    reactionCount: post.reactionCount,
    commentCount: post.commentCount,
    shareCount: post.shareCount,
    saveCount: post.saveCount,
    author: context.author,
    page: context.page,
    media: context.media,
    viewerReaction: context.viewerReaction,
    viewerSaved: context.viewerSaved,
    reactionsTop: context.reactionsTop,
  };
}

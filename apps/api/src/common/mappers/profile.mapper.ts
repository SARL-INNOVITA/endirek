import { User, UserRole, UserStatus } from '../../database/domain/entities';

/**
 * Projections « profil » du contrat d'API étape 3 — mutualisées entre les
 * modules auth, users et admin (source unique, aucun copier-coller).
 *
 * Deux formes, et seulement deux :
 * - PROFIL COMPLET : renvoyé à l'utilisateur LUI-MÊME (auth/me, profil propre)
 *   et aux administrateurs — ne JAMAIS le renvoyer à un tiers ;
 * - PROFIL PUBLIC  : renvoyé pour AUTRUI — ne contient JAMAIS email,
 *   settings, role ni status (données privées).
 *
 * `postsCount` n'est pas porté par l'entité User : il est calculé via
 * PostsRepository.countByAuthor et fourni aux mappers par le service.
 */

/** PROFIL COMPLET — soi-même / admin uniquement. */
export interface FullProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string;
  city: string | null;
  role: UserRole;
  status: UserStatus;
  settings: Record<string, unknown>;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: Date;
}

/** PROFIL PUBLIC — forme renvoyée pour un TIERS (jamais email/settings/role/status). */
export interface PublicProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string;
  city: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: Date;
}

/** Projette une entité User vers le PROFIL COMPLET du contrat d'API. */
export function toFullProfile(user: User, postsCount: number): FullProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio: user.bio,
    city: user.city,
    role: user.role,
    status: user.status,
    settings: user.settings,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    postsCount,
    createdAt: user.createdAt,
  };
}

/** Projette une entité User vers le PROFIL PUBLIC du contrat d'API. */
export function toPublicProfile(user: User, postsCount: number): PublicProfile {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio: user.bio,
    city: user.city,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    postsCount,
    createdAt: user.createdAt,
  };
}

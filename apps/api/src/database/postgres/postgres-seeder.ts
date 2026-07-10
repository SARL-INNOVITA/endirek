/**
 * PostgresSeeder — insertion du seed La Réunion dans PostgreSQL.
 *
 * Miroir SQL de MockDatabaseService.loadSeed() : consomme la MÊME source
 * (buildSeed(), src/database/seed/) et insère les 14 collections d'entités
 * (users, follows, posts, post_media, comments, reactions, saved_collections,
 * saved_posts, cameras, reports, notifications, + Dealplace : listings,
 * listing_media, listing_tag_map).
 *
 * TAXONOMIE Dealplace (listing_categories / listing_subcategories /
 * listing_tags) : NON insérée ici — c'est de la donnée de RÉFÉRENCE, déjà en
 * base via la migration 0004_dealplace_reference.sql (comme post_types /
 * reaction_types via 0002). Le seeder ne pose que les ANNONCES du seed, dont les
 * FK category_slug / subcategory_slug / tag_slug pointent vers cette référence.
 *
 * GARANTIES :
 *  - ATOMIQUE : tout passe dans UNE transaction (withTransaction) — soit tout
 *    est inséré, soit rien (ROLLBACK).
 *  - IDEMPOTENT : chaque INSERT est en `ON CONFLICT DO NOTHING` sur la clé
 *    primaire (ou la PK composite). Relancer le seeder sur une base déjà seedée
 *    ne duplique rien et ne lève pas d'erreur. En pratique le service n'appelle
 *    le seeder QUE si la table users est vide (voir PostgresDatabaseService),
 *    mais l'idempotence protège les cas de concurrence/relance.
 *  - DÉTERMINISTE : on insère EXPLICITEMENT les id / created_at / updated_at du
 *    seed (jamais les DEFAULT de la base) — les ids seedUuid restent stables,
 *    identiques au driver mock.
 *
 * NON insérées ici : post_types / reaction_types (déjà en base via la migration
 * 0002_reference_data.sql). Les compteurs dénormalisés ne sont PAS écrits : ils
 * sont calculés à la lecture par les repositories (les colonnes compteur de la
 * base restent à leur DEFAULT 0, non lues).
 *
 * camera_number est GENERATED ALWAYS AS IDENTITY : on force les numéros 1..12
 * du seed via `OVERRIDING SYSTEM VALUE`, puis on repositionne la séquence
 * (setval) pour que les créations runtime continuent sans collision — miroir de
 * MockDatabaseService.syncCameraSequence().
 */

import { Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { Pool } from 'pg';
import { buildSeed, SeedData } from '../seed';
import { geoPointToSql, withTransaction } from './pg-helpers';

export class PostgresSeeder {
  private readonly logger = new Logger('PostgresSeeder');

  constructor(private readonly pool: Pool) {}

  /**
   * Insère l'intégralité du seed dans une transaction. Retourne le nombre de
   * lignes réellement insérées par table (0 sur une base déjà seedée grâce à
   * ON CONFLICT DO NOTHING). Journalise le récapitulatif.
   */
  async seed(): Promise<Record<string, number>> {
    const data = buildSeed();
    const counts = await withTransaction(this.pool, async (client) => {
      // ORDRE des insertions = ordre des dépendances FK :
      // users → follows → posts → post_media → comments → reactions →
      // saved_collections → saved_posts → cameras → reports → notifications.
      const c: Record<string, number> = {};
      c.users = await this.insertUsers(client, data);
      c.follows = await this.insertFollows(client, data);
      c.posts = await this.insertPosts(client, data);
      c.post_media = await this.insertPostMedia(client, data);
      c.comments = await this.insertComments(client, data);
      c.reactions = await this.insertReactions(client, data);
      c.saved_collections = await this.insertSavedCollections(client, data);
      c.saved_posts = await this.insertSavedPosts(client, data);
      c.cameras = await this.insertCameras(client, data);
      c.reports = await this.insertReports(client, data);
      c.notifications = await this.insertNotifications(client, data);
      // Dealplace (CP2.1) : annonces, médias, associations tags. Insérés APRÈS
      // les users (FK owner_id) ; les FK category_slug / subcategory_slug /
      // tag_slug pointent vers la référence de la migration 0004.
      c.listings = await this.insertListings(client, data);
      c.listing_media = await this.insertListingMedia(client, data);
      c.listing_tag_map = await this.insertListingTagMap(client, data);
      // Repositionne la séquence camera_number après le plus grand numéro seedé
      // (miroir de MockDatabaseService.syncCameraSequence()). Idempotent.
      await this.resyncCameraSequence(client);
      return c;
    });

    this.logger.log(
      `Seed inséré : ${counts.users} users, ${counts.follows} follows, ` +
        `${counts.posts} posts, ${counts.post_media} médias, ` +
        `${counts.comments} commentaires, ${counts.reactions} réactions, ` +
        `${counts.saved_collections} collections, ${counts.saved_posts} sauvegardes, ` +
        `${counts.cameras} caméras, ${counts.reports} signalements, ` +
        `${counts.notifications} notifications, ` +
        `${counts.listings} annonces, ${counts.listing_media} médias annonce, ` +
        `${counts.listing_tag_map} tags annonce.`,
    );
    return counts;
  }

  // ── Helpers d'insertion ────────────────────────────────────────────────────

  /** Convertit un GeoPoint (ou null) en fragment SQL + ajoute lng,lat aux params.
   * Retourne le fragment à interpoler dans le VALUES ; pousse d'abord lng PUIS
   * lat dans `params` (ordre ST_MakePoint(lng, lat)). Pour une location nulle,
   * renvoie 'NULL' sans toucher aux params. */
  private geoValue(
    location: { lat: number; lng: number } | null,
    params: unknown[],
  ): string {
    if (location === null) {
      return 'NULL';
    }
    params.push(location.lng, location.lat);
    const lngPlaceholder = `$${params.length - 1}`;
    const latPlaceholder = `$${params.length}`;
    return geoPointToSql(lngPlaceholder, latPlaceholder);
  }

  private async insertUsers(client: PoolClient, data: SeedData): Promise<number> {
    let inserted = 0;
    for (const u of data.users) {
      const params: unknown[] = [
        u.id,
        u.email,
        u.passwordHash,
        u.displayName,
        u.avatarUrl,
        u.coverUrl,
        u.bio,
        u.city,
      ];
      const geo = this.geoValue(u.location, params);
      params.push(
        JSON.stringify(u.settings),
        u.role,
        u.status,
        u.createdAt,
        u.updatedAt,
        u.deletedAt,
      );
      // Placeholders : $1..$8, géométrie, puis settings..deletedAt.
      const res = await client.query(
        `INSERT INTO users
           (id, email, password_hash, display_name, avatar_url, cover_url,
            bio, city, location, settings, role, status,
            created_at, updated_at, deleted_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, ${geo},
            $${params.length - 5}::jsonb, $${params.length - 4}, $${params.length - 3},
            $${params.length - 2}, $${params.length - 1}, $${params.length})
         ON CONFLICT (id) DO NOTHING`,
        params,
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertFollows(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const f of data.follows) {
      const res = await client.query(
        `INSERT INTO follows (follower_id, followed_id, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (follower_id, followed_id) DO NOTHING`,
        [f.followerId, f.followedId, f.createdAt],
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertPosts(client: PoolClient, data: SeedData): Promise<number> {
    let inserted = 0;
    for (const p of data.posts) {
      const params: unknown[] = [
        p.id,
        p.authorId,
        p.pageId,
        p.typeSlug,
        p.title,
        p.body,
      ];
      const geo = this.geoValue(p.location, params);
      params.push(
        p.city,
        p.visibility,
        p.status,
        p.urlSlug,
        p.mapExpiresAt,
        p.createdAt,
        p.updatedAt,
      );
      const res = await client.query(
        `INSERT INTO posts
           (id, author_id, page_id, type_slug, title, body, location,
            city, visibility, status, url_slug, map_expires_at,
            created_at, updated_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, ${geo},
            $${params.length - 6}, $${params.length - 5}, $${params.length - 4},
            $${params.length - 3}, $${params.length - 2}, $${params.length - 1},
            $${params.length})
         ON CONFLICT (id) DO NOTHING`,
        params,
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertPostMedia(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const m of data.postMedia) {
      const res = await client.query(
        `INSERT INTO post_media
           (id, post_id, media_type, url, thumbnail_url, width, height,
            position, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          m.id,
          m.postId,
          m.mediaType,
          m.url,
          m.thumbnailUrl,
          m.width,
          m.height,
          m.position,
          m.createdAt,
        ],
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertComments(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const c of data.comments) {
      const res = await client.query(
        `INSERT INTO comments
           (id, post_id, author_id, parent_comment_id, depth, body, status,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          c.id,
          c.postId,
          c.authorId,
          c.parentCommentId,
          c.depth,
          c.body,
          c.status,
          c.createdAt,
          c.updatedAt,
        ],
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertReactions(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const r of data.reactions) {
      const res = await client.query(
        `INSERT INTO reactions
           (id, user_id, target_type, target_id, emoji, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [r.id, r.userId, r.targetType, r.targetId, r.emoji, r.createdAt],
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertSavedCollections(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const s of data.savedCollections) {
      const res = await client.query(
        `INSERT INTO saved_collections (id, owner_id, name, is_default, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.ownerId, s.name, s.isDefault, s.createdAt],
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertSavedPosts(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const s of data.savedPosts) {
      const res = await client.query(
        `INSERT INTO saved_posts (collection_id, post_id, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (collection_id, post_id) DO NOTHING`,
        [s.collectionId, s.postId, s.createdAt],
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertCameras(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const cam of data.cameras) {
      // camera_number est GENERATED ALWAYS AS IDENTITY : OVERRIDING SYSTEM VALUE
      // impose le numéro seedé (1..12) au lieu de laisser la séquence décider.
      const params: unknown[] = [
        cam.id,
        cam.cameraNumber,
        cam.name,
        cam.streamType,
        cam.url,
        cam.category,
        cam.description,
      ];
      const geo = this.geoValue(cam.location, params);
      params.push(
        cam.cityName,
        cam.districtName,
        cam.status,
        cam.createdAt,
        cam.updatedAt,
      );
      const res = await client.query(
        `INSERT INTO cameras
           (id, camera_number, name, stream_type, url, category, description,
            location, city_name, district_name, status, created_at, updated_at)
         OVERRIDING SYSTEM VALUE
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, ${geo},
            $${params.length - 4}, $${params.length - 3}, $${params.length - 2},
            $${params.length - 1}, $${params.length})
         ON CONFLICT (id) DO NOTHING`,
        params,
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertReports(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const r of data.reports) {
      const res = await client.query(
        `INSERT INTO reports
           (id, reporter_id, target_type, target_id, reason_code, message,
            status, handled_by, handled_at, resolution_note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.reporterId,
          r.targetType,
          r.targetId,
          r.reasonCode,
          r.message,
          r.status,
          r.handledBy,
          r.handledAt,
          r.resolutionNote,
          r.createdAt,
        ],
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertNotifications(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const n of data.notifications) {
      const res = await client.query(
        `INSERT INTO notifications (id, user_id, type, payload, read_at, created_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          n.id,
          n.userId,
          n.type,
          JSON.stringify(n.payload),
          n.readAt,
          n.createdAt,
        ],
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertListings(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const l of data.listings) {
      // $1..$11 fixes, puis géométrie conditionnelle, puis
      // external_links / exchange_prefs / url_slug / status / timestamps.
      const params: unknown[] = [
        l.id,
        l.ownerId,
        l.listingType,
        l.title,
        l.description,
        l.categorySlug,
        l.subcategorySlug,
        l.valueKind,
        l.valueMin,
        l.valueMax,
        l.currency,
      ];
      const geo = this.geoValue(l.location, params);
      // exchange_prefs : text[] passé tel quel (node-postgres sérialise le
      // tableau JS en littéral tableau PostgreSQL). external_links : jsonb.
      params.push(
        l.city,
        JSON.stringify(l.externalLinks),
        l.exchangePrefs,
        l.urlSlug,
        l.status,
        l.createdAt,
        l.updatedAt,
        l.deletedAt,
      );
      const res = await client.query(
        `INSERT INTO listings
           (id, owner_id, listing_type, title, description,
            category_slug, subcategory_slug,
            value_kind, value_min, value_max, currency,
            location, city, external_links, exchange_prefs, url_slug,
            status, created_at, updated_at, deleted_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            ${geo},
            $${params.length - 7}, $${params.length - 6}::jsonb,
            $${params.length - 5}, $${params.length - 4}, $${params.length - 3},
            $${params.length - 2}, $${params.length - 1}, $${params.length})
         ON CONFLICT (id) DO NOTHING`,
        params,
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertListingMedia(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const m of data.listingMedia) {
      const res = await client.query(
        `INSERT INTO listing_media
           (id, listing_id, media_type, url, thumbnail_url, width, height,
            position, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          m.id,
          m.listingId,
          m.mediaType,
          m.url,
          m.thumbnailUrl,
          m.width,
          m.height,
          m.position,
          m.createdAt,
        ],
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  private async insertListingTagMap(
    client: PoolClient,
    data: SeedData,
  ): Promise<number> {
    let inserted = 0;
    for (const t of data.listingTagMap) {
      const res = await client.query(
        `INSERT INTO listing_tag_map (listing_id, tag_slug)
         VALUES ($1, $2)
         ON CONFLICT (listing_id, tag_slug) DO NOTHING`,
        [t.listingId, t.tagSlug],
      );
      inserted += res.rowCount ?? 0;
    }
    return inserted;
  }

  /** Repositionne la séquence de camera_number après le max présent en base
   * (miroir de MockDatabaseService.syncCameraSequence()). Sans caméra, laisse
   * la séquence à 1 (setval ... , 1, false). */
  private async resyncCameraSequence(client: PoolClient): Promise<void> {
    await client.query(
      `SELECT setval(
         pg_get_serial_sequence('cameras', 'camera_number'),
         GREATEST((SELECT COALESCE(MAX(camera_number), 0) FROM cameras), 1),
         (SELECT COUNT(*) > 0 FROM cameras)
       )`,
    );
  }
}

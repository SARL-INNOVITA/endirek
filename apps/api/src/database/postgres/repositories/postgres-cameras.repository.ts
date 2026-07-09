/**
 * PostgresCamerasRepository — implémentation SQL de CamerasRepository.
 *
 * Parité stricte avec MockCamerasRepository (mock/mock-repositories.ts) :
 * - list : filtres category/status optionnels, tri cameraNumber croissant ;
 * - listInBbox : ST_MakeEnvelope(minLng,minLat,maxLng,maxLat,4326) && location,
 *   tri cameraNumber croissant, SANS filtre de statut (le filtrage public
 *   'active' est appliqué au niveau service) ;
 * - create : cameraNumber AUTO (colonne GENERATED ALWAYS AS IDENTITY — INSERT
 *   sans camera_number, valeur récupérée par RETURNING) ; location NOT NULL
 *   écrite via ST_SetSRID(ST_MakePoint(lng, lat), 4326) ;
 * - update : sémantique applyPatch (les clés absentes/undefined ne touchent pas
 *   la colonne), location possible ;
 * - listAdmin : PagedResult tous statuts, filtres category/status, recherche
 *   ILIKE sur name/cityName/description, tri cameraNumber croissant.
 */

import { Inject, Injectable } from '@nestjs/common';
import { BoundingBox, Camera, CameraStatus } from '../../domain/entities';
import { Pool } from 'pg';
import { POSTGRES_POOL } from '../../database.tokens';
import {
  AdminListCamerasParams,
  CamerasRepository,
  CreateCameraInput,
  ListCamerasParams,
  PagedResult,
  UpdateCameraPatch,
} from '../../repositories/interfaces';
import { query, rowToCamera, SQL_CAMERA_COLUMNS } from '../pg-helpers';

@Injectable()
export class PostgresCamerasRepository implements CamerasRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  /**
   * Liste des caméras, filtres category/status optionnels, triée par
   * cameraNumber croissant (ordre d'affichage « #1, #2, ... »).
   */
  async list(params?: ListCamerasParams): Promise<Camera[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (params?.category !== undefined) {
      values.push(params.category);
      conditions.push(`c.category = $${values.length}`);
    }
    if (params?.status !== undefined) {
      values.push(params.status);
      conditions.push(`c.status = $${values.length}`);
    }
    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      this.pool,
      `SELECT ${SQL_CAMERA_COLUMNS}
         FROM cameras c
         ${where}
        ORDER BY c.camera_number ASC`,
      values,
    );
    return result.rows.map(rowToCamera);
  }

  /**
   * Caméras dont la position intersecte la boîte englobante — équivalent PostGIS
   * de l'inclusion du mock (isInBbox). AUCUN filtre de statut ici : le service
   * applique le filtrage public 'active'. Tri cameraNumber croissant.
   * Ordre des bornes de ST_MakeEnvelope : (minLng, minLat, maxLng, maxLat).
   */
  async listInBbox(bbox: BoundingBox): Promise<Camera[]> {
    const result = await query(
      this.pool,
      `SELECT ${SQL_CAMERA_COLUMNS}
         FROM cameras c
        WHERE ST_MakeEnvelope($1, $2, $3, $4, 4326) && c.location
        ORDER BY c.camera_number ASC`,
      [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat],
    );
    return result.rows.map(rowToCamera);
  }

  async findById(id: string): Promise<Camera | null> {
    const result = await query(
      this.pool,
      `SELECT ${SQL_CAMERA_COLUMNS} FROM cameras c WHERE c.id = $1`,
      [id],
    );
    return result.rowCount && result.rowCount > 0
      ? rowToCamera(result.rows[0])
      : null;
  }

  /**
   * Crée une caméra. camera_number est GENERATED ALWAYS AS IDENTITY : on
   * n'insère PAS la colonne, la base l'attribue et on la récupère par RETURNING.
   * location est NOT NULL, écrite via ST_SetSRID(ST_MakePoint(lng, lat), 4326).
   * Défauts alignés sur le mock : description '' si absente, districtName null,
   * status 'active' si absent.
   */
  async create(input: CreateCameraInput): Promise<Camera> {
    const result = await query(
      this.pool,
      `INSERT INTO cameras
         (name, stream_type, url, category, description,
          location, city_name, district_name, status)
       VALUES
         ($1, $2, $3, $4, $5,
          ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9, $10)
       RETURNING ${SQL_CAMERA_COLUMNS}`,
      [
        input.name,
        input.streamType,
        input.url,
        input.category,
        input.description ?? '',
        input.location.lng,
        input.location.lat,
        input.cityName,
        input.districtName ?? null,
        input.status ?? 'active',
      ],
    );
    return rowToCamera(result.rows[0]);
  }

  /**
   * Applique un patch partiel. Sémantique applyPatch du mock : seules les clés
   * PRÉSENTES et non `undefined` modifient une colonne (`null` reste une valeur
   * légitime pour les colonnes nullables comme district_name). `location` est
   * réécrite via ST_SetSRID. Le trigger cameras_set_updated_at gère updated_at.
   */
  async update(id: string, patch: UpdateCameraPatch): Promise<Camera> {
    const sets: string[] = [];
    const values: unknown[] = [];

    /** Ajoute « colonne = $n » et empile la valeur. */
    const assign = (column: string, value: unknown): void => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (patch.name !== undefined) {
      assign('name', patch.name);
    }
    if (patch.streamType !== undefined) {
      assign('stream_type', patch.streamType);
    }
    if (patch.url !== undefined) {
      assign('url', patch.url);
    }
    if (patch.category !== undefined) {
      assign('category', patch.category);
    }
    if (patch.description !== undefined) {
      assign('description', patch.description);
    }
    if (patch.cityName !== undefined) {
      assign('city_name', patch.cityName);
    }
    if (patch.districtName !== undefined) {
      assign('district_name', patch.districtName);
    }
    if (patch.status !== undefined) {
      assign('status', patch.status);
    }
    if (patch.location !== undefined) {
      // location est NOT NULL : le patch UpdateCameraPatch ne peut porter qu'un
      // GeoPoint valide (deux placeholders lng/lat via ST_SetSRID).
      values.push(patch.location.lng);
      const lngIndex = values.length;
      values.push(patch.location.lat);
      const latIndex = values.length;
      sets.push(
        `location = ST_SetSRID(ST_MakePoint($${lngIndex}, $${latIndex}), 4326)`,
      );
    }

    // Aucune clé à modifier : on relit simplement la caméra (et on lève la même
    // erreur « introuvable » que le mock si elle n'existe pas).
    if (sets.length === 0) {
      const existing = await this.findById(id);
      if (existing === null) {
        throw new Error(`Caméra introuvable : ${id}.`);
      }
      return existing;
    }

    values.push(id);
    const idIndex = values.length;
    const result = await query(
      this.pool,
      `UPDATE cameras c
          SET ${sets.join(', ')}
        WHERE c.id = $${idIndex}
      RETURNING ${SQL_CAMERA_COLUMNS}`,
      values,
    );
    if (result.rowCount === 0) {
      throw new Error(`Caméra introuvable : ${id}.`);
    }
    return rowToCamera(result.rows[0]);
  }

  /** Change le statut d'une caméra (activation/désactivation, masquage doux). */
  async setStatus(id: string, status: CameraStatus): Promise<Camera> {
    const result = await query(
      this.pool,
      `UPDATE cameras c
          SET status = $1
        WHERE c.id = $2
      RETURNING ${SQL_CAMERA_COLUMNS}`,
      [status, id],
    );
    if (result.rowCount === 0) {
      throw new Error(`Caméra introuvable : ${id}.`);
    }
    return rowToCamera(result.rows[0]);
  }

  /**
   * Liste BACKOFFICE paginée : tous statuts par défaut, filtres category/status
   * et recherche ILIKE sur name/cityName/description (insensible à la casse),
   * triée par cameraNumber croissant. Le trim de la recherche reproduit le mock
   * (une recherche vide/espaces est ignorée).
   */
  async listAdmin(
    params: AdminListCamerasParams,
  ): Promise<PagedResult<Camera>> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.category !== undefined) {
      values.push(params.category);
      conditions.push(`c.category = $${values.length}`);
    }
    if (params.status !== undefined) {
      values.push(params.status);
      conditions.push(`c.status = $${values.length}`);
    }
    if (params.search !== undefined && params.search.trim() !== '') {
      // ILIKE %needle% — insensible à la casse, comme le includes() du mock sur
      // les chaînes déjà mises en minuscules.
      values.push(`%${params.search.trim()}%`);
      const n = values.length;
      conditions.push(
        `(c.name ILIKE $${n} OR c.city_name ILIKE $${n} OR c.description ILIKE $${n})`,
      );
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalResult = await query(
      this.pool,
      `SELECT count(*) AS total FROM cameras c ${where}`,
      values,
    );
    const total = Number(totalResult.rows[0]?.total ?? 0);

    values.push(params.limit);
    const limitIndex = values.length;
    values.push(params.offset);
    const offsetIndex = values.length;
    const result = await query(
      this.pool,
      `SELECT ${SQL_CAMERA_COLUMNS}
         FROM cameras c
         ${where}
        ORDER BY c.camera_number ASC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    );
    return { items: result.rows.map(rowToCamera), total };
  }
}

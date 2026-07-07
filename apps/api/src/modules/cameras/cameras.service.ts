import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GEOCODING_ADAPTER,
  GeocodingAdapter,
} from '../../adapters/geocoding/geocoding.adapter';
import { isWithinReunion } from '../../common/geo/reunion';
import { CAMERAS_REPOSITORY } from '../../database/database.tokens';
import {
  BoundingBox,
  Camera,
  CameraCategory,
  CameraStatus,
  GeoPoint,
} from '../../database/domain/entities';
import {
  CamerasRepository,
  PageParams,
} from '../../database/repositories/interfaces';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';

/** Forme CAMERA_PUBLIC du contrat — SANS status ni updatedAt ; servie
 * uniquement pour des caméras 'active'. */
export interface CameraPublicView {
  id: string;
  cameraNumber: number;
  name: string;
  streamType: Camera['streamType'];
  url: string;
  category: CameraCategory;
  description: string;
  location: GeoPoint;
  cityName: string;
  districtName: string | null;
  createdAt: Date;
}

/** Forme CAMERA_ADMIN du contrat — CAMERA_PUBLIC + { status, updatedAt }. */
export interface CameraAdminView extends CameraPublicView {
  status: CameraStatus;
  updatedAt: Date;
}

/** Liste backoffice paginée de caméras ({ items, total }). */
export interface PagedAdminCameras {
  items: CameraAdminView[];
  total: number;
}

/** Filtres publics de la carte (catégories + bbox — toutes deux optionnelles). */
export interface PublicCamerasQuery {
  categories?: CameraCategory[];
  bbox?: BoundingBox;
}

/** Filtres backoffice de la liste des caméras. */
export interface AdminCamerasQuery {
  category?: CameraCategory;
  status?: CameraStatus;
  search?: string;
  page: PageParams;
}

/** Message d'erreur unique pour une caméra introuvable OU non 'active' vue par
 * un non-admin (ne pas divulguer l'existence d'une caméra masquée). */
const CAMERA_NOT_FOUND = 'Caméra introuvable';

/** Message d'erreur de la garde géographique (création/mise à jour). */
const CAMERA_OUT_OF_REUNION = 'La caméra doit être située à La Réunion';

/**
 * Service caméras (Lot 1 étape 5) — source UNIQUE de la logique caméra,
 * partagée entre l'API publique (carte) et le backoffice admin.
 *
 * Sécurité :
 * - le PUBLIC ne voit JAMAIS une caméra non 'active' (getPublicById → 404,
 *   listPublic filtre 'active') ni les champs status/updatedAt (CAMERA_PUBLIC) ;
 * - le backoffice voit tout (CAMERA_ADMIN, tous statuts).
 *
 * Règles métier :
 * - la position doit se situer à La Réunion (isWithinReunion, 400 sinon) ;
 * - cityName est déduite par géocodage (adapter mock au Lot 1) si absente/vide ;
 * - cameraNumber est auto-attribué par le repository ;
 * - DELETE = masquage doux (status 'hidden') — pas de suppression dure, le
 *   cameraNumber est préservé.
 */
@Injectable()
export class CamerasService {
  constructor(
    @Inject(CAMERAS_REPOSITORY)
    private readonly camerasRepository: CamerasRepository,
    @Inject(GEOCODING_ADAPTER)
    private readonly geocoding: GeocodingAdapter,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Lecture publique (carte)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Détail public d'une caméra (GET /cameras/:id) — 404 si inexistante OU non
   * 'active' (même message : ne pas divulguer l'existence d'une caméra
   * masquée/inactive/en erreur).
   */
  async getPublicById(id: string): Promise<CameraPublicView> {
    const camera = await this.camerasRepository.findById(id);
    if (!camera || camera.status !== 'active') {
      throw new NotFoundException(CAMERA_NOT_FOUND);
    }
    return this.toPublicView(camera);
  }

  /**
   * Caméras publiques de la carte (active uniquement), filtrées par catégories
   * et bbox si fournies. Utilisé par GET /map/cameras et GET /map/overview.
   */
  async listPublic(query: PublicCamerasQuery): Promise<CameraPublicView[]> {
    const cameras = await this.loadActiveCameras(query.categories, query.bbox);
    return cameras.map((camera) => this.toPublicView(camera));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lecture backoffice
  // ──────────────────────────────────────────────────────────────────────────

  /** Liste backoffice paginée, tous statuts (GET /admin/cameras). */
  async listAdmin(query: AdminCamerasQuery): Promise<PagedAdminCameras> {
    const page = await this.camerasRepository.listAdmin({
      category: query.category,
      status: query.status,
      search: query.search,
      limit: query.page.limit,
      offset: query.page.offset,
    });
    return {
      items: page.items.map((camera) => this.toAdminView(camera)),
      total: page.total,
    };
  }

  /** Détail backoffice (GET /admin/cameras/:id) — 404 si inexistante (tous
   * statuts sont visibles pour un admin). */
  async getAdminById(id: string): Promise<CameraAdminView> {
    const camera = await this.loadOrThrow(id);
    return this.toAdminView(camera);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mutations backoffice
  // ──────────────────────────────────────────────────────────────────────────

  /** Crée une caméra (POST /admin/cameras) — garde La Réunion + géocodage de
   * cityName si absente + cameraNumber auto (repository). */
  async create(dto: CreateCameraDto): Promise<CameraAdminView> {
    const location: GeoPoint = { lat: dto.location.lat, lng: dto.location.lng };
    this.assertWithinReunion(location);

    const cityName = await this.resolveCityName(dto.cityName, location);

    const camera = await this.camerasRepository.create({
      name: dto.name,
      streamType: dto.streamType,
      url: dto.url,
      category: dto.category,
      description: dto.description,
      location,
      cityName,
      districtName: dto.districtName ?? null,
      status: dto.status,
    });
    return this.toAdminView(camera);
  }

  /**
   * Modifie une caméra (PATCH /admin/cameras/:id) — champs partiels. Si
   * location est fournie, elle est re-validée « à La Réunion » ; sur simple
   * déplacement (location seule), cityName n'est PAS re-géocodée
   * automatiquement — décision documentée.
   *
   * Normalisation des chaînes optionnelles, alignée sur le chemin create :
   * - cityName (NOT NULL) : vidée explicitement (chaîne vide/blanche) ⇒
   *   RE-DÉDUITE par géocodage depuis la location (nouvelle si fournie, sinon
   *   courante), exactement comme à la création (jamais écrasée par du vide) ;
   *   fournie non vide ⇒ valeur trimée ; absente (undefined) ⇒ inchangée.
   * - districtName (nullable) : vidé (chaîne vide/blanche) ⇒ null (cohérent
   *   avec create) ; fourni non vide ⇒ valeur trimée ; absent ⇒ inchangé.
   */
  async update(id: string, dto: UpdateCameraDto): Promise<CameraAdminView> {
    const current = await this.loadOrThrow(id);

    const location =
      dto.location !== undefined
        ? { lat: dto.location.lat, lng: dto.location.lng }
        : undefined;
    if (location !== undefined) {
      this.assertWithinReunion(location);
    }

    // cityName (NOT NULL) : si l'admin envoie une chaîne vide/blanche, on
    // considère qu'il veut la re-déduire (et non écraser par du vide) ⇒ même
    // géocodage qu'à la création, depuis la location cible (nouvelle si
    // fournie, sinon courante). Fournie non vide ⇒ trimée. Absente ⇒ inchangée.
    let cityName: string | undefined;
    if (dto.cityName === undefined) {
      cityName = undefined;
    } else if (dto.cityName.trim()) {
      cityName = dto.cityName.trim();
    } else {
      cityName = await this.resolveCityName(undefined, location ?? current.location);
    }

    // districtName (nullable) : chaîne vide/blanche ⇒ null (re-mise à NULL de
    // la colonne, cohérent avec create) ; non vide ⇒ trimé ; absent ⇒ inchangé.
    const districtName =
      dto.districtName === undefined
        ? undefined
        : dto.districtName.trim()
          ? dto.districtName.trim()
          : null;

    const updated = await this.camerasRepository.update(id, {
      name: dto.name,
      streamType: dto.streamType,
      url: dto.url,
      category: dto.category,
      description: dto.description,
      location,
      cityName,
      districtName,
    });
    return this.toAdminView(updated);
  }

  /** Change le statut d'une caméra (PATCH /admin/cameras/:id/status). */
  async setStatus(id: string, status: CameraStatus): Promise<CameraAdminView> {
    await this.loadOrThrow(id);
    const updated = await this.camerasRepository.setStatus(id, status);
    return this.toAdminView(updated);
  }

  /**
   * Suppression douce (DELETE /admin/cameras/:id) : passe status='hidden'.
   * Aucune suppression dure — le cameraNumber est préservé (traçabilité,
   * numérotation stable). Idempotent si déjà masquée.
   */
  async softDelete(id: string): Promise<void> {
    await this.loadOrThrow(id);
    await this.camerasRepository.setStatus(id, 'hidden');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aides privées
  // ──────────────────────────────────────────────────────────────────────────

  /** Charge une caméra pour le backoffice — 404 si inexistante. */
  private async loadOrThrow(id: string): Promise<Camera> {
    const camera = await this.camerasRepository.findById(id);
    if (!camera) {
      throw new NotFoundException(CAMERA_NOT_FOUND);
    }
    return camera;
  }

  /** Caméras 'active' filtrées par catégories + bbox. La bbox est appliquée
   * via listInBbox (repository) puis les filtres statut/catégorie en mémoire —
   * volumes faibles au Lot 1 ; le driver postgres portera tout en SQL. */
  private async loadActiveCameras(
    categories: CameraCategory[] | undefined,
    bbox: BoundingBox | undefined,
  ): Promise<Camera[]> {
    const wanted =
      categories !== undefined && categories.length > 0
        ? new Set(categories)
        : null;

    if (bbox !== undefined) {
      const inBbox = await this.camerasRepository.listInBbox(bbox);
      return inBbox.filter(
        (c) => c.status === 'active' && (!wanted || wanted.has(c.category)),
      );
    }

    // Sans bbox : le repository sait filtrer par statut ET catégorie. Si
    // plusieurs catégories sont demandées, on liste par statut puis on filtre
    // (le contrat repository ne prend qu'UNE catégorie).
    if (wanted && wanted.size === 1) {
      const [only] = [...wanted];
      return this.camerasRepository.list({ status: 'active', category: only });
    }
    const active = await this.camerasRepository.list({ status: 'active' });
    return wanted ? active.filter((c) => wanted.has(c.category)) : active;
  }

  /** Refuse (400) une position hors de l'emprise de La Réunion. */
  private assertWithinReunion(location: GeoPoint): void {
    if (!isWithinReunion(location)) {
      throw new BadRequestException(CAMERA_OUT_OF_REUNION);
    }
  }

  /** cityName fournie (non vide) telle quelle, sinon déduite par géocodage. */
  private async resolveCityName(
    provided: string | undefined,
    location: GeoPoint,
  ): Promise<string> {
    const trimmed = provided?.trim();
    if (trimmed) {
      return trimmed;
    }
    const { cityName } = await this.geocoding.reverseGeocode(location);
    return cityName;
  }

  /** Projection CAMERA_PUBLIC (sans status ni updatedAt). */
  private toPublicView(camera: Camera): CameraPublicView {
    return {
      id: camera.id,
      cameraNumber: camera.cameraNumber,
      name: camera.name,
      streamType: camera.streamType,
      url: camera.url,
      category: camera.category,
      description: camera.description,
      location: camera.location,
      cityName: camera.cityName,
      districtName: camera.districtName,
      createdAt: camera.createdAt,
    };
  }

  /** Projection CAMERA_ADMIN (CAMERA_PUBLIC + status + updatedAt). */
  private toAdminView(camera: Camera): CameraAdminView {
    return {
      ...this.toPublicView(camera),
      status: camera.status,
      updatedAt: camera.updatedAt,
    };
  }
}

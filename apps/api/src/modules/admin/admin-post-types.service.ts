import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { POST_TYPES_REPOSITORY } from '../../database/database.tokens';
import { PostType } from '../../database/domain/entities';
import {
  PostTypesRepository,
  UpdatePostTypePatch,
} from '../../database/repositories/interfaces';
import { UpdatePostTypeDto } from './dto/update-post-type.dto';

const MAP_CAPABLE_SLUGS = new Set(['weather', 'traffic', 'danger']);

/** Vue admin de la table post_types, tous statuts inclus. */
export type AdminPostTypeView = PostType;

/**
 * Pilotage simple des types de posts.
 *
 * Les 5 slugs Lot 1 restent des invariants metier : le backoffice peut regler
 * libelle, couleur, ordre, activation et parametres carte, mais il ne cree ni
 * ne supprime de slug dans ce checkpoint.
 */
@Injectable()
export class AdminPostTypesService {
  constructor(
    @Inject(POST_TYPES_REPOSITORY)
    private readonly postTypesRepository: PostTypesRepository,
  ) {}

  /** Liste tous les types, actifs ou non (GET /admin/post-types). */
  list(): Promise<AdminPostTypeView[]> {
    return this.postTypesRepository.listAll();
  }

  /** Met a jour un type existant, sans changement de slug ni suppression. */
  async update(
    slug: string,
    dto: UpdatePostTypeDto,
  ): Promise<AdminPostTypeView> {
    const current = await this.postTypesRepository.findBySlug(slug);
    if (!current) {
      throw new NotFoundException('Type de publication introuvable');
    }

    const patch = this.normalizePatch(dto);
    if (patch.showsOnMap === true && patch.requiresLocationForMap === undefined) {
      patch.requiresLocationForMap = true;
    }

    const next: PostType = { ...current, ...patch };
    this.assertConsistent(next);

    return this.postTypesRepository.update(slug, patch);
  }

  private normalizePatch(dto: UpdatePostTypeDto): UpdatePostTypePatch {
    return {
      ...(dto.labelFr !== undefined ? { labelFr: dto.labelFr.trim() } : {}),
      ...(dto.icon !== undefined ? { icon: dto.icon.trim() } : {}),
      ...(dto.color !== undefined ? { color: dto.color } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.showsOnMap !== undefined ? { showsOnMap: dto.showsOnMap } : {}),
      ...(dto.requiresLocationForMap !== undefined
        ? { requiresLocationForMap: dto.requiresLocationForMap }
        : {}),
      ...(dto.defaultMapDurationMinutes !== undefined
        ? { defaultMapDurationMinutes: dto.defaultMapDurationMinutes }
        : {}),
      ...(dto.position !== undefined ? { position: dto.position } : {}),
    };
  }

  private assertConsistent(type: PostType): void {
    if (type.labelFr.trim() === '') {
      throw new BadRequestException('Le libelle du type est obligatoire');
    }
    if (!type.showsOnMap) {
      return;
    }
    if (!MAP_CAPABLE_SLUGS.has(type.slug)) {
      throw new BadRequestException(
        'Seuls les types weather, traffic et danger sont eligibles a la carte au Lot 1',
      );
    }
    if (!type.requiresLocationForMap) {
      throw new BadRequestException(
        'Un type visible sur la carte doit exiger une localisation',
      );
    }
    if (type.defaultMapDurationMinutes === null) {
      throw new BadRequestException(
        'Un type visible sur la carte doit definir une duree par defaut',
      );
    }
  }
}

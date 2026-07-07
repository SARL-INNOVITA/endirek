import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Paramètres de GET /notifications : ?limit=&offset=. Hérite de la pagination
 * bornée commune (limit 1-100, offset ≥ 0). Aucun filtre supplémentaire au
 * Lot 1 : la liste est toujours antéchronologique et limitée aux notifications
 * de l'utilisateur courant.
 */
export class ListNotificationsQueryDto extends PaginationQueryDto {}

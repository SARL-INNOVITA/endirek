import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

/** Nombre maximal de plats d'un menu du jour. */
export const MENU_DISHES_MAX = 12;

/** Corps de PUT /pages/:id/menus/:date — crée ou REMPLACE le menu du jour
 * de la date (D71) : la liste ORDONNÉE remplace les plats existants ;
 * [] supprime le menu du jour. Les plats doivent appartenir à la page et
 * être actifs (vérifié au SERVICE). */
export class UpsertMenuDto {
  @ApiProperty({
    description:
      `Identifiants des plats, dans l'ordre d'affichage (${MENU_DISHES_MAX} ` +
      'max) — tableau vide : le menu du jour est supprimé',
    type: [String],
  })
  @IsArray({ message: 'dishIds doit être un tableau' })
  @ArrayMaxSize(MENU_DISHES_MAX, {
    message: `${MENU_DISHES_MAX} plats maximum par menu`,
  })
  @IsUUID(undefined, {
    each: true,
    message: 'Chaque élément de dishIds doit être un identifiant de plat valide',
  })
  dishIds!: string[];
}

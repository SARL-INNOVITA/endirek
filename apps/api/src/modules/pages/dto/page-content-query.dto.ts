import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, Matches } from 'class-validator';

/** Format de date calendaire accepté ('YYYY-MM-DD'). */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Paramètres de GET /pages/:id/offers et /pages/:id/events : `all=true`
 * (propriétaire/modération uniquement — 403 sinon) inclut les offres
 * expirées / les événements passés. */
export class PageContentQueryDto {
  @ApiPropertyOptional({
    description:
      "true = historique complet (offres expirées / événements passés) — " +
      'réservé au propriétaire et à la modération',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean({ message: 'all doit être true ou false' })
  all?: boolean;
}

/** Paramètres de GET /pages/:id/menus : `from` = premier jour de la fenêtre
 * de 7 jours (défaut : aujourd'hui, heure Réunion). */
export class PageMenusQueryDto {
  @ApiPropertyOptional({
    description:
      "Premier jour de la semaine affichée, au format 'YYYY-MM-DD' " +
      "(défaut : aujourd'hui, heure Réunion)",
    example: '2026-07-14',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: "from doit être une date au format 'YYYY-MM-DD'",
  })
  from?: string;
}

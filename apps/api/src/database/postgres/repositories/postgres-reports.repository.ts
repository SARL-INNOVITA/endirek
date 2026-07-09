/**
 * PostgresReportsRepository — implémentation SQL de ReportsRepository.
 * Comportement OBSERVABLE identique au driver mock (MockReportsRepository) :
 * mêmes contrôles, tris antéchronologiques, agrégats et messages d'erreur.
 *
 * Anti-doublon : la contrainte UNIQUE reports_reporter_target_unique
 * (reporter_id, target_type, target_id) est reproduite. create() vérifie en
 * amont via existsByReporterAndTarget ET rattrape l'erreur native pg 23505
 * (concurrence) en la traduisant en UniqueViolationError typée — le service
 * répond 409 dans les deux cas.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DatabaseError, Pool } from 'pg';
import { Report, ReportTargetType } from '../../domain/entities';
import { POSTGRES_POOL } from '../../database.tokens';
import { UniqueViolationError } from '../../repositories/errors';
import {
  CreateReportInput,
  HandleReportInput,
  ListReportsParams,
  PagedResult,
  ReportsRepository,
} from '../../repositories/interfaces';
import { query, rowToReport } from '../pg-helpers';

/** Nom de la contrainte UNIQUE anti-doublon (miroir du schéma SQL). */
const REPORTS_UNIQUE_CONSTRAINT = 'reports_reporter_target_unique';

/** Colonnes de `reports` (toutes scalaires — aucune géométrie). */
const SQL_REPORT_COLUMNS = `
  id, reporter_id, target_type, target_id, reason_code, message, status,
  handled_by, handled_at, resolution_note, created_at
`.trim();

@Injectable()
export class PostgresReportsRepository implements ReportsRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async create(input: CreateReportInput): Promise<Report> {
    // Existence du reporter (même message que le mock).
    const reporter = await query(this.pool, `SELECT 1 FROM users WHERE id = $1`, [
      input.reporterId,
    ]);
    if (reporter.rows.length === 0) {
      throw new Error(`Utilisateur introuvable : ${input.reporterId}.`);
    }
    // Contrôle amont du doublon (miroir mock) : erreur TYPÉE avant même l'INSERT.
    if (
      await this.existsByReporterAndTarget(
        input.reporterId,
        input.targetType,
        input.targetId,
      )
    ) {
      throw new UniqueViolationError(
        REPORTS_UNIQUE_CONSTRAINT,
        'Signalement en doublon : cette cible a déjà été signalée par cet ' +
          'utilisateur (contrainte UNIQUE reports_reporter_target_unique).',
      );
    }
    try {
      // status 'open', handledBy/handledAt/resolutionNote null, message ''
      // par défaut — mêmes défauts que le mock.
      const res = await query(
        this.pool,
        `INSERT INTO reports
           (reporter_id, target_type, target_id, reason_code, message, status)
         VALUES ($1, $2, $3, $4, $5, 'open')
         RETURNING ${SQL_REPORT_COLUMNS}`,
        [
          input.reporterId,
          input.targetType,
          input.targetId,
          input.reasonCode,
          input.message ?? '',
        ],
      );
      return rowToReport(res.rows[0]);
    } catch (error) {
      // Backstop concurrence : deux requêtes passent toutes deux le contrôle
      // amont, l'index UNIQUE rejette la seconde (SQLSTATE 23505). On traduit
      // en erreur typée, comme le mock (le service la mappe en 409).
      if (error instanceof DatabaseError && error.code === '23505') {
        throw new UniqueViolationError(
          REPORTS_UNIQUE_CONSTRAINT,
          'Signalement en doublon : cette cible a déjà été signalée par cet ' +
            'utilisateur (contrainte UNIQUE reports_reporter_target_unique).',
        );
      }
      throw error;
    }
  }

  async existsByReporterAndTarget(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<boolean> {
    const res = await query(
      this.pool,
      `SELECT 1 FROM reports
        WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3`,
      [reporterId, targetType, targetId],
    );
    return res.rows.length > 0;
  }

  async list(params: ListReportsParams): Promise<PagedResult<Report>> {
    // File de modération : filtres status/targetType, antéchronologique
    // (tie-break id — ordre stable identique au mock), paginée.
    const where: string[] = [];
    const filterParams: unknown[] = [];
    if (params.status !== undefined) {
      filterParams.push(params.status);
      where.push(`status = $${filterParams.length}`);
    }
    if (params.targetType !== undefined) {
      filterParams.push(params.targetType);
      where.push(`target_type = $${filterParams.length}`);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const totalRes = await query<{ total: string }>(
      this.pool,
      `SELECT count(*)::int AS total FROM reports ${whereSql}`,
      filterParams,
    );
    const rowsRes = await query(
      this.pool,
      `SELECT ${SQL_REPORT_COLUMNS} FROM reports ${whereSql}
        ORDER BY created_at DESC, id
        LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      [...filterParams, params.limit, params.offset],
    );
    return {
      items: rowsRes.rows.map(rowToReport),
      total: Number(totalRes.rows[0].total),
    };
  }

  async listByTarget(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<Report[]> {
    // Signalements visant UNE cible, antéchronologiques (détail backoffice).
    const res = await query(
      this.pool,
      `SELECT ${SQL_REPORT_COLUMNS} FROM reports
        WHERE target_type = $1 AND target_id = $2
        ORDER BY created_at DESC`,
      [targetType, targetId],
    );
    return res.rows.map(rowToReport);
  }

  async countOpenByTargets(
    targetType: ReportTargetType,
    targetIds: string[],
  ): Promise<Record<string, number>> {
    // Comptage PAR LOT des signalements 'open' (GROUP BY target_id) : cibles
    // sans signalement ouvert absentes du résultat (miroir mock).
    if (targetIds.length === 0) {
      return {};
    }
    const res = await query<{ target_id: string; count: string }>(
      this.pool,
      `SELECT target_id, count(*)::int AS count
         FROM reports
        WHERE status = 'open' AND target_type = $1 AND target_id = ANY($2)
        GROUP BY target_id`,
      [targetType, targetIds],
    );
    const counts: Record<string, number> = {};
    for (const row of res.rows) {
      counts[row.target_id] = Number(row.count);
    }
    return counts;
  }

  async listByReporter(reporterId: string): Promise<Report[]> {
    // Export RGPD : signalements émis par l'utilisateur, antéchronologiques.
    const res = await query(
      this.pool,
      `SELECT ${SQL_REPORT_COLUMNS} FROM reports
        WHERE reporter_id = $1
        ORDER BY created_at DESC`,
      [reporterId],
    );
    return res.rows.map(rowToReport);
  }

  async findById(id: string): Promise<Report | null> {
    const res = await query(
      this.pool,
      `SELECT ${SQL_REPORT_COLUMNS} FROM reports WHERE id = $1`,
      [id],
    );
    return res.rows.length > 0 ? rowToReport(res.rows[0]) : null;
  }

  async handle(id: string, input: HandleReportInput): Promise<Report> {
    // Traitement : statut, modérateur, note ; handledAt = now. Mêmes contrôles
    // d'existence (report puis modérateur) et mêmes messages que le mock.
    const report = await query(this.pool, `SELECT 1 FROM reports WHERE id = $1`, [
      id,
    ]);
    if (report.rows.length === 0) {
      throw new Error(`Signalement introuvable : ${id}.`);
    }
    const moderator = await query(
      this.pool,
      `SELECT 1 FROM users WHERE id = $1`,
      [input.handledBy],
    );
    if (moderator.rows.length === 0) {
      throw new Error(`Modérateur introuvable : ${input.handledBy}.`);
    }
    const res = await query(
      this.pool,
      `UPDATE reports
          SET status = $2, handled_by = $3, handled_at = now(),
              resolution_note = $4
        WHERE id = $1
        RETURNING ${SQL_REPORT_COLUMNS}`,
      [id, input.status, input.handledBy, input.resolutionNote ?? null],
    );
    return rowToReport(res.rows[0]);
  }
}

import { pool } from '../config/db.js';
import type {
  BloatwareRuleRow,
  CreateBloatwareInput,
  UpdateBloatwareInput,
} from '../domain/bloatware.types.js';

/**
 * Capa de datos del recurso `bloatware-rules`.
 * Columnas siempre explícitas, valores siempre parametrizados ($1..$n) y
 * `created_at` devuelto como Date (el servicio lo serializa a ISO-8601).
 */

const BLOATWARE_COLUMNS = [
  'bloatware_id',
  'app_display_name',
  'package_signature',
  'detection_powershell_cmd',
  'removal_powershell_cmd',
  'risk_level',
  'description',
  'created_at',
].join(', ');

export class BloatwareRepository {
  static async findAll(riskLevel?: string): Promise<BloatwareRuleRow[]> {
    const params: string[] = [];
    let where = '';

    if (riskLevel) {
      params.push(riskLevel);
      where = `WHERE risk_level = $${params.length}`;
    }

    const { rows } = await pool.query<BloatwareRuleRow>(
      `SELECT ${BLOATWARE_COLUMNS}
         FROM bloatware_rules
         ${where}
        ORDER BY bloatware_id ASC`,
      params,
    );
    return rows;
  }

  static async findById(bloatwareId: number): Promise<BloatwareRuleRow | null> {
    const { rows } = await pool.query<BloatwareRuleRow>(
      `SELECT ${BLOATWARE_COLUMNS}
         FROM bloatware_rules
        WHERE bloatware_id = $1`,
      [bloatwareId],
    );
    return rows[0] ?? null;
  }

  static async create(input: CreateBloatwareInput): Promise<BloatwareRuleRow> {
    const { rows } = await pool.query<BloatwareRuleRow>(
      `INSERT INTO bloatware_rules (
         app_display_name, package_signature, detection_powershell_cmd,
         removal_powershell_cmd, risk_level, description
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${BLOATWARE_COLUMNS}`,
      [
        input.app_display_name,
        input.package_signature,
        input.detection_powershell_cmd,
        input.removal_powershell_cmd,
        input.risk_level,
        input.description,
      ],
    );
    return rows[0];
  }

  static async update(
    bloatwareId: number,
    input: UpdateBloatwareInput,
  ): Promise<BloatwareRuleRow | null> {
    const { rows } = await pool.query<BloatwareRuleRow>(
      `UPDATE bloatware_rules
          SET app_display_name         = COALESCE($2::text, app_display_name),
              package_signature        = COALESCE($3::text, package_signature),
              detection_powershell_cmd = COALESCE($4::text, detection_powershell_cmd),
              removal_powershell_cmd   = COALESCE($5::text, removal_powershell_cmd),
              risk_level               = COALESCE($6::text, risk_level),
              description              = COALESCE($7::text, description)
        WHERE bloatware_id = $1
        RETURNING ${BLOATWARE_COLUMNS}`,
      [
        bloatwareId,
        input.app_display_name ?? null,
        input.package_signature ?? null,
        input.detection_powershell_cmd ?? null,
        input.removal_powershell_cmd ?? null,
        input.risk_level ?? null,
        input.description ?? null,
      ],
    );
    return rows[0] ?? null;
  }

  static async delete(bloatwareId: number): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM bloatware_rules WHERE bloatware_id = $1 RETURNING bloatware_id`,
      [bloatwareId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}

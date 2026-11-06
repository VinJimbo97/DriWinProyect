import { pool } from '../config/db.js';

/** Fila del cruce driver × hardware × perfil usada por el endpoint de recomendación. */
export interface OptimalDriverRow {
  driver_id: number;
  edition_name: string;
  version_number: string;
  release_date: string;
  download_url: string;
  file_size_mb: number;
  silent_install_flags: string;
  is_whql_certified: boolean;
  sha256: string | null;
  os_environment: string;
  profile_name: string;
  component_id: number;
  ven_id: string;
  dev_id: string;
  commercial_name: string;
  category: string;
}

export class RecommendationRepository {
  /**
   * Busca los controladores óptimos cruzando el hardware detectado con los
   * perfiles del usuario. Ordena priorizando certificación WHQL y menor tamaño.
   *
   * `release_date` se formatea en SQL con `to_char` para que `pg` devuelva un
   * string `YYYY-MM-DD` (columna DATE) y no un Date con hora, tal como exige
   * el contrato del Hito 2.
   */
  static async findOptimalDriver(
    venId: string,
    devId: string,
    osEnvironment: string,
    profiles: string[],
  ): Promise<OptimalDriverRow[]> {
    // Consulta 100 % parametrizada y con columnas explícitas (sin SELECT *).
    const sql = `
      SELECT
        d.driver_id, d.edition_name, d.version_number,
        to_char(d.release_date, 'YYYY-MM-DD') AS release_date,
        d.download_url, d.file_size_mb, d.silent_install_flags,
        d.is_whql_certified, d.sha256, d.os_environment,
        p.profile_name,
        h.component_id, h.ven_id, h.dev_id, h.commercial_name, h.category
      FROM driver_packages d
      INNER JOIN hardware_components h ON h.component_id = d.component_id
      INNER JOIN user_profiles p       ON p.profile_id   = d.profile_id
      WHERE h.ven_id = $1
        AND h.dev_id = $2
        AND d.os_environment = $3
        AND p.profile_name = ANY($4::text[])
      ORDER BY d.is_whql_certified DESC, d.file_size_mb ASC;
    `;

    const result = await pool.query<OptimalDriverRow>(sql, [
      venId,
      devId,
      osEnvironment,
      profiles,
    ]);
    return result.rows;
  }

  /** ¿Existe la firma VEN_ID + DEV_ID en el catálogo de hardware? */
  static async findHardwareBySignature(
    venId: string,
    devId: string,
  ): Promise<{ component_id: number } | null> {
    const { rows } = await pool.query<{ component_id: number }>(
      `SELECT component_id
         FROM hardware_components
        WHERE ven_id = $1 AND dev_id = $2
        ORDER BY component_id ASC
        LIMIT 1`,
      [venId, devId],
    );
    return rows[0] ?? null;
  }

  /** Devuelve cuáles de los perfiles solicitados existen realmente en el catálogo. */
  static async findExistingProfileNames(profiles: string[]): Promise<string[]> {
    const { rows } = await pool.query<{ profile_name: string }>(
      `SELECT profile_name
         FROM user_profiles
        WHERE profile_name = ANY($1::text[])`,
      [profiles],
    );
    return rows.map((row) => row.profile_name);
  }
}

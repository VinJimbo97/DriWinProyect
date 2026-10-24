import { pool } from '../config/db.js';
import type { RecommendedAppDto } from '../domain/app.types.js';

export class AppRepository {
  /**
   * Busca aplicaciones recomendadas para uno o más perfiles.
   *
   * `GROUP BY` + `array_agg(DISTINCT ...)` sustituye al `DISTINCT` simple y
   * resuelve dos cosas a la vez: elimina duplicados cuando varios perfiles
   * comparten una app y expone `source_profiles` (TEXT[]) para que la UI
   * explique "por qué te sugiero X", tal como define el contrato §3.10.
   */
  static async findAppsByProfiles(profiles: string[]): Promise<RecommendedAppDto[]> {
    const sql = `
      SELECT
        a.app_id, a.app_name, a.category, a.version_number,
        a.download_url, a.file_size_mb, a.silent_install_flags,
        array_agg(DISTINCT p.profile_name ORDER BY p.profile_name) AS source_profiles
      FROM user_profiles p
      INNER JOIN profile_apps pa    ON pa.profile_id = p.profile_id
      INNER JOIN recommended_apps a ON a.app_id      = pa.app_id
      WHERE p.profile_name = ANY($1::text[])
      GROUP BY a.app_id, a.app_name, a.category, a.version_number,
               a.download_url, a.file_size_mb, a.silent_install_flags
      ORDER BY a.category, a.app_name;
    `;

    const result = await pool.query<RecommendedAppDto>(sql, [profiles]);
    return result.rows;
  }
}

import { pool, withTransaction } from '../config/db.js';
import {
  SYNTHETIC_EMAIL_DOMAIN,
  type ReplaceSyntheticResult,
  type SubscriptionTierRef,
  type SyntheticUserInput,
} from '../domain/syntheticUser.types.js';

/**
 * Capa de datos de synthetic_users para el script de datos sintéticos.
 * Columnas explícitas, 100 % parámetros $n y escritura transaccional.
 */

/** Sólo afecta a filas generadas por el script, nunca a la semilla manual. */
const GENERATED_EMAIL_PATTERN = `%@${SYNTHETIC_EMAIL_DOMAIN}`;

const INSERT_COLUMNS = [
  'full_name',
  'email',
  'user_role_type',
  'tier_id',
  'selected_profiles_array',
  'active_devices_count',
] as const;

/** 500 filas × 6 columnas = 3000 parámetros por sentencia (límite PG: 65535). */
const INSERT_CHUNK_SIZE = 500;

export class SyntheticUserRepository {
  static async findTiers(): Promise<SubscriptionTierRef[]> {
    const { rows } = await pool.query<SubscriptionTierRef>(
      `SELECT tier_id, tier_name, max_devices
         FROM subscription_tiers
        ORDER BY tier_id ASC`,
    );
    return rows;
  }

  /**
   * Borra el lote generado anterior e inserta el nuevo en UNA transacción:
   * si algo falla a mitad de camino, la tabla queda exactamente como estaba.
   */
  static async replaceGenerated(users: SyntheticUserInput[]): Promise<ReplaceSyntheticResult> {
    return withTransaction(async (client) => {
      const deleted = await client.query(
        `DELETE FROM synthetic_users WHERE email LIKE $1`,
        [GENERATED_EMAIL_PATTERN],
      );

      for (let start = 0; start < users.length; start += INSERT_CHUNK_SIZE) {
        const chunk = users.slice(start, start + INSERT_CHUNK_SIZE);
        const values: unknown[] = [];
        const tuples = chunk.map((user) => {
          const placeholders = INSERT_COLUMNS.map((column) => {
            values.push(user[column]);
            return `$${values.length}`;
          });
          return `(${placeholders.join(', ')})`;
        });

        await client.query(
          `INSERT INTO synthetic_users (${INSERT_COLUMNS.join(', ')})
           VALUES ${tuples.join(', ')}`,
          values,
        );
      }

      return { deleted: deleted.rowCount ?? 0, inserted: users.length };
    });
  }

  /** Distribución del lote generado por tipo de usuario y plan. */
  static async summarizeGenerated(): Promise<
    { user_role_type: string; tier_name: string; users: number; devices: number }[]
  > {
    const { rows } = await pool.query(
      `SELECT u.user_role_type, t.tier_name,
              COUNT(*)::int AS users,
              SUM(u.active_devices_count)::int AS devices
         FROM synthetic_users u
        INNER JOIN subscription_tiers t ON t.tier_id = u.tier_id
        WHERE u.email LIKE $1
        GROUP BY u.user_role_type, t.tier_name
        ORDER BY users DESC, u.user_role_type ASC`,
      [GENERATED_EMAIL_PATTERN],
    );
    return rows;
  }

  /** Consulta 6 de init.sql: usuarios que exceden el límite de su plan (debe ser 0). */
  static async countDeviceLimitViolations(): Promise<number> {
    const { rows } = await pool.query<{ violations: number }>(
      `SELECT COUNT(*)::int AS violations
         FROM synthetic_users u
        INNER JOIN subscription_tiers t ON t.tier_id = u.tier_id
        WHERE t.max_devices IS NOT NULL
          AND u.active_devices_count > t.max_devices`,
    );
    return rows[0]?.violations ?? 0;
  }
}

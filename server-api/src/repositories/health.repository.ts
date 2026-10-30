import { pool } from '../config/db.js';

/**
 * Capa de datos de la sonda de vida: única fuente de SQL de /health.
 */
export class HealthRepository {
  /**
   * Ejecuta `SELECT 1` y devuelve la latencia en milisegundos.
   * Si la base no responde, propaga el error (el servicio decide qué hacer).
   */
  static async ping(): Promise<number> {
    const startedAt = process.hrtime.bigint();
    await pool.query('SELECT 1 AS alive');
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    return Math.round(latencyMs * 100) / 100;
  }
}

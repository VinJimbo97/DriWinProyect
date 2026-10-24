import type { Request, Response } from 'express';
import { checkDatabaseConnection } from '../config/db.js';
import { API_VERSION } from '../config/version.js';
import { ApiError, ErrorCode } from '../domain/errors.js';

/**
 * GET /api/v1/health
 * Sonda de vida: verifica que el pool responda SELECT 1 y mide la latencia.
 * No expone versión de PostgreSQL, host, credenciales ni detalles internos.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const database = await checkDatabaseConnection();

  if (!database.up) {
    throw new ApiError(
      503,
      ErrorCode.DB_UNAVAILABLE,
      'La base de datos no responde.',
      undefined,
      'Revise el estado de Azure Database for PostgreSQL y el firewall de la instancia.',
    );
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    version: API_VERSION,
    database: 'up',
    latency_ms: database.latencyMs,
    timestamp: new Date().toISOString(),
  });
}

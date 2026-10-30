import { API_VERSION } from '../config/version.js';
import { ApiError, ErrorCode } from '../domain/errors.js';
import { HealthRepository } from '../repositories/health.repository.js';

export interface HealthStatus {
  status: 'ok';
  version: string;
  database: 'up';
  latency_ms: number;
  timestamp: string;
}

export class HealthService {
  /**
   * Regla de negocio de la sonda: el API está sano sólo si la base responde.
   * Si no responde → 503 DB_UNAVAILABLE. Nunca expone host, versión de
   * PostgreSQL ni credenciales.
   */
  static async getStatus(): Promise<HealthStatus> {
    let latencyMs: number;
    try {
      latencyMs = await HealthRepository.ping();
    } catch {
      throw new ApiError(
        503,
        ErrorCode.DB_UNAVAILABLE,
        'La base de datos no responde.',
        undefined,
        'Revise el estado de Azure Database for PostgreSQL y el firewall de la instancia.',
      );
    }

    return {
      status: 'ok',
      version: API_VERSION,
      database: 'up',
      latency_ms: latencyMs,
      timestamp: new Date().toISOString(),
    };
  }
}

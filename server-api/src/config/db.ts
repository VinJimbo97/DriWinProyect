import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

/**
 * TLS obligatorio en Azure. `PGSSLMODE=disable|prefer` sólo se usa en
 * PostgreSQL local sin certificado; `env.ts` lo prohíbe en producción.
 */
const TLS_ENABLED = !['disable', 'prefer'].includes(env.PGSSLMODE);

/**
 * Pool único de conexiones hacia Azure Database for PostgreSQL Flexible Server.
 *
 * Decisiones de rendimiento y seguridad:
 *  - `ssl` + `sslmode=require`: cifrado en tránsito obligatorio (C-I-A).
 *  - `max`: acota las conexiones concurrentes para no agotar el servidor.
 *  - `statement_timeout`: ninguna consulta puede quedar bloqueando el pool.
 *  - Las conexiones SIEMPRE se liberan con `client.release()` en un `finally`
 *    (ver `withTransaction`) para sostener latencias < 200 ms bajo estrés.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  query_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  ssl: TLS_ENABLED
    ? {
        // Verifica la cadena de certificados de Azure por defecto. Sólo se
        // desactiva explícitamente (DB_SSL_REJECT_UNAUTHORIZED=false) en entornos
        // con un proxy/CA corporativa que no esté en el trust store de Node.
        rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
      }
    : undefined,
});

pool.on('connect', (client) => {
  client.query(`SET statement_timeout = ${env.DB_STATEMENT_TIMEOUT_MS}`).catch(() => {
    /* el timeout global ya está configurado en el pool */
  });
});

pool.on('error', (error) => {
  // Sólo se registra el código/mensaje técnico; nunca la cadena de conexión.
  console.error('[db] Error en conexión inactiva del pool:', error.message);
});

/**
 * Ejecuta un bloque transaccional explícito.
 * BEGIN → trabajo → COMMIT; ante cualquier error ROLLBACK y propaga la causa.
 * La conexión vuelve al pool inmediatamente en el `finally`.
 */
export async function withTransaction<T>(
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[db] Falló el ROLLBACK:', (rollbackError as Error).message);
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Cierre ordenado del pool (graceful shutdown). */
export async function closePool(): Promise<void> {
  await pool.end();
}

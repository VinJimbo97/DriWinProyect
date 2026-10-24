import { pool, withTransaction } from '../config/db.js';
import { toOffset } from '../domain/pagination.js';
import type {
  CreateHardwareInput,
  HardwareDeleteResult,
  HardwareFilters,
  HardwareListResult,
  HardwareRow,
  UpdateHardwareInput,
} from '../domain/hardware.types.js';

/**
 * Capa de datos: única fuente de SQL del recurso hardware-components.
 * Reglas: columnas explícitas (nunca SELECT *), 100 % parámetros $n y
 * liberación inmediata de la conexión (pool.query / finally release).
 */

const HARDWARE_COLUMNS = [
  'component_id',
  'ven_id',
  'dev_id',
  'subsys_id',
  'commercial_name',
  'category',
  'created_at',
].join(', ');

/** Allowlist cerrada: el ORDER BY nunca se arma con texto del cliente. */
const SORT_COLUMNS: Record<string, string> = {
  component_id: 'component_id',
  commercial_name: 'commercial_name',
  category: 'category',
  created_at: 'created_at',
};

interface FindPageArgs {
  filters: HardwareFilters;
  page: number;
  limit: number;
  sort: string;
  order: 'asc' | 'desc';
}

export async function findPage(args: FindPageArgs): Promise<HardwareListResult> {
  const { filters, page, limit, sort, order } = args;
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (filters.ven_id) {
    values.push(filters.ven_id);
    conditions.push(`ven_id = $${values.length}`);
  }
  if (filters.dev_id) {
    values.push(filters.dev_id);
    conditions.push(`dev_id = $${values.length}`);
  }
  if (filters.category) {
    values.push(filters.category);
    conditions.push(`category = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMNS[sort] ?? SORT_COLUMNS.component_id;
  const direction = order === 'desc' ? 'DESC' : 'ASC';

  const pageValues = [...values, limit, toOffset(page, limit)];
  const limitParam = `$${values.length + 1}`;
  const offsetParam = `$${values.length + 2}`;

  const pageSql = `
    SELECT ${HARDWARE_COLUMNS}
    FROM hardware_components
    ${where}
    ORDER BY ${sortColumn} ${direction}, component_id ASC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM hardware_components
    ${where}
  `;

  const [pageResult, countResult] = await Promise.all([
    pool.query(pageSql, pageValues),
    pool.query(countSql, values),
  ]);

  return {
    rows: pageResult.rows as HardwareRow[],
    total: countResult.rows[0]?.total ?? 0,
  };
}

export async function findById(componentId: number): Promise<HardwareRow | null> {
  const sql = `
    SELECT ${HARDWARE_COLUMNS}
    FROM hardware_components
    WHERE component_id = $1
  `;
  const { rows } = await pool.query(sql, [componentId]);
  return (rows[0] as HardwareRow | undefined) ?? null;
}

export async function insert(input: CreateHardwareInput): Promise<HardwareRow> {
  const sql = `
    INSERT INTO hardware_components (ven_id, dev_id, subsys_id, commercial_name, category)
    VALUES ($1, $2, COALESCE($3, 'GENERIC'), $4, $5)
    RETURNING ${HARDWARE_COLUMNS}
  `;
  const { rows } = await pool.query(sql, [
    input.ven_id,
    input.dev_id,
    input.subsys_id ?? null,
    input.commercial_name,
    input.category,
  ]);
  return rows[0] as HardwareRow;
}

export async function update(
  componentId: number,
  input: UpdateHardwareInput,
): Promise<HardwareRow | null> {
  const sql = `
    UPDATE hardware_components
    SET commercial_name = COALESCE($2, commercial_name),
        category = COALESCE($3, category)
    WHERE component_id = $1
    RETURNING ${HARDWARE_COLUMNS}
  `;
  const { rows } = await pool.query(sql, [
    componentId,
    input.commercial_name ?? null,
    input.category ?? null,
  ]);
  return (rows[0] as HardwareRow | undefined) ?? null;
}

export async function countDrivers(componentId: number): Promise<number> {
  const sql = `
    SELECT COUNT(*)::int AS driver_count
    FROM driver_packages
    WHERE component_id = $1
  `;
  const { rows } = await pool.query(sql, [componentId]);
  return rows[0]?.driver_count ?? 0;
}

/**
 * Borrado protegido por transacción + bloqueo de fila (FOR UPDATE).
 *
 * Evita la carrera "contar hijos → borrar" frente a inserciones concurrentes:
 * mientras la fila del componente está bloqueada, ningún driver puede
 * referenciarla. Si hay hijos y no se autorizó la cascada, ROLLBACK.
 */
export async function deleteByIdGuarded(
  componentId: number,
  allowCascade: boolean,
): Promise<HardwareDeleteResult> {
  return withTransaction(async (client) => {
    const locked = await client.query(
      `SELECT component_id FROM hardware_components WHERE component_id = $1 FOR UPDATE`,
      [componentId],
    );

    if (locked.rowCount === 0) {
      return { found: false, driverCount: 0, deleted: false };
    }

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS driver_count FROM driver_packages WHERE component_id = $1`,
      [componentId],
    );
    const driverCount: number = countResult.rows[0]?.driver_count ?? 0;

    if (driverCount > 0 && !allowCascade) {
      // No se escribe nada: la transacción de sólo lectura finaliza con COMMIT.
      return { found: true, driverCount, deleted: false };
    }

    await client.query(`DELETE FROM hardware_components WHERE component_id = $1`, [componentId]);

    return { found: true, driverCount, deleted: true };
  });
}

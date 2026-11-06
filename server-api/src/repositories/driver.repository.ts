import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../config/db.js';
import { toOffset } from '../domain/pagination.js';
import type {
  CreateDriverInput,
  DriverFilters,
  DriverListResult,
  DriverRow,
  UpdateDriverInput,
} from '../domain/driver.types.js';

/**
 * Capa de datos del recurso driver-packages.
 * Todo el SQL vive aquí; ninguna otra capa conoce nombres de tablas.
 */

const DRIVER_SELECT = `
  SELECT d.driver_id,
         d.component_id,
         d.profile_id,
         p.profile_name,
         h.ven_id,
         h.dev_id,
         h.commercial_name,
         h.category,
         d.os_environment,
         d.edition_name,
         d.version_number,
         to_char(d.release_date, 'YYYY-MM-DD') AS release_date,
         d.download_url,
         d.file_size_mb,
         d.silent_install_flags,
         d.is_whql_certified,
         d.sha256,
         d.created_at
  FROM driver_packages d
  INNER JOIN hardware_components h ON h.component_id = d.component_id
  INNER JOIN user_profiles p       ON p.profile_id   = d.profile_id
`;

/** Allowlist cerrada para ORDER BY. */
const SORT_COLUMNS: Record<string, string> = {
  driver_id: 'd.driver_id',
  release_date: 'd.release_date',
  file_size_mb: 'd.file_size_mb',
  is_whql_certified: 'd.is_whql_certified',
};

interface FindPageArgs {
  filters: DriverFilters;
  page: number;
  limit: number;
  sort: string;
  order: 'asc' | 'desc';
}

export async function findPage(args: FindPageArgs): Promise<DriverListResult> {
  const { filters, page, limit, sort, order } = args;
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (filters.component_id !== undefined) {
    values.push(filters.component_id);
    conditions.push(`d.component_id = $${values.length}`);
  }
  if (filters.profile_id !== undefined) {
    values.push(filters.profile_id);
    conditions.push(`d.profile_id = $${values.length}`);
  }
  if (filters.os_environment) {
    values.push(filters.os_environment);
    conditions.push(`d.os_environment = $${values.length}`);
  }
  if (filters.whql !== undefined) {
    values.push(filters.whql);
    conditions.push(`d.is_whql_certified = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMNS[sort] ?? SORT_COLUMNS.driver_id;
  const direction = order === 'desc' ? 'DESC' : 'ASC';

  const pageValues = [...values, limit, toOffset(page, limit)];
  const limitParam = `$${values.length + 1}`;
  const offsetParam = `$${values.length + 2}`;

  const pageSql = `
    ${DRIVER_SELECT}
    ${where}
    ORDER BY ${sortColumn} ${direction}, d.driver_id ASC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM driver_packages d
    ${where}
  `;

  const [pageResult, countResult] = await Promise.all([
    pool.query(pageSql, pageValues),
    pool.query(countSql, values),
  ]);

  return {
    rows: pageResult.rows as DriverRow[],
    total: countResult.rows[0]?.total ?? 0,
  };
}

async function selectByIdWithClient(
  client: PoolClient,
  driverId: number,
): Promise<DriverRow | null> {
  const { rows } = await client.query(
    `${DRIVER_SELECT} WHERE d.driver_id = $1`,
    [driverId],
  );
  return (rows[0] as DriverRow | undefined) ?? null;
}

export async function findById(driverId: number): Promise<DriverRow | null> {
  const { rows } = await pool.query(`${DRIVER_SELECT} WHERE d.driver_id = $1`, [driverId]);
  return (rows[0] as DriverRow | undefined) ?? null;
}

/**
 * Alta crítica: INSERT + lectura del cruce con catálogos dentro de una misma
 * transacción, para devolver exactamente el registro persistido.
 */
export async function insert(input: CreateDriverInput): Promise<DriverRow> {
  return withTransaction(async (client) => {
    const inserted = await client.query(
      `
        INSERT INTO driver_packages
          (component_id, profile_id, os_environment, edition_name, version_number,
           release_date, download_url, file_size_mb, silent_install_flags, is_whql_certified, sha256)
        VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, COALESCE($9, '/S'), COALESCE($10, TRUE), $11)
        RETURNING driver_id
      `,
      [
        input.component_id,
        input.profile_id,
        input.os_environment,
        input.edition_name,
        input.version_number,
        input.release_date,
        input.download_url,
        input.file_size_mb,
        input.silent_install_flags ?? null,
        input.is_whql_certified ?? null,
        input.sha256 ?? null,
      ],
    );

    const driverId: number = inserted.rows[0].driver_id;
    const row = await selectByIdWithClient(client, driverId);
    if (!row) {
      throw new Error('El paquete de controladores se insertó pero no pudo releerse.');
    }
    return row;
  });
}

/**
 * Actualización parcial atómica. COALESCE conserva el valor anterior cuando
 * el campo no viene en el payload; el WHERE garantiza 404 sin filas afectadas.
 */
export async function update(
  driverId: number,
  input: UpdateDriverInput,
): Promise<DriverRow | null> {
  return withTransaction(async (client) => {
    const updated = await client.query(
      `
        UPDATE driver_packages
        SET component_id         = COALESCE($2::int, component_id),
            profile_id           = COALESCE($3::int, profile_id),
            os_environment       = COALESCE($4::text, os_environment),
            edition_name         = COALESCE($5::text, edition_name),
            version_number       = COALESCE($6::text, version_number),
            release_date         = COALESCE($7::date, release_date),
            download_url         = COALESCE($8::text, download_url),
            file_size_mb         = COALESCE($9::int, file_size_mb),
            silent_install_flags = COALESCE($10::text, silent_install_flags),
            is_whql_certified    = COALESCE($11::boolean, is_whql_certified),
            sha256               = COALESCE($12::text, sha256)
        WHERE driver_id = $1
        RETURNING driver_id
      `,
      [
        driverId,
        input.component_id ?? null,
        input.profile_id ?? null,
        input.os_environment ?? null,
        input.edition_name ?? null,
        input.version_number ?? null,
        input.release_date ?? null,
        input.download_url ?? null,
        input.file_size_mb ?? null,
        input.silent_install_flags ?? null,
        input.is_whql_certified ?? null,
        input.sha256 ?? null,
      ],
    );

    if (updated.rowCount === 0) {
      return null;
    }

    return selectByIdWithClient(client, driverId);
  });
}

/** DELETE de una sola sentencia: atómico por sí mismo. */
export async function deleteById(driverId: number): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM driver_packages WHERE driver_id = $1 RETURNING driver_id`,
    [driverId],
  );
  return (result.rowCount ?? 0) > 0;
}

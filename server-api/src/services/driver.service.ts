import { ApiError } from '../domain/errors.js';
import { buildPageMeta, type Page } from '../domain/pagination.js';
import type { DriverFilters, DriverPackageDto, DriverRow } from '../domain/driver.types.js';
import * as driverRepository from '../repositories/driver.repository.js';
import type {
  CreateDriverBody,
  ListDriverQuery,
  UpdateDriverBody,
} from '../schemas/driver.schema.js';
import { resolveBlobDownloadUrl } from './blobUrl.service.js';

interface PgConstraintError {
  code?: string;
  constraint?: string;
}

function asPgError(error: unknown): PgConstraintError | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return error as PgConstraintError;
  }
  return null;
}

function toDto(row: DriverRow): DriverPackageDto {
  return {
    driver_id: row.driver_id,
    component_id: row.component_id,
    profile_id: row.profile_id,
    profile_name: row.profile_name,
    component: {
      ven_id: row.ven_id,
      dev_id: row.dev_id,
      commercial_name: row.commercial_name,
      category: row.category,
    },
    os_environment: row.os_environment,
    edition_name: row.edition_name,
    version_number: row.version_number,
    release_date: row.release_date,
    download_url: row.download_url,
    file_size_mb: row.file_size_mb,
    silent_install_flags: row.silent_install_flags,
    is_whql_certified: row.is_whql_certified,
    sha256: row.sha256,
    created_at: new Date(row.created_at).toISOString(),
  };
}

export async function listDrivers(query: ListDriverQuery): Promise<Page<DriverPackageDto>> {
  const filters: DriverFilters = {};
  if (query.component_id !== undefined) {
    filters.component_id = query.component_id;
  }
  if (query.profile_id !== undefined) {
    filters.profile_id = query.profile_id;
  }
  if (query.os_environment) {
    filters.os_environment = query.os_environment;
  }
  if (query.whql !== undefined) {
    filters.whql = query.whql;
  }

  const { rows, total } = await driverRepository.findPage({
    filters,
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    order: query.order,
  });

  return {
    data: rows.map(toDto),
    meta: buildPageMeta(query.page, query.limit, total),
  };
}

export async function getDriverById(driverId: number): Promise<DriverPackageDto> {
  const row = await driverRepository.findById(driverId);
  if (!row) {
    throw ApiError.notFound('driver_packages', driverId);
  }
  return toDto(row);
}

/**
 * Regla de negocio: la API nunca aloja binarios. Sólo se persiste una URL
 * validada del contenedor `drivers` de Azure Blob Storage (offloading).
 */
export async function createDriver(input: CreateDriverBody): Promise<DriverPackageDto> {
  const downloadUrl = resolveBlobDownloadUrl(input.download_url, 'drivers');

  try {
    const row = await driverRepository.insert({
      component_id: input.component_id,
      profile_id: input.profile_id,
      os_environment: input.os_environment,
      edition_name: input.edition_name,
      version_number: input.version_number,
      release_date: input.release_date,
      download_url: downloadUrl,
      file_size_mb: input.file_size_mb,
      silent_install_flags: input.silent_install_flags,
      is_whql_certified: input.is_whql_certified,
      sha256: input.sha256,
    });
    return toDto(row);
  } catch (error) {
    const pgError = asPgError(error);
    if (pgError?.code === '23505' && pgError.constraint === 'uq_driver_recommendation') {
      throw ApiError.conflict(
        'Ya existe un paquete de controladores para ese componente, perfil y sistema operativo.',
        'Actualice el paquete existente con PUT /api/v1/driver-packages/:id.',
      );
    }
    throw error;
  }
}

export async function updateDriver(
  driverId: number,
  input: UpdateDriverBody,
): Promise<DriverPackageDto> {
  const downloadUrl = input.download_url
    ? resolveBlobDownloadUrl(input.download_url, 'drivers')
    : undefined;

  const row = await driverRepository.update(driverId, {
    ...input,
    download_url: downloadUrl,
  });

  if (!row) {
    throw ApiError.notFound('driver_packages', driverId);
  }

  return toDto(row);
}

export async function deleteDriver(driverId: number): Promise<void> {
  const deleted = await driverRepository.deleteById(driverId);
  if (!deleted) {
    throw ApiError.notFound('driver_packages', driverId);
  }
}

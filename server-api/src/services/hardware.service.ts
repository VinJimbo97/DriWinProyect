import { ApiError, ErrorCode } from '../domain/errors.js';
import { buildPageMeta, type Page } from '../domain/pagination.js';
import type {
  HardwareComponentDto,
  HardwareFilters,
  HardwareRow,
} from '../domain/hardware.types.js';
import * as hardwareRepository from '../repositories/hardware.repository.js';
import type {
  CreateHardwareBody,
  ListHardwareQuery,
  UpdateHardwareBody,
} from '../schemas/hardware.schema.js';

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

/**
 * Normaliza un identificador PCI/USB a 4 dígitos hexadecimales en mayúscula.
 * Acepta "1002", "0x1002", "VEN_1002" y "dev_0256".
 */
export function normalizePciId(value: string, field: 'ven_id' | 'dev_id'): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/^0X/, '')
    .replace(/^(VEN_|DEV_)/, '');

  if (!/^[0-9A-F]{4}$/.test(normalized)) {
    throw ApiError.validation(`El campo ${field} no tiene una firma PCI válida.`, [
      {
        field,
        issue: 'Debe contener exactamente 4 dígitos hexadecimales (ej: 1002).',
        expected: 'hexadecimal de 4 dígitos',
      },
    ]);
  }

  return normalized;
}

function toDto(row: HardwareRow): HardwareComponentDto {
  return {
    component_id: row.component_id,
    ven_id: row.ven_id,
    dev_id: row.dev_id,
    subsys_id: row.subsys_id,
    commercial_name: row.commercial_name,
    category: row.category,
    created_at: new Date(row.created_at).toISOString(),
  };
}

export async function listHardware(query: ListHardwareQuery): Promise<Page<HardwareComponentDto>> {
  const filters: HardwareFilters = {};
  if (query.ven_id) {
    filters.ven_id = normalizePciId(query.ven_id, 'ven_id');
  }
  if (query.dev_id) {
    filters.dev_id = normalizePciId(query.dev_id, 'dev_id');
  }
  if (query.category) {
    filters.category = query.category;
  }

  const { rows, total } = await hardwareRepository.findPage({
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

export async function getHardwareById(componentId: number): Promise<HardwareComponentDto> {
  const row = await hardwareRepository.findById(componentId);
  if (!row) {
    throw ApiError.notFound('hardware_components', componentId);
  }
  return toDto(row);
}

export async function createHardware(
  input: CreateHardwareBody,
): Promise<HardwareComponentDto> {
  const venId = normalizePciId(input.ven_id, 'ven_id');
  const devId = normalizePciId(input.dev_id, 'dev_id');
  const subsysId = (input.subsys_id ?? 'GENERIC').trim().toUpperCase();

  try {
    const row = await hardwareRepository.insert({
      ven_id: venId,
      dev_id: devId,
      subsys_id: subsysId,
      commercial_name: input.commercial_name,
      category: input.category,
    });
    return toDto(row);
  } catch (error) {
    const pgError = asPgError(error);
    if (pgError?.code === '23505' && pgError.constraint === 'uq_hardware_signature') {
      throw ApiError.conflict(
        `Ya existe un componente con la firma ${venId}/${devId}/${subsysId}.`,
        'Consulte el componente existente con GET /api/v1/hardware-components?ven_id=...&dev_id=...',
      );
    }
    throw error;
  }
}

export async function updateHardware(
  componentId: number,
  input: UpdateHardwareBody,
): Promise<HardwareComponentDto> {
  const row = await hardwareRepository.update(componentId, {
    commercial_name: input.commercial_name,
    category: input.category,
  });

  if (!row) {
    throw ApiError.notFound('hardware_components', componentId);
  }

  return toDto(row);
}

export interface DeleteHardwareOutcome {
  deleted: true;
  cascadedDrivers: number;
}

/**
 * Regla de negocio del contrato §3.3: si el componente tiene paquetes de
 * controladores asociados, el cliente debe confirmar la cascada con
 * `?cascade=true`. La decisión vive en el servicio; el bloqueo/atomicidad,
 * en el repositorio transaccional.
 */
export async function deleteHardware(
  componentId: number,
  allowCascade: boolean,
): Promise<DeleteHardwareOutcome> {
  const result = await hardwareRepository.deleteByIdGuarded(componentId, allowCascade);

  if (!result.found) {
    throw ApiError.notFound('hardware_components', componentId);
  }

  if (!result.deleted) {
    throw new ApiError(
      409,
      ErrorCode.CONFLICT,
      `El componente tiene ${result.driverCount} driver_packages asociados.`,
      [
        {
          field: 'cascade',
          issue: 'Debe confirmar la eliminación en cascada para continuar.',
          expected: 'cascade=true',
        },
      ],
      'Repita DELETE con ?cascade=true; se eliminarán también los paquetes de controladores dependientes.',
    );
  }

  return { deleted: true, cascadedDrivers: result.driverCount };
}

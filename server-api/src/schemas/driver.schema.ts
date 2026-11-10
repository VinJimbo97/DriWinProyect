import { z } from 'zod';
import { requerido } from './zodMessages.js';
import {
  booleanQuerySchema,
  idParamSchema,
  isoDateSchema,
  paginationQuerySchema,
  positiveIntSchema,
} from './common.schema.js';

const osEnvironmentSchema = z
  .string(requerido('El sistema operativo es obligatorio'))
  .trim()
  .min(3, 'os_environment debe tener al menos 3 caracteres')
  .max(30, 'os_environment no puede superar 30 caracteres')
  .regex(
    /^[A-Za-z0-9_.-]+$/,
    'os_environment sólo admite letras, números, punto, guion y guion bajo (ej: Win11_x64)',
  );

const editionNameSchema = z
  .string(requerido('El nombre de la edición es obligatorio'))
  .trim()
  .min(2, 'edition_name debe tener al menos 2 caracteres')
  .max(120, 'edition_name no puede superar 120 caracteres');

const versionNumberSchema = z
  .string(requerido('La versión es obligatoria'))
  .trim()
  .min(1, 'version_number no puede estar vacío')
  .max(40, 'version_number no puede superar 40 caracteres');

/**
 * URL de descarga. Se acepta una URL absoluta https o una ruta relativa al
 * contenedor de Blob (ej: amd-adrenalin-24.9.1-win11-64bit.exe). El servicio
 * `blobUrl` valida el host y construye la URL final (offloading).
 */
const downloadUrlSchema = z
  .string(requerido('La URL de descarga es obligatoria'))
  .trim()
  .min(3, 'La URL de descarga no puede estar vacía')
  .max(2048, 'La URL de descarga no puede superar 2048 caracteres');

const fileSizeSchema = z.coerce
  .number({ error: 'file_size_mb debe ser numérico' })
  .int('file_size_mb debe ser un entero (megabytes)')
  .positive('file_size_mb debe ser mayor que 0')
  .max(100_000, 'file_size_mb parece fuera de rango (máximo 100.000 MB)');

/** GET /api/v1/driver-packages */
export const listDriverQuerySchema = paginationQuerySchema.extend({
  component_id: positiveIntSchema.optional(),
  profile_id: positiveIntSchema.optional(),
  os_environment: osEnvironmentSchema.optional(),
  whql: booleanQuerySchema.optional(),
  sort: z
    .enum(['driver_id', 'release_date', 'file_size_mb', 'is_whql_certified'], {
      error: 'sort debe ser driver_id, release_date, file_size_mb o is_whql_certified',
    })
    .default('driver_id'),
});

/** POST /api/v1/driver-packages */
export const createDriverSchema = z.object({
  component_id: positiveIntSchema,
  profile_id: positiveIntSchema,
  os_environment: osEnvironmentSchema,
  edition_name: editionNameSchema,
  version_number: versionNumberSchema,
  release_date: isoDateSchema,
  download_url: downloadUrlSchema,
  file_size_mb: fileSizeSchema,
  silent_install_flags: z
    .string()
    .trim()
    .max(50, 'silent_install_flags no puede superar 50 caracteres')
    .optional(),
  is_whql_certified: z
    .boolean({ error: 'is_whql_certified debe ser true o false' })
    .optional(),
  sha256: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-f0-9]{64}$/, 'sha256 debe tener 64 caracteres hexadecimales')
    .optional(),
});

/** PUT /api/v1/driver-packages/:id */
export const updateDriverSchema = createDriverSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Debe enviar al menos un campo editable del paquete de controladores.',
  });

export const driverIdParamSchema = idParamSchema;

export type ListDriverQuery = z.infer<typeof listDriverQuerySchema>;
export type CreateDriverBody = z.infer<typeof createDriverSchema>;
export type UpdateDriverBody = z.infer<typeof updateDriverSchema>;

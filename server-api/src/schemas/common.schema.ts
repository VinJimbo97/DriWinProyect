import { z } from 'zod';

/** Identificador numérico de path param (SERIAL de PostgreSQL). */
export const idParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'El identificador debe ser numérico' })
    .int('El identificador debe ser un número entero')
    .positive('El identificador debe ser mayor que 0'),
});

/**
 * Firma PCI/USB: se acepta con o sin prefijo (1002, 0x1002, VEN_1002).
 * La normalización definitiva vive en la capa de servicio.
 */
export const pciIdSchema = z
  .string({ required_error: 'Este identificador es obligatorio', invalid_type_error: 'Debe ser texto' })
  .trim()
  .max(12, 'No puede superar los 12 caracteres (ej: VEN_1002)')
  .regex(
    /^(?:0X)?(?:VEN_|DEV_)?[0-9A-Fa-f]{4}$/i,
    'Debe ser hexadecimal de 4 dígitos, opcionalmente con prefijo 0x/VEN_/DEV_ (ej: 1002)',
  );

export const paginationQuerySchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: 'page debe ser numérico' })
    .int('page debe ser un entero')
    .min(1, 'page debe ser mayor o igual a 1')
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: 'limit debe ser numérico' })
    .int('limit debe ser un entero')
    .min(1, 'limit debe ser mayor o igual a 1')
    .max(100, 'limit no puede superar 100 registros por página')
    .default(20),
  order: z.enum(['asc', 'desc']).default('asc'),
});

/** Fecha ISO-8601 sin hora (columna DATE de PostgreSQL). */
export const isoDateSchema = z
  .string({ required_error: 'La fecha es obligatoria' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use el formato ISO-8601 YYYY-MM-DD (ej: 2026-09-15)')
  .refine(
    (value) => {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    },
    { message: 'La fecha indicada no existe en el calendario' },
  );

/** Booleano recibido por query string (?whql=true). */
export const booleanQuerySchema = z
  .enum(['true', 'false'], {
    errorMap: () => ({ message: 'Use true o false' }),
  })
  .transform((value) => value === 'true');

/** Entero positivo reutilizable (IDs de referencia). */
export const positiveIntSchema = z.coerce
  .number({ invalid_type_error: 'Debe ser un número entero' })
  .int('Debe ser un número entero')
  .positive('Debe ser mayor que 0');

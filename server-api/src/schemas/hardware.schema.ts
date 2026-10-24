import { z } from 'zod';
import { idParamSchema, paginationQuerySchema, pciIdSchema } from './common.schema.js';

const categorySchema = z
  .string({ required_error: 'La categoría es obligatoria' })
  .trim()
  .min(2, 'La categoría debe tener al menos 2 caracteres (ej: GPU)')
  .max(50, 'La categoría no puede superar 50 caracteres');

const commercialNameSchema = z
  .string({ required_error: 'El nombre comercial es obligatorio' })
  .trim()
  .min(3, 'El nombre comercial debe tener al menos 3 caracteres')
  .max(150, 'El nombre comercial no puede superar 150 caracteres');

const subsysIdSchema = z
  .string()
  .trim()
  .min(1, 'subsys_id no puede estar vacío')
  .max(20, 'subsys_id no puede superar 20 caracteres')
  .regex(
    /^[A-Za-z0-9_-]+$/,
    'subsys_id sólo admite letras, números, guion y guion bajo (ej: GENERIC)',
  );

/** GET /api/v1/hardware-components */
export const listHardwareQuerySchema = paginationQuerySchema.extend({
  ven_id: pciIdSchema.optional(),
  dev_id: pciIdSchema.optional(),
  category: categorySchema.optional(),
  sort: z
    .enum(['component_id', 'commercial_name', 'category', 'created_at'], {
      errorMap: () => ({
        message: 'sort debe ser component_id, commercial_name, category o created_at',
      }),
    })
    .default('component_id'),
});

/** POST /api/v1/hardware-components */
export const createHardwareSchema = z.object({
  ven_id: pciIdSchema,
  dev_id: pciIdSchema,
  subsys_id: subsysIdSchema.optional(),
  commercial_name: commercialNameSchema,
  category: categorySchema,
});

/**
 * PUT /api/v1/hardware-components/:id
 * Sólo se permiten los campos mutables del contrato §3.3.
 */
export const updateHardwareSchema = z
  .object({
    commercial_name: commercialNameSchema.optional(),
    category: categorySchema.optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message:
      'Debe enviar al menos un campo editable: commercial_name y/o category.',
  });

export const hardwareIdParamSchema = idParamSchema;

/** DELETE /api/v1/hardware-components/:id?cascade=true */
export const deleteHardwareQuerySchema = z.object({
  cascade: z
    .enum(['true', 'false'], {
      errorMap: () => ({ message: 'cascade sólo admite true o false' }),
    })
    .transform((value) => value === 'true')
    .default('false'),
});

export type ListHardwareQuery = z.infer<typeof listHardwareQuerySchema>;
export type CreateHardwareBody = z.infer<typeof createHardwareSchema>;
export type UpdateHardwareBody = z.infer<typeof updateHardwareSchema>;
export type DeleteHardwareQuery = z.infer<typeof deleteHardwareQuerySchema>;


import { z } from 'zod';
import { idParamSchema } from './common.schema.js';

/**
 * Esquemas Zod del recurso `bloatware-rules`.
 * Los límites replican el DDL de `db/init.sql` (VARCHAR(150), VARCHAR(10), TEXT)
 * para que un valor aceptado por Zod nunca provoque un 22001 en PostgreSQL.
 */

const riskLevelSchema = z.enum(['BAJO', 'MEDIO', 'ALTO'], {
  errorMap: () => ({ message: 'risk_level debe ser BAJO, MEDIO o ALTO' }),
});

const displayNameSchema = z
  .string({ required_error: 'app_display_name es obligatorio' })
  .trim()
  .min(2, 'app_display_name debe tener al menos 2 caracteres')
  .max(150, 'app_display_name no puede superar 150 caracteres');

const signatureSchema = z
  .string({ required_error: 'package_signature es obligatoria' })
  .trim()
  .min(2, 'package_signature debe tener al menos 2 caracteres')
  .max(150, 'package_signature no puede superar 150 caracteres');

const powershellSchema = (field: string) =>
  z
    .string({ required_error: `${field} es obligatorio` })
    .trim()
    .min(5, `${field} debe tener al menos 5 caracteres`)
    .max(4000, `${field} no puede superar 4000 caracteres`);

const descriptionSchema = z
  .string({ required_error: 'description es obligatoria' })
  .trim()
  .min(10, 'description debe tener al menos 10 caracteres')
  .max(2000, 'description no puede superar 2000 caracteres');

/** GET /api/v1/bloatware-rules?risk_level=BAJO */
export const listBloatwareQuerySchema = z.object({
  risk_level: riskLevelSchema.optional(),
});

/** POST /api/v1/bloatware-rules */
export const createBloatwareSchema = z.object({
  app_display_name: displayNameSchema,
  package_signature: signatureSchema,
  detection_powershell_cmd: powershellSchema('detection_powershell_cmd'),
  removal_powershell_cmd: powershellSchema('removal_powershell_cmd'),
  risk_level: riskLevelSchema,
  description: descriptionSchema,
});

/** PUT /api/v1/bloatware-rules/:id (actualización parcial, al menos un campo) */
export const updateBloatwareSchema = createBloatwareSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Debe enviar al menos un campo editable de la regla de bloatware.',
  });

/** DELETE /api/v1/bloatware-rules/:id */
export const bloatwareIdParamSchema = idParamSchema;

export type ListBloatwareQuery = z.infer<typeof listBloatwareQuerySchema>;
export type CreateBloatwareBody = z.infer<typeof createBloatwareSchema>;
export type UpdateBloatwareBody = z.infer<typeof updateBloatwareSchema>;

import { z } from 'zod';
import { requerido } from './zodMessages.js';
import { idParamSchema } from './common.schema.js';

/**
 * Esquemas Zod del recurso `bloatware-rules`.
 * Los límites replican el DDL de `db/init.sql` (VARCHAR(150), VARCHAR(10), TEXT)
 * para que un valor aceptado por Zod nunca provoque un 22001 en PostgreSQL.
 */

const riskLevelSchema = z.enum(['BAJO', 'MEDIO', 'ALTO'], {
  error: 'risk_level debe ser BAJO, MEDIO o ALTO',
});

const displayNameSchema = z
  .string(requerido('app_display_name es obligatorio'))
  .trim()
  .min(2, 'app_display_name debe tener al menos 2 caracteres')
  .max(150, 'app_display_name no puede superar 150 caracteres');

const signatureSchema = z
  .string(requerido('package_signature es obligatoria'))
  .trim()
  .min(2, 'package_signature debe tener al menos 2 caracteres')
  .max(150, 'package_signature no puede superar 150 caracteres');

const powershellSchema = (field: string) =>
  z
    .string(requerido(`${field} es obligatorio`))
    .trim()
    .min(5, `${field} debe tener al menos 5 caracteres`)
    .max(4000, `${field} no puede superar 4000 caracteres`);

const descriptionSchema = z
  .string(requerido('description es obligatoria'))
  .trim()
  .min(10, 'description debe tener al menos 10 caracteres')
  .max(2000, 'description no puede superar 2000 caracteres');

/**
 * Nombre de paquete de la Store: mismo patrón que ck_bloatware_package_names.
 * Sin comillas, espacios ni ; → no se puede inyectar nada en PowerShell.
 */
const packageNameSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._*-]{1,99}$/,
    'Cada paquete sólo admite letras, números, punto, guion, guion bajo y * (2 a 100 caracteres)',
  );

const packageNamesSchema = z
  .array(packageNameSchema)
  .max(20, 'Una regla no puede tener más de 20 paquetes');

const helpTextSchema = z
  .string()
  .trim()
  .max(2000, 'help_text no puede superar 2000 caracteres');

/** GET /api/v1/bloatware-rules?risk_level=BAJO&profiles=Gamer,Developer */
export const listBloatwareQuerySchema = z.object({
  risk_level: riskLevelSchema.optional(),
  profiles: z
    .string()
    .trim()
    .max(400, 'La lista de perfiles es demasiado larga')
    .transform((value) => [
      ...new Set(
        value
          .split(',')
          .map((profile) => profile.trim())
          .filter(Boolean),
      ),
    ])
    .refine((profiles) => profiles.length <= 10, {
      message: 'No se pueden consultar más de 10 perfiles a la vez',
    })
    .refine((profiles) => profiles.every((profile) => profile.length <= 50), {
      message: 'El nombre de perfil no puede superar 50 caracteres',
    })
    .optional(),
});

/** POST /api/v1/bloatware-rules */
export const createBloatwareSchema = z.object({
  app_display_name: displayNameSchema,
  package_signature: signatureSchema,
  package_names: packageNamesSchema.optional(),
  detection_powershell_cmd: powershellSchema('detection_powershell_cmd'),
  removal_powershell_cmd: powershellSchema('removal_powershell_cmd'),
  risk_level: riskLevelSchema,
  description: descriptionSchema,
  help_text: helpTextSchema.optional(),
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

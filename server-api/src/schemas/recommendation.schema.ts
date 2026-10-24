import { z } from 'zod';
import { pciIdSchema } from './common.schema.js';

/**
 * Contrato de los endpoints de negocio `/recommendations`.
 * Toda la validación de entrada vive aquí (capa de esquemas), nunca en el
 * controlador ni en el servicio (Zero Trust).
 */

const profileNameSchema = z
  .string({ required_error: 'El nombre de perfil es obligatorio' })
  .trim()
  .min(1, 'El nombre de perfil no puede estar vacío')
  .max(50, 'El nombre de perfil no puede superar 50 caracteres');

const osEnvironmentSchema = z.enum(['Win11_x64', 'Win10_x64'], {
  errorMap: () => ({ message: 'os_environment debe ser Win11_x64 o Win10_x64' }),
});

const subsysIdSchema = z
  .string()
  .trim()
  .min(1, 'subsys_id no puede estar vacío')
  .max(20, 'subsys_id no puede superar 20 caracteres')
  .regex(/^[A-Za-z0-9_-]+$/, 'subsys_id sólo admite letras, números, guion y guion bajo');

/**
 * POST /api/v1/recommendations/driver
 *
 * Acepta el nombre canónico (`ven_id`, `dev_id`, `profiles[]`) y, por
 * compatibilidad con el Hito 1, los alias documentados `ven`, `dev` y
 * `profile` (string). El resultado siempre se normaliza a la forma canónica.
 */
export const driverRecommendationBodySchema = z
  .object({
    ven_id: pciIdSchema.optional(),
    ven: pciIdSchema.optional(),
    dev_id: pciIdSchema.optional(),
    dev: pciIdSchema.optional(),
    subsys_id: subsysIdSchema.optional(),
    os_environment: osEnvironmentSchema,
    profiles: z
      .array(profileNameSchema)
      .min(1, 'Debe seleccionar al menos un perfil de uso')
      .max(10, 'No se pueden consultar más de 10 perfiles a la vez')
      .optional(),
    profile: profileNameSchema.optional(),
  })
  .superRefine((payload, ctx) => {
    if (!payload.ven_id && !payload.ven) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ven_id'],
        message: 'ven_id (o su alias ven) es obligatorio',
      });
    }
    if (!payload.dev_id && !payload.dev) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dev_id'],
        message: 'dev_id (o su alias dev) es obligatorio',
      });
    }
    if (!payload.profiles?.length && !payload.profile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['profiles'],
        message: 'profiles (o su alias profile) debe incluir al menos un perfil',
      });
    }
  })
  .transform((payload) => ({
    ven_id: (payload.ven_id ?? payload.ven) as string,
    dev_id: (payload.dev_id ?? payload.dev) as string,
    subsys_id: payload.subsys_id,
    os_environment: payload.os_environment,
    profiles: payload.profiles ?? [payload.profile as string],
  }));

/**
 * GET /api/v1/recommendations/apps?profiles=Gamer,Creator
 * El query string se transforma en un arreglo sin vacíos y sin repetidos.
 */
export const appsRecommendationQuerySchema = z.object({
  profiles: z
    .string({ required_error: 'Debe indicar al menos un perfil en ?profiles=' })
    .trim()
    .min(1, 'Debe indicar al menos un perfil en ?profiles= (ej. Gamer,Creator)')
    .max(400, 'La lista de perfiles es demasiado larga')
    .transform((value) => [
      ...new Set(
        value
          .split(',')
          .map((profile) => profile.trim())
          .filter(Boolean),
      ),
    ])
    .refine((profiles) => profiles.length > 0, {
      message: 'Debe indicar al menos un perfil válido en ?profiles=',
    })
    .refine((profiles) => profiles.length <= 10, {
      message: 'No se pueden consultar más de 10 perfiles a la vez',
    }),
});

export type DriverRecommendationBody = z.infer<typeof driverRecommendationBodySchema>;
export type AppsRecommendationQuery = z.infer<typeof appsRecommendationQuerySchema>;

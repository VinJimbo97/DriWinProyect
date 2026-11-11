import { z } from 'zod';
import { requerido } from './zodMessages.js';
import { PRIVACY_NOTICE_VERSION } from '../domain/privacy.js';

/**
 * Validación de las rutas de cuentas ("nunca confiar en el cliente").
 * Los mensajes se muestran tal cual en la app, por eso van en lenguaje simple.
 */

const email = z
  .string(requerido('Escribe tu correo'))
  .trim()
  .max(160, 'El correo es demasiado largo')
  .email('Escribe un correo válido (ej. nombre@correo.cl)');

const password = z
  .string(requerido('Escribe tu contraseña'))
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(128, 'La contraseña no puede tener más de 128 caracteres');

/** Identificador aleatorio que genera la app en cada equipo (no es dato del hardware). */
const deviceId = z
  .string(requerido('Falta el identificador del equipo'))
  .uuid('El identificador del equipo no es válido');

/**
 * Consentimiento explícito del aviso de privacidad (Ley 19.628 / 21.719):
 * la casilla debe venir marcada (true, no "true" ni 1) y con la versión vigente.
 */
const privacyVersion = z.literal(PRIVACY_NOTICE_VERSION, {
  error: 'El aviso de privacidad cambió. Actualiza DriWin y vuelve a leerlo.',
});

export const registerSchema = z.object({
  email,
  password,
  device_id: deviceId,
  privacy_accepted: z.literal(true, { error: 'Debes aceptar el aviso de privacidad para crear la cuenta.' }),
  privacy_version: privacyVersion,
});

/** Aceptar el aviso vigente (cuentas antiguas o cuando el aviso cambia de versión). */
export const privacyConsentSchema = z.object({ privacy_version: privacyVersion });

export const loginSchema = z.object({
  email,
  // En el inicio de sesión no se revela la política: sólo se exige que venga.
  password: z.string(requerido('Escribe tu contraseña')).min(1, 'Escribe tu contraseña').max(128),
  device_id: deviceId,
});

export const purchaseSchema = z.object({
  plan_years: z.union([z.literal(1), z.literal(2), z.literal(3)], {
    error: 'El plan debe ser de 1, 2 o 3 años',
  }),
});

export const deleteAccountSchema = z.object({
  password: z.string(requerido('Escribe tu contraseña para confirmar')).min(1).max(128),
});

export const deviceIdParamSchema = z.object({
  id: z.coerce.number().int().positive('El id del equipo debe ser un entero positivo'),
});

export const supportTicketSchema = z.object({
  subject: z
    .string(requerido('Escribe un asunto'))
    .trim()
    .min(5, 'El asunto debe tener al menos 5 caracteres')
    .max(120, 'El asunto no puede superar los 120 caracteres'),
  message: z
    .string(requerido('Escribe tu consulta'))
    .trim()
    .min(10, 'Cuéntanos un poco más (al menos 10 caracteres)')
    .max(2000, 'La consulta no puede superar los 2.000 caracteres'),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type PurchaseBody = z.infer<typeof purchaseSchema>;
export type DeleteAccountBody = z.infer<typeof deleteAccountSchema>;
export type SupportTicketBody = z.infer<typeof supportTicketSchema>;
export type PrivacyConsentBody = z.infer<typeof privacyConsentSchema>;

/**
 * Aviso de privacidad de DriWin (Ley 19.628 / Ley 21.719).
 *
 * La versión DEBE coincidir con server-api/src/domain/privacy.ts: la API sólo
 * acepta registros con la versión vigente. Si el texto cambia de forma
 * relevante, se sube la versión en ambos lados y las cuentas existentes
 * deberán aceptarlo de nuevo.
 *
 * El texto de cada sección está en i18n (privacy.<id>.title / .body).
 */
export const PRIVACY_NOTICE_VERSION = '2026-11-13';

/**
 * Correo de contacto (soporte y privacidad). Ficticio en esta versión: el
 * dominio reservado .example nunca entrega correos a nadie por error.
 */
export const SUPPORT_EMAIL = 'soporte@driwin.example';

export const PRIVACY_SECTIONS = [
  'who',
  'noAccount',
  'account',
  'purpose',
  'legalBasis',
  'where',
  'retention',
  'security',
  'rights',
  'changes',
] as const;

export type PrivacySection = (typeof PRIVACY_SECTIONS)[number];

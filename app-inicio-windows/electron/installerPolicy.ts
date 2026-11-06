/**
 * Reglas de lo que DriWin acepta instalar. Es la última barrera antes de pedir
 * permisos de administrador: aunque la API o la interfaz estén comprometidas,
 * no se descarga nada fuera de nuestro contenedor ni se aceptan argumentos libres.
 */

export interface DriverInstallRequest {
  driverId: number;
  downloadUrl: string;
  sha256: string | null;
  silentFlags: string;
}

export const DRIVER_HOST = 'driwinstorage.blob.core.windows.net';
const DRIVER_PATH_PREFIX = '/drivers/';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

/** Sólo parámetros simples (/S, /v/qn, --silent, -install); sin comillas ni separadores de comandos. */
const FLAG_TOKEN_PATTERN = /^[-/][A-Za-z0-9_=.:/-]+$/;
const MAX_FLAGS_LENGTH = 100;

export type PolicyViolation = 'NOT_VERIFIED' | 'INVALID_SOURCE' | 'INVALID_FLAGS';

export function validateInstallRequest(request: DriverInstallRequest): PolicyViolation | null {
  if (!Number.isInteger(request.driverId) || request.driverId <= 0) {
    return 'INVALID_SOURCE';
  }
  if (!request.sha256 || !SHA256_PATTERN.test(request.sha256)) {
    return 'NOT_VERIFIED';
  }
  if (!isAllowedDriverUrl(request.downloadUrl)) {
    return 'INVALID_SOURCE';
  }
  return areFlagsAllowed(request.silentFlags) ? null : 'INVALID_FLAGS';
}

export function isAllowedDriverUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === DRIVER_HOST &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    url.search === '' &&
    url.pathname.startsWith(DRIVER_PATH_PREFIX) &&
    url.pathname.toLowerCase().endsWith('.exe')
  );
}

export function areFlagsAllowed(flags: string): boolean {
  if (flags.length === 0 || flags.length > MAX_FLAGS_LENGTH) {
    return false;
  }
  return flags.split(' ').every((token) => FLAG_TOKEN_PATTERN.test(token));
}

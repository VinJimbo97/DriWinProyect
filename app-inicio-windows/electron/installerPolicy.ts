/**
 * Reglas de lo que DriWin acepta instalar. Es la última barrera antes de pedir
 * permisos de administrador: aunque la API o la interfaz estén comprometidas,
 * no se descarga nada fuera de nuestro contenedor. El instalador se abre sin
 * argumentos, para que la persona vea y acepte los términos del fabricante.
 */

export interface DriverInstallRequest {
  driverId: number;
  downloadUrl: string;
  sha256: string | null;
}

export const DRIVER_HOST = 'driwinstorage.blob.core.windows.net';
const DRIVER_PATH_PREFIX = '/drivers/';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type PolicyViolation = 'NOT_VERIFIED' | 'INVALID_SOURCE';

export function validateInstallRequest(request: DriverInstallRequest): PolicyViolation | null {
  if (!Number.isInteger(request.driverId) || request.driverId <= 0) {
    return 'INVALID_SOURCE';
  }
  if (!request.sha256 || !SHA256_PATTERN.test(request.sha256)) {
    return 'NOT_VERIFIED';
  }
  return isAllowedDriverUrl(request.downloadUrl) ? null : 'INVALID_SOURCE';
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

/**
 * Compara la versión instalada (formato de Windows) con la del catálogo para no
 * ofrecer nunca una versión más antigua que la que el equipo ya tiene.
 */
export type DriverUpdateState = 'update' | 'current' | 'unknown';

const VENDOR_NVIDIA = '10DE';
/** Intel usa la misma numeración en Windows y en sus paquetes (8087 = Bluetooth USB). */
const VENDORS_INTEL = ['8086', '8087'];

/** Windows muestra NVIDIA 561.09 como 32.0.15.6109: la versión son sus últimos 5 dígitos. */
export function nvidiaDisplayVersion(windowsVersion: string): string | null {
  const parts = windowsVersion.split('.');
  if (parts.length !== 4 || !parts.every((part) => /^\d+$/.test(part))) {
    return null;
  }
  const digits = `${parts[2].slice(-1)}${parts[3].padStart(4, '0')}`;
  return `${Number(digits.slice(0, 3))}.${digits.slice(3)}`;
}

function parse(version: string): number[] | null {
  const parts = version.trim().split('.');
  return parts.every((part) => /^\d+$/.test(part)) ? parts.map(Number) : null;
}

function isCatalogNewer(installed: number[], catalog: number[]): boolean {
  const length = Math.min(installed.length, catalog.length);
  for (let i = 0; i < length; i++) {
    if (catalog[i] !== installed[i]) {
      return catalog[i] > installed[i];
    }
  }
  return false;
}

export function driverUpdateState(vendorId: string, installedVersion: string, catalogVersion: string): DriverUpdateState {
  const vendor = vendorId.toUpperCase();
  let comparable: string | null = null;
  if (vendor === VENDOR_NVIDIA) {
    comparable = nvidiaDisplayVersion(installedVersion);
  } else if (VENDORS_INTEL.includes(vendor)) {
    comparable = installedVersion;
  }

  const installed = comparable === null ? null : parse(comparable);
  const catalog = parse(catalogVersion);
  if (!installed || !catalog) {
    return 'unknown';
  }
  return isCatalogNewer(installed, catalog) ? 'update' : 'current';
}

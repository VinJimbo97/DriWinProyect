import { desktop } from '../desktop/bridge';
import { HARDWARE_FIXTURES } from './fixtures';
import { scanHardware } from './mockScanner';
import { scanNativeHardware } from './nativeScanner';
import type { ScanResult } from './types';

/** Fuente especial: el hardware real del equipo (sólo en el .exe). */
export const NATIVE_SOURCE_ID = 'equipo-real';

export interface ScanSource {
  id: string;
  label: string;
  description: string;
}

/** Fuentes de escaneo disponibles: el equipo real (si es .exe) + los fixtures. */
export const SCAN_SOURCES: ScanSource[] = [
  ...(desktop
    ? [{ id: NATIVE_SOURCE_ID, label: 'Este equipo (escaneo real)', description: 'Lee el hardware de Windows con PowerShell (Win32_PnPSignedDriver).' }]
    : []),
  ...HARDWARE_FIXTURES.map(({ id, label, description }) => ({ id, label, description })),
];

/** En el .exe se escanea el equipo real; en el navegador, el primer fixture. */
export const DEFAULT_SOURCE_ID = SCAN_SOURCES[0].id;

/** Punto único de escaneo: el resto de la app no sabe si el hardware es real o simulado. */
export function scanDevices(sourceId: string, signal?: AbortSignal): Promise<ScanResult> {
  return sourceId === NATIVE_SOURCE_ID ? scanNativeHardware() : scanHardware(sourceId, signal);
}

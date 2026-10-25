import { ApiRequestError } from '../api/client';
import { desktop } from '../desktop/bridge';
import { parsePnpDevice } from './parsePnpDevice';
import type { DetectedDevice, ScanResult } from './types';

/**
 * Escáner REAL: pide al proceso principal de Electron que lea el hardware con
 * PowerShell y lo interpreta con el mismo parser que usan los fixtures.
 */
export async function scanNativeHardware(): Promise<ScanResult> {
  if (!desktop) {
    throw new ApiRequestError(0, 'SCAN_UNAVAILABLE', 'El escaneo real sólo está disponible en la app de escritorio.');
  }

  let raw: Awaited<ReturnType<typeof desktop.scanHardware>>;
  try {
    raw = await desktop.scanHardware();
  } catch {
    throw new ApiRequestError(0, 'SCAN_ERROR', 'No se pudo leer el hardware de este equipo con PowerShell.');
  }

  const devices = raw.devices
    .map(parsePnpDevice)
    .filter((device): device is DetectedDevice => device !== null);

  return { os_environment: raw.os_environment, devices };
}

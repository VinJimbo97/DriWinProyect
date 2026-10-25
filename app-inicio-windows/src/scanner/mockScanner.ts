import { HARDWARE_FIXTURES } from './fixtures';
import { parsePnpDevice } from './parsePnpDevice';
import type { DetectedDevice, ScanResult } from './types';

/** Tiempo simulado de escaneo (el real con PowerShell tarda 1-3 s). */
const SCAN_DELAY_MS = 1500;

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Escaneo cancelado', 'AbortError'));
    });
  });
}

/**
 * Escáner SIMULADO: devuelve el hardware de un fixture con el mismo formato
 * que tendrá el escáner real. En el paso 4 (.exe) se agrega un
 * `nativeScanner.ts` que ejecute Get-PnpDevice y entregue exactamente un
 * ScanResult; el resto de la app no cambia.
 */
export async function scanHardware(fixtureId: string, signal?: AbortSignal): Promise<ScanResult> {
  await wait(SCAN_DELAY_MS, signal);

  const fixture = HARDWARE_FIXTURES.find((item) => item.id === fixtureId) ?? HARDWARE_FIXTURES[0];
  const devices = fixture.devices
    .map(parsePnpDevice)
    .filter((device): device is DetectedDevice => device !== null);

  return { os_environment: fixture.os_environment, devices };
}

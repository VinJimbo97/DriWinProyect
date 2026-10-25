import { scanHardware } from '../scanner/mockScanner';
import { useApi } from './useApi';

/** Escanea el hardware del equipo (hoy: fixture simulado). */
export function useHardwareScan(fixtureId: string) {
  return useApi(`scan:${fixtureId}`, (signal) => scanHardware(fixtureId, signal));
}
